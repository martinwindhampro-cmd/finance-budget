
/* ============================== INTÉRÊTS DES COMPTES ÉPARGNE ==============================
   Caractéristiques rangées dans le compte (S.sav, visibles par ses membres) : type, taux, mode de calcul,
   versement, fiscalité, plafond. Les intérêts sont estimés avec les mouvements notés dans l'app :
   • par quinzaine (Livret A, LDDS, LEP…) : un versement compte à partir de la quinzaine suivante,
     un retrait est retiré dès le début de sa quinzaine ;
   • au jour le jour (comptes rémunérés) ; • sur le solde de fin de mois.                                     */
const SAVT = {
  'Livret A': { cap: 22950, calc: 'q', pay: 'year', tax: 'net' }, 'LDDS': { cap: 12000, calc: 'q', pay: 'year', tax: 'net' },
  'LEP': { cap: 10000, calc: 'q', pay: 'year', tax: 'net' }, 'Livret Jeune': { cap: 1600, calc: 'q', pay: 'year', tax: 'net' },
  'PEL': { cap: 61200, calc: 'm', pay: 'year', tax: 'pfu' }, 'Livret bancaire / compte rémunéré': { cap: 0, calc: 'd', pay: 'month', tax: 'pfu' },
  'Autre': { cap: 0, calc: 'd', pay: 'year', tax: 'pfu' } };
const SCALC = { q: 'Par quinzaine (livrets réglementés)', d: 'Au jour le jour', m: 'Sur le solde de fin de mois' };
const SPAY = { year: 'Une fois par an, au 31 décembre', month: 'Chaque mois' };
const STAX = { net: 'Net d\'impôt (Livret A, LDDS, LEP, Livret Jeune)', pfu: 'Imposable : prélèvement de 30 %' };
const savCfg = () => S.sav || null;
function savDialog() {
  const c = savCfg() || {}, t0 = c.type || 'Livret A', d0 = Object.assign({}, SAVT[t0], c);
  formDialog({ title: '💰 Caractéristiques · ' + esc(accName()), intro: 'Sert à estimer les intérêts de ce compte. Le taux est celui affiché par ta banque (il peut changer, pense à le mettre à jour).',
    fields: [{ id: 'type', label: 'Type d\'épargne', type: 'select', options: Object.keys(SAVT), value: t0 },
      { id: 'rate', label: 'Taux annuel (%)', type: 'num', value: c.rate, ph: 'ex. 1,5' },
      { id: 'calc', label: 'Calcul des intérêts', type: 'select', options: Object.values(SCALC), value: SCALC[d0.calc] },
      { id: 'pay', label: 'Versement des intérêts', type: 'select', options: Object.values(SPAY), value: SPAY[d0.pay] },
      { id: 'tax', label: 'Fiscalité', type: 'select', options: Object.values(STAX), value: STAX[d0.tax] },
      { id: 'cap', label: 'Plafond de versement (vide = aucun)', type: 'num', value: d0.cap || '', ph: 'ex. 22950' }],
    onDelete: c.type ? () => mutate(() => { delete S.sav; }, 'Caractéristiques retirées') : null, delLabel: 'Retirer',
    onSave: v => {
      if (!(num(v.rate) > 0) || num(v.rate) > 30) { toast('Indique le taux (ex. 1,5)'); return false; }
      const key = (o, val) => Object.keys(o).find(k => o[k] === val);
      mutate(() => { S.sav = { type: v.type, rate: Math.round(num(v.rate) * 1000) / 1000, calc: key(SCALC, v.calc), pay: key(SPAY, v.pay), tax: key(STAX, v.tax), cap: num(v.cap) > 0 ? num(v.cap) : 0 }; }, 'Taux enregistré : ' + String(num(v.rate)).replace('.', ',') + ' %');
    } });
  // le type pré-remplit le reste (modifiable)
  $('f_type').addEventListener('change', () => { const p = SAVT[$('f_type').value]; $('f_calc').value = SCALC[p.calc]; $('f_pay').value = SPAY[p.pay]; $('f_tax').value = STAX[p.tax]; $('f_cap').value = p.cap ? fmtIn(p.cap) : ''; });
}

// Mouvements d'un mois (jour, montant signé), pour reconstituer le solde au fil des jours
function savMoves(k) {
  const m = S.months[k]; if (!m) return [];
  return [...m.incomes.filter(i => i.status === 'Reçu').map(i => [parseInt(i.date) || 1, num(i.amount)]), ...m.expenses.filter(e => e.status === 'Payé').map(e => [parseInt(e.date) || 1, -cash(e)])];
}
// Intérêts bruts d'un mois donné (taux r en %)
function savMonthInt(k, r, calc) {
  const start = chainBalance(k), mv = savMoves(k), n = dim(k), t = r / 100;
  if (calc === 'm') return Math.max(0, start + sum(mv, x => x[1])) * t / 12;
  if (calc === 'd') { let b = start, s = 0; for (let d = 1; d <= n; d++) { b += sum(mv.filter(x => x[0] === d), x => x[1]); s += Math.max(0, b) * t / 365; } return s; }
  // quinzaines : 1-15, 16-fin
  let s = 0;
  [[1, 15], [16, n]].forEach(([a, z]) => {
    const before = start + sum(mv.filter(x => x[0] < a), x => x[1]), out = sum(mv.filter(x => x[0] >= a && x[0] <= z && x[1] < 0), x => x[1]);
    s += Math.max(0, before + out) * t / 24;
  });
  return s;
}
function savInterest() {
  const c = savCfg(); if (!c || !(c.rate > 0)) return null;
  const Y = nowK().slice(0, 4), first0 = Object.keys(S.months).filter(k => !isDraft(S.months[k])).sort()[0] || nowK();
  const K = []; for (let k = first0 > Y + '-01' ? first0 : Y + '-01'; k <= nowK(); k = kAdd(k, 1)) K.push(k);      // tous les mois, même jamais ouverts
  const net = v => c.tax === 'pfu' ? v * 0.7 : v;
  // mois écoulés : complets ; mois en cours : au prorata (jusqu'à aujourd'hui)
  let ytd = 0; const per = {};
  K.forEach(k => { let v = savMonthInt(k, c.rate, c.calc); if (k === nowK()) v *= today() / dim(k); per[k] = v; ytd += v; });
  const bal = calc(month(nowK()), nowK()).current, first = K[0];
  const rest = (() => { const now = new Date(), end = new Date(now.getFullYear(), 11, 31); return Math.max(0, (end - now) / 864e5) / 365; })();
  const year = ytd + Math.max(0, bal) * c.rate / 100 * rest;
  return { c, Y, ytd: net(ytd), year: net(year), brut: year, bal, first, per, net, partial: first && first > Y + '-01' };
}
// Intérêts déjà enregistrés (lignes « Intérêts ») et prochain versement à noter
function savDue(I) {
  const c = I.c, tracked = k => Object.keys(S.months).some(x => x <= k && !isDraft(S.months[x])), has = p => Object.values(S.months).some(m => m.incomes.some(i => i.int === p));
  if (c.pay === 'month') { const pk = kAdd(nowK(), -1); if (tracked(pk) && !has(pk)) { const v = I.net(savMonthInt(pk, c.rate, c.calc)); return v >= 0.01 ? { p: pk, k: nowK(), day: '1', amt: v, label: 'Intérêts ' + mlab(pk).toLowerCase() } : null; } return null; }
  const py = String(+I.Y - 1), dec = py + '-12';
  if (nowK() <= I.Y + '-02' && tracked(dec) && !has(py)) { const v = I.net(Object.keys(S.months).filter(k => k.startsWith(py)).reduce((s, k) => s + savMonthInt(k, c.rate, c.calc), 0)); return v >= 0.01 ? { p: py, k: dec, day: '31', amt: v, label: 'Intérêts ' + py } : null; }
  return null;
}
function savIntHTML() {
  const c = savCfg();
  if (!c) return `<section class="card" style="display:flex;flex-direction:column;gap:10px"><div class="ch"><h2>💰 Intérêts</h2></div>
    <p class="note">Indique le type d'épargne et son taux : l'app estime les intérêts gagnés cette année et ceux attendus au 31 décembre.</p>
    <button class="btn" data-a="sav-int" style="align-self:flex-start">Fixer le taux et les caractéristiques</button></section>`;
  const I = savInterest(), due = I && savDue(I), capP = c.cap ? Math.min(100, Math.max(0, I.bal) / c.cap * 100) : 0;
  return `<section class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="ch"><h2>💰 Intérêts ${I.Y}</h2><button class="lnk" data-a="sav-int">Modifier</button></div>
    <p class="note" style="font-size:13px;margin:0">${esc(c.type)} · <b style="color:var(--ink)">${String(c.rate).replace('.', ',')} %</b> par an · ${esc(SCALC[c.calc].toLowerCase())} · ${c.pay === 'month' ? 'versés chaque mois' : 'versés au 31 décembre'} · ${c.tax === 'net' ? 'net d\'impôt' : 'après prélèvement de 30 %'}</p>
    <div class="savint">
      <span><small>Gagnés depuis le ${I.partial ? '1er ' + mlab(I.first).toLowerCase() : '1er janvier'}</small><b class="num">${eur(I.ytd)}</b></span>
      <span><small>Estimés sur ${I.Y}${c.tax === 'pfu' ? ' (net)' : ''}</small><b class="num">${eur(I.year)}</b></span>
    </div>
    ${c.cap ? `<div style="display:flex;flex-direction:column;gap:6px"><span class="note" style="font-size:13px">Plafond : <b style="color:var(--ink)">${eur0(Math.max(0, I.bal))}</b> sur ${eur0(c.cap)}${I.bal >= c.cap ? ' · <b style="color:var(--warn)">plafond atteint</b>' : ' · encore ' + eur0(c.cap - I.bal) + ' possibles'}</span><span class="bar" style="display:block;height:8px"><i style="width:${capP}%;--c:#14B8A6"></i></span></div>` : ''}
    ${due ? `<div class="alert"><span>${esc(due.label)} : environ <b>${eur(due.amt)}</b> à recevoir.</span><button class="lnk" data-a="sav-int-add">Ajouter au compte</button></div>` : ''}
    <p class="note" style="font-size:12px;margin:0">Estimation à partir des versements et retraits notés dans l'app${I.partial ? ' (depuis le début du suivi)' : ''}, au taux actuel. Le montant exact est celui de ta banque.</p>
  </section>`;
}
function savIntAdd() {
  const I = savInterest(), due = I && savDue(I); if (!due) return;
  mutate(() => { month(due.k).incomes.unshift({ id: uid(), name: due.label, amount: Math.round(due.amt * 100) / 100, date: due.day, status: 'Reçu', isFixed: false, int: due.p }); }, due.label + ' ajoutés : ' + eur(due.amt));
}
