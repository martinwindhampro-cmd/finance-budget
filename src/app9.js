
/* ============================== DEVISES ==============================
   Taux de change : Banque centrale européenne (via frankfurter), gratuit, mis à jour chaque jour ouvré vers 16 h.
   Une dépense saisie en devise est convertie en € au taux du jour ; le montant d'origine est gardé.          */
const CURS = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD', 'CNY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'TRY', 'BRL', 'MXN', 'INR', 'THB', 'ZAR'];
let FX = (() => { try { return JSON.parse(localStorage.getItem('fx') || 'null'); } catch (e) { return null; } })();   // { date, at, rates } (1 € = rates[X] X)
let fxBusy = null;
function fxLoad(force) {
  if (!force && FX && Date.now() - FX.at < 6 * 3600e3) return Promise.resolve(FX);
  if (fxBusy) return fxBusy;
  const urls = ['https://api.frankfurter.dev/v1/latest?base=EUR', 'https://api.frankfurter.app/latest?from=EUR'];
  const tryU = i => Promise.resolve().then(() => fetch(urls[i])).then(r => { if (!r.ok) throw 0; return r.json(); }).catch(e => { if (i + 1 < urls.length) return tryU(i + 1); throw e; });
  return fxBusy = tryU(0).then(j => { FX = { date: j.date, at: Date.now(), rates: Object.assign({ EUR: 1 }, j.rates) }; try { localStorage.setItem('fx', JSON.stringify(FX)); } catch (e) {} return FX; })
    .catch(() => FX).finally(() => { fxBusy = null; });
}
const fxRate = c => c === 'EUR' ? 1 : FX?.rates?.[c] || null;           // nombre d'unités de « c » pour 1 €
const fxFmt = (v, c) => { try { return num(v).toLocaleString('fr-FR', { style: 'currency', currency: c }); } catch (e) { return num(v) + ' ' + c; } };
const fxDate = () => FX?.date ? FX.date.split('-').reverse().slice(0, 2).join('/') : '';
function fxLine() {
  if (!P || !P.cur || P.cur === 'EUR') return '';
  const a = parseAmt(P.d.amount), r = fxRate(P.cur);
  if (!r) return `<span style="color:var(--warn)">${fxBusy ? 'Chargement du taux…' : 'Taux indisponible (pas de connexion ?)'}</span>`;
  return `≈ <b class="num">${eur(a / r)}</b> · 1 ${P.cur} = ${(1 / r).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} € <span style="color:var(--mute)">(BCE, ${fxDate()})</span>`;
}
function fxSelectHTML() {
  if (isSavAcc() || P.d.xfer) return '';
  const list = CURS.filter(c => c === 'EUR' || !FX || FX.rates[c]);
  return `<div class="fxrow"><label class="fxsel">Devise<select data-pcur="1" aria-label="Devise">${list.map(c => `<option ${c === (P.cur || 'EUR') ? 'selected' : ''}>${c}</option>`).join('')}</select></label><span id="pn-fx" class="note" style="font-size:13px">${fxLine()}</span></div>`;
}
function fxPaint() { const e = $('pn-fx'); if (e) e.innerHTML = fxLine(); }

/* ============================== OBJECTIFS D'ÉPARGNE ==============================
   Personnels (profil) : nom, montant visé, déjà mis de côté, date souhaitée (facultative).                      */
const GOAL_EMO = ['🎯', '🎮', '✈️', '🚗', '🏠', '🎁', '💍', '📱', '💻', '🏖️', '🚲', '💰'];
const goals = () => U.goals = U.goals || [];
function goalInfo(g) {
  const t = num(g.target), s = num(g.saved), left = Math.max(0, t - s), p = t > 0 ? Math.min(100, s / t * 100) : 0;
  let per = null, months = null;
  if (g.date && left > 0) { const [y, m] = g.date.split('-').map(Number), n = new Date(); months = Math.max(1, (y - n.getFullYear()) * 12 + (m - 1 - n.getMonth())); per = left / months; }
  return { t, s, left, p, per, months, done: t > 0 && s >= t };
}
function goalsHTML() {
  const G = goals();
  return `<section class="card" aria-label="Mes objectifs" style="display:flex;flex-direction:column;gap:14px">
    <div class="ch" style="margin:0"><h2>Mes objectifs</h2><button class="btn sm" data-a="goal-new">${svg('plus', 16)} Objectif</button></div>
    ${G.length ? `<div class="goals">${G.map(g => { const i = goalInfo(g);
      return `<div class="goal${i.done ? ' done' : ''}"><button class="goalb" data-a="goal-edit" data-id="${g.id}">
        <span class="gemo">${esc(g.emo || '🎯')}</span><span class="rt"><span class="rn">${esc(g.name)}</span><span class="rs num"><b style="color:var(--ink)">${eur0(i.s)}</b> sur ${eur0(i.t)}</span></span><b class="num gp">${Math.round(i.p)} %</b></button>
        <div class="bar"><i style="width:${i.p}%;--c:${i.done ? 'var(--ok)' : '#14B8A6'}"></i></div>
        <div class="gfoot"><span class="note" style="font-size:12px">${i.done ? '🎉 Objectif atteint !' : 'Reste ' + eur0(i.left) + (i.per != null ? ` · <b>${eur0(Math.ceil(i.per))} / mois</b> d'ici ${MS[+g.date.slice(5) - 1]} ${g.date.slice(0, 4)}` : '')}</span>
        ${i.done ? '' : `<button class="btn sm" data-a="goal-add" data-id="${g.id}">+ Ajouter</button>`}</div></div>`; }).join('')}</div>`
      : '<p class="empty">Fixe-toi un but : « 600 € pour une PS5 », « 1 500 € pour les vacances »… et suis ta progression.</p>'}
  </section>`;
}
function goalDialog(id) {
  const g = id ? goals().find(x => x.id === id) : null; let emo = g?.emo || '🎯';
  formDialog({ title: g ? g.name : 'Nouvel objectif', intro: g ? '' : 'Pour quoi veux-tu mettre de l\'argent de côté ?',
    fields: [{ id: 'name', label: 'Objectif', value: g?.name || '', ph: 'ex. PS5' }, { id: 'target', label: 'Montant à atteindre', type: 'num', value: g?.target, ph: 'ex. 600' },
      { id: 'saved', label: 'Déjà mis de côté', type: 'num', value: g?.saved ?? 0, ph: '0' }, { id: 'date', label: 'Pour quand ? (facultatif)', value: g?.date || '', ph: 'mois' }],
    onDelete: g ? () => { U.goals = goals().filter(x => x.id !== id); saveUser(); render(); toast('Objectif supprimé'); } : null,
    onSave: v => {
      if (!v.name) { toast('Donne un nom à ton objectif'); return false; }
      if (!(v.target > 0)) { toast('Indique le montant à atteindre'); return false; }
      const o = { name: v.name, target: Math.round(v.target * 100) / 100, saved: Math.max(0, Math.round(num(v.saved) * 100) / 100), date: v.date || '', emo };
      if (g) Object.assign(g, o); else goals().push(Object.assign({ id: uid(), at: Date.now() }, o));
      saveUser(); render(); toast(g ? 'Objectif modifié' : '🎯 Objectif créé : ' + v.name);
    } });
  const dt = $('f_date'); if (dt) dt.type = 'month';
  if (g) { $('dlg').querySelector('.dact').insertAdjacentHTML('afterbegin', '<button type="button" class="btn" id="g-todebt" title="Le transformer en avance à rembourser">C\'est un remboursement</button>'); $('g-todebt').onclick = () => goalToDebt(g); }
  const f = $('dlg').querySelector('form');
  f.insertAdjacentHTML('afterbegin', '');
  $('f_name').closest('label').insertAdjacentHTML('beforebegin', `<div class="chips" id="g-emo" role="group" aria-label="Icône">${GOAL_EMO.map(e => `<button type="button" class="chip${e === emo ? ' on' : ''}" data-e="${e}" style="font-size:18px;padding:4px 10px">${e}</button>`).join('')}</div>`);
  $('g-emo').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; emo = b.dataset.e; $$('#g-emo .chip').forEach(x => x.classList.toggle('on', x === b)); };
}
function goalAddDialog(id) {
  const g = goals().find(x => x.id === id); if (!g) return; const i = goalInfo(g);
  formDialog({ title: (g.emo || '🎯') + ' ' + g.name, intro: `Déjà ${eur(i.s)} sur ${eur(i.t)}. Combien mets-tu de côté ?`, ok: 'Ajouter',
    fields: [{ id: 'amt', label: 'Montant', type: 'num', value: i.per ? Math.ceil(i.per) : null, ph: '0,00' }],
    onSave: v => {
      if (!v.amt) { toast('Indique un montant'); return false; }
      g.saved = Math.max(0, Math.round((num(g.saved) + v.amt) * 100) / 100);
      if ($('g-out')?.checked && v.amt > 0) mutate(() => month(nowK()).expenses.unshift({ id: uid(), name: 'Objectif : ' + g.name, cat: S.categories.includes('Épargne') ? 'Épargne' : 'Autre', amount: v.amt, date: String(today()), status: 'Payé', isFixed: false, isDivided: false }), false);
      saveUser(); render();
      toast(goalInfo(g).done ? '🎉 Bravo, objectif « ' + g.name + ' » atteint !' : '+' + eur(v.amt) + ' pour ' + g.name);
    } });
  if (!isSavAcc()) $('f_amt').closest('label').insertAdjacentHTML('afterend', `<label class="chk"><input type="checkbox" id="g-out">L'enlever aussi de « ${esc(accName())} » (ajoute une dépense)</label>`);
}

/* ============================== CRÉDITS ==============================
   Rattachés au compte bancaire qui paie la mensualité (partagés avec ses membres).
   Mensualité calculée (prêt amortissable à taux fixe) + assurance ; ajoutée aux charges fixes jusqu'à la dernière échéance. */
const LOAN_KINDS = { immo: ['Immobilier', 'home'], auto: ['Auto / moto', 'bus'], conso: ['Consommation', 'cart'], etud: ['Étudiant', 'leaf'], travaux: ['Travaux', 'tag'], autre: ['Autre', 'bank'] };
const loans = () => S.loans = S.loans || [];
const kAdd = (k, n) => { const d = keyDate(k); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const kDiff = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
function loanCalc(l, atK = nowK()) {
  const C = num(l.capital), n = Math.max(1, Math.round(num(l.months))), r = num(l.rate) / 1200, ins = num(l.ins);
  const M = num(l.pay) > 0 ? num(l.pay) : r ? C * r / (1 - Math.pow(1 + r, -n)) : C / n;
  const rem = k => { if (k <= 0) return C; if (k >= n) return 0; return r ? Math.max(0, C * Math.pow(1 + r, k) - M * (Math.pow(1 + r, k) - 1) / r) : Math.max(0, C - M * k); };
  const paid = Math.min(n, Math.max(0, kDiff(l.start, atK) + 1)), left = rem(paid);
  const interest = Math.max(0, M * n - C), interestPaid = Math.max(0, M * paid - (C - left));
  return { C, n, r, M, ins, total: M + ins, rem, paid, left, interest, interestPaid, insTotal: ins * n, cost: interest + ins * n, end: kAdd(l.start, n - 1), p: C > 0 ? (C - left) / C * 100 : 0 };
}
function loanTplSync(l, k = nowK()) {
  const c = loanCalc(l), name = (LOAN_KINDS[l.kind]?.[0] ? 'Crédit ' : '') + l.name;
  const t = S.templates.expenses.find(x => x.tmplId === l.tmplId);
  const fields = { name, amount: Math.round(c.total * 100) / 100, date: String(l.day || ''), cat: S.categories.includes('Banque') ? 'Banque' : 'Autre', from: l.start, until: c.end, loan: l.id };
  if (l.site) fields.site = l.site;
  if (!l.fixed) { if (t) tplDel('expenses', t.tmplId, k); delete l.tmplId; return; }
  if (t) { Object.assign(t, fields); if (!l.site) delete t.site; monthsFrom(k).forEach(mk => { const mm = S.months[mk], has = mm.expenses.find(x => x.tmplId === t.tmplId), inR = mk >= l.start && mk <= c.end;
      if (has && !inR && has.status !== 'Payé') mm.expenses = mm.expenses.filter(x => x !== has); else if (!has && inR) mm.expenses.push(instance('expenses', t)); });
    syncTpl('expenses', t, ['name', 'amount', 'date', 'cat', 'site'], k); }
  else { const nt = Object.assign({ tmplId: uid(), isDivided: false }, fields); l.tmplId = nt.tmplId; tplAdd('expenses', nt, k); }
}
function loansHTML() {
  if (isSavAcc()) return '';
  const L = loans(), cs = L.map(l => [l, loanCalc(l)]), active = cs.filter(([, c]) => c.left > 0);
  return `<section class="card" aria-label="Mes crédits" style="display:flex;flex-direction:column;gap:2px">
    <div class="ch"><h2>Mes crédits ${tip('crédits', 'Mes crédits', 'Les prêts remboursés depuis « ' + esc(accName()) + ' ». La mensualité (avec assurance) peut être ajoutée automatiquement aux charges fixes, jusqu\'à la dernière échéance. Calcul pour un prêt classique à taux fixe : vérifie avec ton tableau d\'amortissement.', 'rt')}</h2><button class="btn sm" data-a="loan-new">${svg('plus', 16)} Crédit</button></div>
    ${active.length ? `<div class="tiles ltot" style="margin:4px 0 10px"><div class="kp" style="box-shadow:none;background:var(--soft)"><span>Reste à rembourser</span><b class="num">${eur(sum(active, ([, c]) => c.left))}</b></div><div class="kp" style="box-shadow:none;background:var(--soft)"><span>Mensualités</span><b class="num">${eur(sum(active, ([, c]) => c.total))}</b><small>par mois, assurance comprise</small></div></div>` : ''}
    ${cs.map(([l, c]) => { const [kl, ic] = LOAN_KINDS[l.kind] || LOAN_KINDS.autre, done = c.left <= 0, notYet = nowK() < l.start;
      return `<div class="row" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px 6px"><button class="rowb" data-a="loan-open" data-id="${l.id}">${l.site ? ico({ cat: 'Banque', site: l.site }, 'expenses') : `<span class="ico" style="--c:#6366F1">${svg(ic)}</span>`}<span class="rt"><span class="rn">${esc(l.name)}</span><span class="rs">${esc(kl)}${l.bank ? ' · ' + esc(l.bank) : ''} · ${String(num(l.rate)).replace('.', ',')} % · ${done ? 'remboursé ✓' : notYet ? 'commence ' + mlab(l.start).toLowerCase() : 'fin ' + mlab(c.end).toLowerCase()}</span></span>
        <span class="ra" style="text-align:right"><b class="num">${done ? '0 €' : eur0(c.left)}</b><span class="rs" style="display:block">${eur(c.total)} / mois</span></span></button>
        <div class="bar" style="margin:0 6px"><i style="width:${c.p}%;--c:${done ? 'var(--ok)' : 'var(--acc)'}"></i></div>
        <span class="note" style="font-size:12px;padding:0 6px">${Math.round(c.p)} % remboursé · échéance ${Math.min(c.paid, c.n)} / ${c.n}</span></div>`; }).join('')
      || '<p class="empty">Ajoute tes prêts (immobilier, auto, conso…) pour voir ce qu\'il reste à rembourser, les intérêts et la date de fin.</p>'}
  </section>`;
}
function loanDialog(id) {
  const l = id ? loans().find(x => x.id === id) : null;
  formDialog({ title: l ? 'Modifier · ' + l.name : 'Nouveau crédit', intro: l ? '' : 'Les infos sont sur ton offre de prêt ou ton tableau d\'amortissement.',
    fields: [{ id: 'name', label: 'Nom', value: l?.name || '', ph: 'ex. Prêt voiture' },
      { id: 'kind', label: 'Type', type: 'select', options: Object.values(LOAN_KINDS).map(x => x[0]), value: LOAN_KINDS[l?.kind || 'conso'][0] },
      { id: 'bank', label: 'Organisme (facultatif)', value: l?.bank || '', ph: 'ex. Crédit Agricole' },
      { id: 'capital', label: 'Montant emprunté', type: 'num', value: l?.capital, ph: 'ex. 15000' },
      { id: 'rate', label: 'Taux annuel (TAEG ou nominal, en %)', type: 'num', value: l?.rate, ph: 'ex. 4,5' },
      { id: 'months', label: 'Durée en mois', type: 'num', value: l?.months, ph: 'ex. 60 (= 5 ans)' },
      { id: 'start', label: 'Première échéance (mois)', value: l?.start || nowK() },
      { id: 'day', label: 'Jour du prélèvement', value: l?.day || '', ph: 'ex. 5' },
      { id: 'ins', label: 'Assurance par mois (facultatif)', type: 'num', value: l?.ins, ph: '0' },
      { id: 'pay', label: 'Mensualité hors assurance (si tu la connais)', type: 'num', value: l?.pay, ph: 'calculée automatiquement', hint: 'Laisse vide : l\'app la calcule. Remplis-la si ton contrat indique un montant un peu différent.' }],
    onDelete: l ? () => { if (!confirm('Supprimer ce crédit ? Sa mensualité sera retirée des charges fixes à partir de ce mois.')) return; mutate(() => { if (l.tmplId) tplDel('expenses', l.tmplId, nowK()); S.loans = loans().filter(x => x.id !== id); }, 'Crédit supprimé'); } : null,
    onSave: v => {
      if (!v.name) { toast('Donne un nom au crédit'); return false; }
      if (!(v.capital > 0) || !(v.months >= 1)) { toast('Montant et durée obligatoires'); return false; }
      if (!/^\d{4}-\d{2}$/.test(v.start)) { toast('Choisis le mois de la première échéance'); return false; }
      const kind = Object.keys(LOAN_KINDS).find(k => LOAN_KINDS[k][0] === v.kind) || 'autre', dd = parseInt(v.day);
      const o = { name: v.name, kind, bank: v.bank, site: v.bank ? guessSite(v.bank) || '' : '', capital: v.capital, rate: num(v.rate), months: Math.round(v.months), start: v.start, day: dd >= 1 && dd <= 31 ? dd : '', ins: num(v.ins), pay: num(v.pay) || 0, fixed: $('l-fix') ? $('l-fix').checked : true };
      mutate(() => { let x = l; if (x) Object.assign(x, o); else { x = Object.assign({ id: uid() }, o); loans().push(x); } loanTplSync(x); }, l ? 'Crédit modifié' : 'Crédit ajouté : ' + v.name);
      if (!l) setTimeout(() => loanView(loans()[loans().length - 1].id), 50);
    } });
  $('f_start').type = 'month';
  $('f_pay').closest('label').insertAdjacentHTML('afterend', `<label class="chk"><input type="checkbox" id="l-fix" ${!l || l.fixed ? 'checked' : ''}>Ajouter la mensualité à mes charges fixes (jusqu'à la fin du crédit)</label>`);
}
function loanView(id) {
  const l = loans().find(x => x.id === id); if (!l) return; const c = loanCalc(l);
  const years = []; let k = l.start, i = 0;
  while (i < c.n) { const y = k.slice(0, 4); let cap = 0, it = 0, n = 0; while (i < c.n && k.slice(0, 4) === y) { const before = c.rem(i), after = c.rem(i + 1); cap += before - after; it += c.M - (before - after); n++; i++; k = kAdd(k, 1); } years.push([y, n, cap, it, c.rem(i)]); }
  const d = $('dlg'); d.onclick = null;
  d.innerHTML = `<div class="dw" style="max-height:86vh;overflow:auto"><div class="dh"><h2>${esc(l.name)}</h2><button class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    <div class="tiles ltiles" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      <div class="kp" style="box-shadow:none;background:var(--soft)"><span>Reste à rembourser</span><b class="num">${eur(c.left)}</b><small>${Math.round(c.p)} % remboursé</small></div>
      <div class="kp" style="box-shadow:none;background:var(--soft)"><span>Mensualité</span><b class="num">${eur(c.total)}</b><small>${c.ins ? eur(c.M) + ' + ' + eur(c.ins) + ' assurance' : 'sans assurance'}</small></div>
      <div class="kp" style="box-shadow:none;background:var(--soft)"><span>Dernière échéance</span><b>${mlab(c.end)}</b><small>${Math.max(0, c.n - c.paid)} mois restants</small></div>
      <div class="kp" style="box-shadow:none;background:var(--soft)"><span>Coût total du crédit</span><b class="num">${eur(c.cost)}</b><small>intérêts ${eur(c.interest)}${c.ins ? ' + assurance ' + eur(c.insTotal) : ''}</small></div>
    </div>
    <p class="note" style="font-size:13px">Emprunté : <b>${eur(c.C)}</b> à ${String(num(l.rate)).replace('.', ',')} % sur ${c.n} mois${c.n >= 12 ? ' (' + (c.n / 12).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' ans)' : ''}. Intérêts déjà payés : ${eur(c.interestPaid)}.${l.fixed ? ' Mensualité incluse dans tes charges fixes.' : ''}</p>
    <div class="tw"><table class="tpl" style="font-size:13px"><thead><tr><th>Année</th><th style="text-align:right">Capital</th><th style="text-align:right">Intérêts</th><th style="text-align:right">Reste dû</th></tr></thead><tbody>
      ${years.map(([y, n, cap, it, rest]) => `<tr${y === String(new Date().getFullYear()) ? ' style="background:var(--acc-s)"' : ''}><td>${y}${n < 12 ? ` <small style="color:var(--mute)">(${n} mois)</small>` : ''}</td><td class="num" style="text-align:right">${eur0(cap)}</td><td class="num" style="text-align:right">${eur0(it)}</td><td class="num" style="text-align:right">${eur0(rest)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="dact"><button class="btn" data-ed>Modifier</button><button class="btn p" data-x>Fermer</button></div></div>`;
  d.onclick = e => { if (e.target.closest('[data-x]')) d.close(); if (e.target.closest('[data-ed]')) { d.close(); loanDialog(id); } };
  d.showModal();
}
