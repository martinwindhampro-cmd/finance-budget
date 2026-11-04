
/* ============================== DÉPENSES COMMUNES EN COMPENSATION (façon Tricount) ==============================
   A doit 46 € à B. A paie 10 € de courses communes : la part de B (5 €) est déduite → A ne doit plus que 41 €.
   Si c'est B (celui qui a avancé) qui paie, la part de A s'ajoute → A doit 51 €.
   Chaque dépense commune crée une ligne de dépense dans les DEUX comptes, directement :
   • chez celui qui a payé : le montant payé (sort du compte), sa part seulement compte dans ses budgets ;
   • chez l'autre : sa part, « déduite d'une avance » (rien ne sort de son compte, mais elle compte dans ses budgets).
   La ligne de compensation (dans l'avance) : amount = + déduit / − ajouté ; tot, part, side ('L' a avancé, 'B' rembourse),
   v (version), lines { L|B : { id, acc, k, v } } → chaque appli tient à jour la ligne de SON compte.                 */
const compOpen = e => !e.d.arch && !e.d.closed && !(e.d.invite && e.d.invite.status !== 'accepted') && debtInfo(e.d).t > 0;
// L'avance en cours entre le compte qui paie et un participant du partage (ligne 'a:compte', 'u:uid' ou un nom)
function compFind(payAcc, rp, who) {
  const other = s => rp.startsWith('a:') ? (s.kind === 'acc' && s.acc === rp.slice(2)) || (s.kind === 'user' && mine(s.uid) && s.acc === rp.slice(2))
    : rp.startsWith('u:') ? s.kind === 'user' && s.uid === rp.slice(2)
    : s.kind === 'text' && who && String(s.who || '').trim().toLowerCase() === String(who).trim().toLowerCase();
  const L = allDebts().filter(compOpen).map(e => {
    const L_ = lenderOf(e.d, e.home.acc), B_ = borrowerOf(e.d);
    if (borrowerAcc(e) === payAcc && other(L_)) return { e, dir: 1, side: 'B' };   // celui qui paie doit de l'argent à l'autre → on déduit
    if (lenderAcc(e) === payAcc && other(B_)) return { e, dir: -1, side: 'L' };    // l'autre doit déjà à celui qui paie → on ajoute
    return null;
  }).filter(Boolean).filter(x => x.dir === -1 || debtInfo(x.e.d).left > 0);
  return L.sort((a, b) => (b.e.d.at || 0) - (a.e.d.at || 0))[0] || null;
}
const compLabel = p => (p.label || 'Dépense commune') + (p.tot ? ' (' + eur(p.tot) + ')' : '');
// Montant inscrit dans l'avance : la part de l'autre, déduite (plafonnée à ce qui reste dû) ou ajoutée
function compAmount(d, side, part, exceptId) {
  if (side === 'L') return -part;
  const left = debtInfo(Object.assign({}, d, { payments: (d.payments || []).filter(p => p.id !== exceptId) })).left;
  return Math.min(part, Math.round(left * 100) / 100);
}
async function compAdd(e, o) {
  const p = { id: uid(), comp: 1, label: o.label, tot: o.tot, part: o.part, half: !!o.half, side: o.side, payer: o.payer || '', cat: o.cat || 'Autre', mk: o.mk ?? 'both',
    date: o.date, k: o.date.slice(0, 7), v: 1, lines: o.lines || {}, from: '', fromName: '', to: '', toName: '', by: currentUser.uid };
  p.amount = compAmount(e.d, o.side, o.part);
  await updateDebt(e, x => { (x.payments = x.payments || []).push(p); compDone(x); });
  await compSync(e.d.id);
  return p;
}
const compDone = x => { const i = debtInfo(x); if (i.done) { x.doneAt = x.doneAt || Date.now(); delete x.auto; } else delete x.doneAt; };

/* ---------- Lignes de dépense dans les comptes (créées / mises à jour par l'appli qui a accès au compte) ---------- */
function compLine(p, side, id, debtId) {
  const payer = side === p.side, base = { id, date: String(+p.date.slice(8, 10)), status: 'Payé', cat: p.cat || 'Autre', isFixed: false, isDivided: false, comp: debtId };
  return payer ? Object.assign(base, { name: p.label || 'Dépense commune', amount: p.tot, share: Math.round((p.tot - p.part) * 100) / 100, cpdebt: debtId, cpid: p.id })
    : Object.assign(base, { name: (p.label || 'Dépense commune') + (p.payer ? ' (payé par ' + p.payer + ')' : ''), amount: p.part, nc: 1 });
}
// Déplace / met à jour / retire une ligne d'un mois d'un de mes comptes
async function lineSet(acc, oldK, newK, type, id, make) {
  let cur = null;                                                   // la ligne retirée de l'ancien mois (pour la recréer dans le nouveau)
  if (oldK && oldK !== newK) await onAcc(acc, oldK, m => { const i = m[type].findIndex(x => x.id === id); if (i >= 0) cur = m[type].splice(i, 1)[0]; });
  if (!newK) return;
  await onAcc(acc, newK, m => { const i = m[type].findIndex(x => x.id === id), x = make(i >= 0 ? m[type][i] : cur); if (!x) return; if (i >= 0) m[type][i] = x; else m[type].unshift(x); });
}
let compBusy = false, compLast = 0, compAgain = false;
async function compSync(only) {
  if (!loaded || !currentUser) return;
  if (compBusy) { compAgain = true; return; } compBusy = true;
  try {
    for (const e of allDebts()) {
      if (only && e.d.id !== only) continue;
      if ((e.d.payments || []).some(p => p.comp && p.mk === undefined)) await updateDebt(e, x => { (x.payments || []).forEach(compMigrate); });
      if ((e.d.payments || []).some(p => p.comp && p.mk === undefined)) e.d.payments.forEach(compMigrate);
      for (const p of (e.d.payments || []).filter(p => p.comp && p.mk)) {
        for (const side of ['L', 'B']) {
          if ((p.mk === 'other' && side === p.side) || p.nol?.[side]) continue;          // nol : ligne détachée à la main
          const acc = side === 'L' ? lenderAcc(e) : borrowerAcc(e); if (!myAcc(acc)) continue;
          const ln = (p.lines || {})[side]; if (ln && ln.v === p.v && ln.acc === acc) continue;
          // on « réserve » la mise à jour dans l'avance (évite les doublons quand deux appareils la voient en même temps)
          let job = null;
          await updateDebt(e, x => { const q = (x.payments || []).find(z => z.id === p.id); if (!q) return; q.lines = q.lines || {}; const c = q.lines[side];
            if (c && c.v === q.v && c.acc === acc) return;
            job = { old: c ? Object.assign({}, c) : null, q: JSON.parse(JSON.stringify(q)) };
            q.lines[side] = { id: c?.id || uid(), acc, k: q.date.slice(0, 7), v: q.v }; job.ln = Object.assign({}, q.lines[side]); });
          if (!job) continue;
          if (job.old && job.old.acc !== acc && myAcc(job.old.acc)) await lineSet(job.old.acc, job.old.k, null, 'expenses', job.old.id);
          await lineSet(acc, job.old && job.old.acc === acc ? job.old.k : null, job.ln.k, 'expenses', job.ln.id, cur => Object.assign(cur || {}, compLine(job.q, side, job.ln.id, e.d.id)));
        }
      }
    }
  } catch (er) { console.warn('Dépenses communes', er); }
  finally { compBusy = false; compLast = Date.now(); if (compAgain) { compAgain = false; setTimeout(() => compSync(), 50); } }
}
function compSyncSoon() { if (Date.now() - compLast > 8000) setTimeout(() => compSync(), 1800); }

/* ---------- Saisie depuis la fiche d'une avance ---------- */
function compDialog(id, pid) {
  const e = findDebt(id); if (!e) return; const d = e.d, p0 = pid ? (d.payments || []).find(p => p.id === pid) : null;
  const i = debtInfo(Object.assign({}, d, { payments: (d.payments || []).filter(p => p.id !== pid) }));
  const Ln = sideLabel(lenderOf(d, e.home.acc)) || 'celui qui a avancé', Bn = sideLabel(borrowerOf(d)) || 'celui qui rembourse';
  const O = [Bn + ' (doit l\'argent)', Ln + ' (a avancé)'], MK = ['Oui, dans les deux comptes', 'Seulement chez l\'autre (j\'ai déjà noté la mienne)', 'Non'];
  formDialog({ title: '↔ ' + (p0 ? 'Modifier la dépense commune' : 'Dépense commune · ' + esc(d.name)),
    intro: p0 ? 'La modification s\'applique tout de suite, des deux côtés (les lignes de dépense suivent).' : `Reste ${eur(i.left)} à rembourser. Une dépense payée pour vous deux vient en déduction, sans virement : si ${esc(Bn)} paie, sa dette baisse ; si ${esc(Ln)} paie, elle augmente.`,
    fields: [{ id: 'label', label: 'C\'était quoi ?', value: p0?.label || '', ph: 'ex. Courses, Essence' }, { id: 'tot', label: 'Montant total payé', type: 'num', value: p0?.tot ?? '', ph: 'ex. 10' },
      { id: 'who', label: 'Qui a payé ?', type: 'select', options: O, value: p0?.side === 'L' ? O[1] : O[0] }, { id: 'part', label: 'Part de l\'autre (vide = la moitié)', type: 'num', value: p0 && !p0.half ? p0.part : '', ph: 'ex. 5' },
      { id: 'date', label: 'Date', value: p0?.date || todayISO() },
      { id: 'cat', label: 'Catégorie', type: 'select', options: S.categories, value: p0?.cat || (S.categories.includes('Alimentation') ? 'Alimentation' : S.categories[0]) },
      ...(p0 ? [] : [{ id: 'mk', label: 'Ajouter la dépense dans les comptes ?', type: 'select', options: MK, value: MK[0] }])],
    onDelete: p0 ? () => payDelete(id, pid).then(() => setTimeout(() => findDebt(id) && debtView(id), 400)) : null,
    onSave: v => {
      const tot = Math.round(num(v.tot) * 100) / 100; if (!(tot > 0)) { toast('Indique le montant payé'); return false; }
      const half = !(v.part > 0), part = half ? Math.round(tot * 50) / 100 : Math.round(v.part * 100) / 100; if (part > tot) { toast('La part ne peut pas dépasser le montant'); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) { toast('Choisis une date'); return false; }
      const side = v.who === O[0] ? 'B' : 'L', payer = side === 'B' ? Bn : Ln, label = v.label || 'Dépense commune';
      if (side === 'B' && part > i.left + 0.001 && !confirm(`La part (${eur(part)}) dépasse ce qui reste dû (${eur(i.left)}). L'avance sera soldée. Continuer ?`)) return false;
      const end = () => { const n = findDebt(id); toast((side === 'B' ? '−' : '+') + eur(part) + ' · reste ' + eur(n ? debtInfo(n.d).left : 0)); render(); setTimeout(() => findDebt(id) && debtView(id), 300); };
      if (p0) return void updateDebt(e, x => { const q = (x.payments || []).find(z => z.id === pid); if (!q) return;
          Object.assign(q, { label, tot, part, half, side, payer, cat: v.cat, date: v.date, k: v.date.slice(0, 7), v: (q.v || 1) + 1, ed: { by: currentUser.uid, at: Date.now() } }); q.amount = compAmount(x, side, part, pid); compDone(x); })
        .then(() => compSync(id)).then(() => { warnMembers(e, 'Dépense commune modifiée : ' + compLabel({ label, tot }) + ' · « ' + d.name + ' »'); end(); }).catch(er => toast('⚠ ' + (er.code || er.message)));
      compAdd(e, { label, tot, part, half, side, payer, cat: v.cat, date: v.date, mk: v.mk === MK[0] ? 'both' : v.mk === MK[1] ? 'other' : false }).then(end).catch(er => toast('⚠ ' + (er.code || er.message)));
    } });
  $('f_date').type = 'date';
}

/* ---------- Modifier un remboursement (montant, date, libellé) sans attendre l'autre ---------- */
function payEditDialog(id, pid) {
  const e = findDebt(id); if (!e) return; const p = (e.d.payments || []).find(x => x.id === pid); if (!p) return;
  if (p.comp) return compDialog(id, pid);
  if (p.by && p.by !== currentUser.uid) return toast('Saisi par ' + shortName(e.d.emails?.[p.by] || '') + ' : c\'est à cette personne de le modifier (ses comptes ont les mouvements)');
  formDialog({ title: 'Modifier le remboursement', intro: 'S\'applique tout de suite, sans attendre l\'accord de l\'autre. Les mouvements des comptes suivent.',
    fields: [{ id: 'amt', label: 'Montant', type: 'num', value: p.amount }, { id: 'date', label: 'Date', value: p.date }, { id: 'label', label: 'Libellé', value: p.label || '' }],
    onDelete: () => payDelete(id, pid).then(() => setTimeout(() => findDebt(id) && debtView(id), 400)),
    onSave: v => {
      const amt = Math.round(num(v.amt) * 100) / 100; if (!(amt > 0)) { toast('Indique un montant'); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) { toast('Choisis une date'); return false; }
      payEdit(e, p, { amount: amt, date: v.date, label: v.label.trim() || p.label || 'Remboursement' }).then(() => { toast('Remboursement modifié'); render(); setTimeout(() => debtView(id), 300); })
        .catch(er => toast('⚠ ' + (er.code || er.message)));
    } });
  $('f_date').type = 'date';
}
async function payEdit(e, p, n) {
  const k = n.date.slice(0, 7), dd = String(+n.date.slice(8, 10)), fix = x => Object.assign(x, { amount: n.amount, date: dd, name: n.label });
  const jobs = [];
  if (p.inc && myAcc(p.to)) jobs.push(lineSet(p.to, p.k, k, 'incomes', p.inc, x => x ? fix(x) : null));
  if (p.exp && myAcc(p.from)) jobs.push(lineSet(p.from, p.k, k, 'expenses', p.exp, x => x ? fix(x) : null));
  let note = '';
  const conf = p.toUser && (p.pend || p.rej || p.okAt);                // « J'ai remboursé » (sans virement dans sa boîte)
  if (conf && p.okAt) note = ' (à reconfirmer par ' + shortName(p.toUser) + ')';
  else if (p.xid && p.toUser && !conf) { if (xfStatus(p.xid) === 'sent') jobs.push(db.collection('transfers').doc(p.xid).update({ amount: n.amount, date: dd, label: n.label })); else note = ' (déjà reçu chez l\'autre : seul ton côté change)'; }
  await Promise.all(jobs.map(j => j.catch(er => console.warn(er))));
  await updateDebt(e, x => { const q = (x.payments || []).find(z => z.id === p.id); if (!q) return; Object.assign(q, n, { k, ed: { by: currentUser.uid, at: Date.now() } }); if (conf && q.okAt) { q.pend = 1; q.re = 1; q.at = Date.now(); } if (conf) delete q.rej; compDone(x); });
  warnMembers(e, 'Remboursement modifié : ' + eur(n.amount) + ' · « ' + e.d.name + ' »' + note);
  if (note) toast('ℹ' + note);
}

// Ligne d'une compensation dans la fiche de l'avance
function compRowHTML(p, d) {
  const ded = p.amount > 0;
  return `<div class="row prow" style="padding:8px 4px"><button class="rowb" data-pedit="${p.id}" style="flex:1;min-width:0"><span class="ico sm" style="--c:${ded ? '#0EA5E9' : '#F59E0B'}">${svg('swap', 17)}</span><span class="rt"><span class="rn">${esc(compLabel(p))}</span><span class="rs">${fmtD(p.date)} · dépense commune${p.payer ? ' payée par ' + esc(p.payer) : ''} · ${ded ? 'déduite' : 'ajoutée'}${p.ed ? ' · modifiée' + (p.ed.by !== currentUser.uid ? ' par ' + esc(shortName(d.emails?.[p.ed.by] || '')) : '') : p.by && p.by !== currentUser.uid ? ' · saisie par ' + esc(shortName(d.emails?.[p.by] || '')) : ''}</span></span><b class="num" style="color:${ded ? 'var(--ok)' : 'var(--warn)'}">${ded ? '−' : '+'}${eur(Math.abs(p.amount))}</b></button><button class="x" data-del="${p.id}" aria-label="Supprimer">${svg('trash', 15)}</button></div>`;
}

/* ---------- Fiche d'une dépense : « Dépense commune », tout au même endroit ----------
   • Partagée : le compte garde le montant payé, mes catégories / graphiques ne comptent que ma part. Rien d'autre.
   • Déduire : la part de l'autre fait baisser ce que je lui dois (je choisis la dette s'il y en a plusieurs).
   • Avance : la part de l'autre devient une nouvelle avance qu'il me rembourse, liée à cette dépense.        */
function compCands() {          // mes dettes en cours (ce compte doit de l'argent) : la part de l'autre vient en déduction
  return allDebts().filter(compOpen).map(e => { const la = lenderAcc(e), ba = borrowerAcc(e), i = debtInfo(e.d);
    return ba === active && la !== active && (i.left > 0 || e.d.id === P?.comp) ? { e, who: sideLabel(lenderOf(e.d, e.home.acc)), left: i.left } : null; }).filter(Boolean);
}
const cmMode = x => x?.cpdebt ? 'debt' : x?.newdebt ? 'new' : x?.share != null ? 'half' : 'none';
const cmWhoOpts = () => allAccs().filter(a => a !== active).map(a => ['a:' + a, '🏦 ' + ACC[a].name])
  .concat(linkedPeople().filter(p => p.uid).map(p => ['u:' + p.uid, '👤 ' + shortName(p.email)]), [['txt', 'Quelqu\'un d\'autre (juste un nom)']]);
const sideKey = s => s.kind === 'acc' ? 'a:' + s.acc : s.kind === 'user' ? 'u:' + s.uid : 'txt';
function cmVals() { const d = P.d, a = parseAmt(d.amount), part = parseAmt(d.cmPart) > 0 ? Math.min(a, Math.round(parseAmt(d.cmPart) * 100) / 100) : Math.round(a * 50) / 100; return { a, part, mine: Math.round((a - part) * 100) / 100 }; }
function cmInfo() {
  const M = P.cm || 'none', v = cmVals(), d = P.d;
  if (M === 'half') return `Le compte garde <b>${eur(v.a)}</b> payés. Tes catégories et graphiques ne comptent que ta part : <b>${eur(v.mine)}</b>. Aucune dette.`;
  if (M === 'debt') { const c = compCands().find(c => c.e.d.id === P.comp); return c ? `Ta part <b>${eur(v.mine)}</b> · ${esc(c.who)} : <b>${eur(v.part)}</b> déduits de ce que tu lui dois (${eur(c.left)} → ${eur(Math.max(0, c.left - v.part))})` : 'Choisis la dette à faire baisser.'; }
  if (M === 'new') { const u = String(d.cmWho || '').startsWith('u:'); return `Ta part <b>${eur(v.mine)}</b> · une avance de <b>${eur(v.part)}</b> est créée${u ? ', une demande lui est envoyée' : ''}. Elle suit cette dépense si tu la modifies.`; }
  return '';
}
function compPanelHTML() {
  const d = P.d, M = P.cm || 'none', C = compCands(), W = cmWhoOpts();
  if (M === 'new' && !d.cmWho) d.cmWho = W[0][0];
  const modes = [['none', 'Non'], ['half', 'Partagée'], ['debt', 'Déduire'], ['new', 'Avance']];
  return `<div class="fl cmbox" id="cmbox">Dépense commune <span class="note" style="font-weight:500;font-size:12px">payée par toi pour vous deux</span>
    <div class="seg" role="group" aria-label="Dépense commune">${modes.map(m => `<button class="${M === m[0] ? 'on' : ''}" data-p="cm" data-v="${m[0]}">${m[1]}</button>`).join('')}</div>
    ${M === 'debt' ? (C.length ? `<div class="chips">${C.map(c => `<button class="chip${P.comp === c.e.d.id ? ' on' : ''}" data-p="comp" data-v="${esc(c.e.d.id)}">↔ ${esc(c.who)} · ${esc(c.e.d.name)} · tu lui dois ${eur0(c.left)}</button>`).join('')}</div>` : '<small>Aucune dette en cours depuis ce compte. Choisis « Avance » si l\'autre doit te rembourser.</small>') : ''}
    ${M === 'new' ? `<label class="fl" style="margin:0">Qui te doit sa part ?<select class="in" data-pf="cmWho">${W.map(w => `<option value="${w[0]}" ${d.cmWho === w[0] ? 'selected' : ''}>${esc(w[1])}</option>`).join('')}</select></label>${d.cmWho === 'txt' ? `<input class="in" data-pf="cmName" placeholder="Son nom" value="${esc(d.cmName || '')}">` : ''}` : ''}
    ${P.cmDefOn ? `<small>↺ Ton choix habituel pour ${esc(d.cat)} · <button class="lnk" data-p="cmforget">ne plus le proposer</button></small>` : ''}
    ${M !== 'none' ? `<label class="fl" style="margin:0">Part de l'autre<input class="in" inputmode="decimal" data-pf="cmPart" placeholder="la moitié" value="${esc(d.cmPart ?? '')}"></label><small id="cminfo">${cmInfo()}</small>` : ''}</div>`;
}
const cmInfoPaint = () => { const el = $('cminfo'); if (el && P) el.innerHTML = cmInfo(); };
// Détacher une dette « déduite » (la ligne de l'autre suit la suppression, avec son accord si l'avance est partagée)
async function detachComp(xid, k, did, cpid) {
  const e0 = findDebt(did);
  if (e0 && cpid) { await updateDebt(e0, d => { const q = (d.payments || []).find(z => z.id === cpid); if (q && q.lines) Object.keys(q.lines).forEach(s => { if (q.lines[s].id === xid) { delete q.lines[s]; q.nol = Object.assign({}, q.nol, { [s]: true }); } }); }); await payDelete(did, cpid); }
  mutate(() => { const y = month(k).expenses.find(e => e.id === xid); if (y) { delete y.share; delete y.cpdebt; delete y.cpid; delete y.comp; } }, false);
}
// Retirer l'avance créée pour cette dépense (seulement si rien n'a encore été remboursé)
async function detachNew(xid, k, did) {
  const e = findDebt(did) || (PDEBTS.find(d => d.id === did) && { d: PDEBTS.find(d => d.id === did), home: { shared: did } });
  mutate(() => { const y = month(k).expenses.find(z => z.id === xid); if (y) { delete y.newdebt; delete y.share; } }, false);
  if (!e) return;
  if ((e.d.payments || []).length) return toast('ℹ L\'avance « ' + e.d.name + ' » a déjà des remboursements : elle est gardée');
  if (e.home.shared) { if (e.d.invite && e.d.invite.status !== 'accepted') return declinedAction(did, 'drop'); return toast('ℹ L\'avance « ' + e.d.name + ' » est déjà acceptée : supprime-la depuis Budgets si besoin'); }
  if (e.home.acc === active) return mutate(() => { S.debts = debts().filter(x => x.id !== did); }, false);
  await db.runTransaction(async tx => { const ref = accDoc(e.home.acc), s0 = await tx.get(ref), o = J(s0.data().meta) || {}; o.debts = (o.debts || []).filter(x => x.id !== did); tx.update(ref, { meta: canon(o), updatedAt: Date.now(), updatedBy: currentUser.uid }); });
}
async function compPanelSave(xid, k, o, prev) {
  const get = () => month(k).expenses.find(e => e.id === xid), x = get(); if (!x) return;
  const tot = num(x.amount), half = !(parseAmt(o.part) > 0), part = half ? Math.round(tot * 50) / 100 : Math.min(tot, Math.round(parseAmt(o.part) * 100) / 100), mine = Math.round((tot - part) * 100) / 100;
  const date = k + '-' + String(parseInt(x.date) || today()).padStart(2, '0'), setX = f => mutate(() => { const y = get(); if (y) f(y); }, false);
  // ce qui ne s'applique plus est détaché
  if (prev.cpdebt && (o.mode !== 'debt' || o.comp !== prev.cpdebt)) await detachComp(xid, k, prev.cpdebt, prev.cpid);
  const pe = prev.newdebt && (findDebt(prev.newdebt) || (PDEBTS.find(d => d.id === prev.newdebt) && { d: PDEBTS.find(d => d.id === prev.newdebt), home: { shared: prev.newdebt } }));
  if (prev.newdebt && (o.mode !== 'new' || !pe || sideKey(borrowerOf(pe.d)) !== o.who)) await detachNew(xid, k, prev.newdebt);
  if (o.mode === 'none') { setX(y => { delete y.share; }); return render(); }
  if (o.mode === 'half') { setX(y => { y.share = mine; y.isDivided = false; }); return render(); }
  if (o.mode === 'debt') {
    const e = o.comp && findDebt(o.comp); if (!e) { setX(y => { y.share = mine; }); return toast('Choisis la dette à faire baisser'); }
    if (prev.cpdebt === o.comp && prev.cpid) {
      await updateDebt(e, d => { const q = (d.payments || []).find(z => z.id === prev.cpid); if (!q) return;
        Object.assign(q, { label: x.name, tot, part, half, cat: x.cat, date, k, v: (q.v || 1) + 1, ed: { by: currentUser.uid, at: Date.now() } }); q.amount = compAmount(d, q.side, part, prev.cpid);
        if (q.lines?.[q.side]?.id === xid) Object.assign(q.lines[q.side], { v: q.v, k, acc: active }); compDone(d); });
      setX(y => { y.share = mine; y.isDivided = false; }); await compSync(o.comp); return render();
    }
    if (part > debtInfo(e.d).left + 0.001) toast('ℹ La part (' + eur(part) + ') dépasse ce que tu dois : la dette est soldée');
    const p = await compAdd(e, { label: x.name, tot, part, half, side: 'B', payer: accName(), cat: x.cat, date, mk: 'both', lines: { B: { id: xid, acc: active, k, v: 1 } } });
    setX(y => Object.assign(y, { share: mine, cpdebt: o.comp, cpid: p.id, comp: o.comp, isDivided: false }));
    const n = findDebt(o.comp); toast('↔ ' + eur(Math.min(part, num(p.amount) || part)) + ' déduits · ' + e.d.name + ' : reste ' + eur(n ? debtInfo(n.d).left : 0)); return render();
  }
  if (o.mode === 'new') {
    if (pe && prev.newdebt && sideKey(borrowerOf(pe.d)) === o.who) {                // déjà créée : elle suit le montant et le libellé
      await updateDebt(pe, d => { d.amount = part; d.name = x.name; }); setX(y => { y.share = mine; }); return render();
    }
    const did = uid(), now = Date.now(), d = { id: did, name: x.name, amount: part, emo: '🧾', at: now, payments: [], src: { acc: active, k, id: xid } }, w = o.who || 'txt';
    if (w.startsWith('u:')) { const pp = linkedPeople().find(z => 'u:' + z.uid === w); if (!pp) return toast('Personne introuvable');
      Object.assign(d, { lender: { kind: 'user', uid: currentUser.uid, email: myEmail(), acc: active, accName: accName() }, borrower: { kind: 'user', uid: pp.uid, email: pp.email },
        invite: { status: 'pending', at: now }, members: [currentUser.uid, pp.uid], emails: { [currentUser.uid]: myEmail(), [pp.uid]: pp.email }, createdBy: currentUser.uid, updatedAt: now });
      await db.collection('pdebts').doc(did).set(d); }
    else { Object.assign(d, { lender: { kind: 'acc', acc: active, accName: accName() }, borrower: w.startsWith('a:') ? { kind: 'acc', acc: w.slice(2), accName: ACC[w.slice(2)]?.name || '' } : { kind: 'text', who: (o.name || '').trim() || 'Quelqu\'un' } });
      mutate(() => debts().push(d), false); }
    setX(y => Object.assign(y, { share: mine, newdebt: did, isDivided: false }));
    toast('🧾 Avance de ' + eur(part) + ' créée · ' + sideLabel(d.borrower) + (w.startsWith('u:') ? ' (demande envoyée)' : '')); return render();
  }
}
// Dépenses communes saisies avec la v29 (sans lignes de dépense) : on les complète
function compMigrate(p) {
  if (!p.comp || p.mk !== undefined) return false;
  const m = String(p.label || '').match(/^(.*) \(([\d\s\u00a0\u202f.,]+)\s?€\)$/);
  p.tot = m ? parseAmt(m[2].replace(/[\s\u00a0\u202f]/g, '')) : Math.abs(num(p.amount)) * 2; if (m) p.label = m[1];
  p.part = Math.abs(num(p.amount)); p.half = Math.abs(p.tot / 2 - p.part) < 0.01; p.side = num(p.amount) > 0 ? 'B' : 'L'; p.mk = 'both'; p.v = 1; p.lines = p.lines || {}; p.cat = p.cat || 'Autre';
  return true;
}

/* ---------- 1 & 2. Choix habituel par catégorie (retenu au dernier enregistrement, pré-sélectionné ensuite) ---------- */
// S.cmDef[cat] = { mode, comp?, who?, name? } : rangé dans le compte (suit sur tous tes appareils)
function cmApplyDef() {
  if (!P || !P.isNew || P.cmT || P.type !== 'expenses' || isSavAcc()) return false;
  const df = (S.cmDef || {})[P.d.cat]; P.cmDefOn = false;
  if (!df) { if (P.cm !== 'none') { P.cm = 'none'; P.comp = null; return true; } return false; }
  P.cm = df.mode; P.cmDefOn = true;
  if (df.mode === 'debt') { const C = compCands(); P.comp = C.some(c => c.e.d.id === df.comp) ? df.comp : C.length === 1 ? C[0].e.d.id : null; }
  if (df.mode === 'new') { P.d.cmWho = df.who; P.d.cmName = df.name || ''; }
  return true;
}
function cmRemember(cat, o) {
  if (!cat) return; const cur = (S.cmDef || {})[cat];
  const next = o.mode === 'none' ? null : Object.assign({ mode: o.mode }, o.mode === 'debt' ? { comp: o.comp } : {}, o.mode === 'new' ? { who: o.who, name: o.who === 'txt' ? o.name || '' : '' } : {});
  if (JSON.stringify(cur || null) === JSON.stringify(next)) return;
  mutate(() => { S.cmDef = Object.assign({}, S.cmDef); if (next) S.cmDef[cat] = next; else delete S.cmDef[cat]; if (!Object.keys(S.cmDef).length) delete S.cmDef; }, false);
}
const cmBoxPaint = () => { const el = $('cmbox'); if (el && P) el.outerHTML = compPanelHTML(); };

/* ---------- 3. Bilan par personne : toutes les avances avec quelqu'un, dans les deux sens ---------- */
function balPeople() {
  const G = {};
  allDebts().filter(e => compOpen(e) && !e.d.invite?.status?.match(/pending|declined/)).forEach(e => {
    const la = lenderAcc(e), ba = borrowerAcc(e); let other, sign;
    if (la === active && ba !== active) { other = borrowerOf(e.d); sign = 1; } else if (ba === active && la !== active) { other = lenderOf(e.d, e.home.acc); sign = -1; } else return;
    const left = debtInfo(e.d).left; if (left <= 0) return;
    const key = other.kind === 'user' && myAcc(other.acc) ? 'a:' + other.acc : other.kind === 'text' ? 'txt:' + String(other.who || '').trim().toLowerCase() : sideKey(other);
    (G[key] = G[key] || { key, who: sideLabel(other), L: [] }).L.push({ e, sign, left });
  });
  return Object.values(G).map(g => Object.assign(g, { due: sum(g.L.filter(x => x.sign > 0), x => x.left), owe: sum(g.L.filter(x => x.sign < 0), x => x.left) }))
    .map(g => Object.assign(g, { net: Math.round((g.due - g.owe) * 100) / 100 })).filter(g => g.L.length > 1);
}
function balHTML() {
  const B = balPeople(); if (!B.length) return '';
  return `<div class="dpart"><div class="dhead"><b>Bilan par personne</b><span class="note">toutes vos avances</span></div>
    ${B.map(g => `<div class="row" style="padding:6px 4px;gap:10px"><span class="avatar">${initials(g.who)}</span><span class="rt" style="flex:1;min-width:0"><span class="rn" style="white-space:normal">${esc(g.who)} · <b class="num" style="color:${g.net >= 0 ? 'var(--ok)' : 'var(--warn)'}">${g.net === 0 ? 'quittes' : (g.net > 0 ? 'te doit ' : 'tu lui dois ') + eur(Math.abs(g.net))}</b></span><span class="rs" style="white-space:normal">${g.L.length} avances${g.due && g.owe ? ' · ' + eur(g.due) + ' à recevoir, ' + eur(g.owe) + ' à rendre' : ''}</span></span>
      <button class="btn sm" data-a="bal-solde" data-id="${esc(g.key)}">Tout solder</button></div>`).join('')}</div>`;
}
function balDialog(key) {
  const g = balPeople().find(x => x.key === key); if (!g) return;
  const A = allAccs(), nm = a => ACC[a].name + (a === active ? ' (ce compte)' : ''), off = Math.min(g.due, g.owe), net = g.net;
  formDialog({ title: '⚖️ Tout solder avec ' + esc(g.who), ok: 'Solder',
    intro: `${g.L.map(x => esc(x.e.d.name) + ' : ' + (x.sign > 0 ? 'te doit ' : 'tu dois ') + eur(x.left)).join('<br>')}${off > 0 ? `<br><br>Les avances dans les deux sens se compensent : <b>${eur(off)}</b> de chaque côté, sans virement.` : ''}<br><br>${net === 0 ? 'Vous êtes quittes.' : net < 0 ? `Il te reste <b>${eur(-net)}</b> à lui verser.` : `Il te reste <b>${eur(net)}</b> à recevoir.`}`,
    fields: net === 0 ? [] : [{ id: 'acc', label: net < 0 ? 'Depuis quel compte tu paies ?' : 'Sur quel compte tu reçois ?', type: 'select', options: A.map(nm), value: nm(active) }, { id: 'date', label: 'Date', value: todayISO() }],
    onSave: v => { balSolde(g, net === 0 ? null : A.find(a => nm(a) === v.acc), net === 0 ? todayISO() : v.date).catch(er => toast('⚠ ' + (er.code || er.message))); } });
  if ($('f_date')) $('f_date').type = 'date';
}
async function balSolde(g, acc, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = todayISO();
  const mk = (amount, label) => ({ id: uid(), amount: Math.round(amount * 100) / 100, date, label, k: date.slice(0, 7), from: '', fromName: 'Compensation', to: '', toName: '', by: currentUser.uid });
  let off = Math.round(Math.min(g.due, g.owe) * 100) / 100;
  // 1. compensation des deux sens (sans mouvement)
  for (const side of [1, -1]) { let r = off;
    for (const x of g.L.filter(x => x.sign === side).sort((a, b) => (a.e.d.at || 0) - (b.e.d.at || 0))) { if (r <= 0) break; const a = Math.min(r, x.left); r = Math.round((r - a) * 100) / 100; x.left = Math.round((x.left - a) * 100) / 100;
      await updateDebt(x.e, d => { (d.payments = d.payments || []).push(mk(a, 'Compensation (bilan avec ' + g.who + ')')); compDone(d); }); } }
  // 2. le reste : un vrai remboursement, réparti sur les avances (de la plus ancienne à la plus récente)
  const net = g.net;
  if (net !== 0 && acc) for (const x of g.L.filter(x => x.sign === (net < 0 ? -1 : 1) && x.left > 0).sort((a, b) => (a.e.d.at || 0) - (b.e.d.at || 0))) {
    const e = findDebt(x.e.d.id); if (!e) continue; const L = lenderOf(e.d, e.home.acc);
    const to = net < 0 ? (lenderIsMine(L) ? { acc: lenderAcc(e) } : { user: L, acc: L.acc || '', accName: L.accName || '' }) : { acc };
    await payCreate(e.d.id, { amount: x.left, date, from: net < 0 ? acc : null, to, label: 'Remboursement ' + e.d.name }, { silent: true });
  }
  toast('⚖️ Soldé avec ' + g.who + (net ? ' · ' + eur(Math.abs(net)) + (net < 0 ? ' versés' : ' reçus') : '')); render();
}

/* ---------- 4. Anciens « ½ Partagé » → « Partagée » (le compte garde le montant payé) ---------- */
const halfOld = () => Object.entries(S.months).flatMap(([k, m]) => m.expenses.filter(e => e.isDivided && !e.xfer).map(e => ({ k, e })));
function halfOldHTML() {
  const L = halfOld(); if (!L.length) return '';
  return `<button class="btn bkbtn" data-a="half-conv">½ ${L.length} ancienne${L.length > 1 ? 's' : ''} dépense${L.length > 1 ? 's' : ''} « ½ Partagé »<small>Convertir en « Partagée » : le compte garde le montant payé</small></button>`;
}
function halfConvDialog() {
  const L = halfOld(); if (!L.length) return;
  const imp = sum(L, x => num(x.e.amount) - eff(x.e));
  const d = $('dlg'); d.onclick = null;
  d.innerHTML = `<div class="dw" style="max-height:88vh;overflow:auto"><div class="dh"><h2>½ Anciennes dépenses partagées</h2><button class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    <p class="note">Avec l'ancien « ½ Partagé », seule la moitié compte dans le solde. Converties en « Partagée », <b>le compte compte le montant entier payé</b> (comme ta banque) et tes catégories gardent ta moitié.</p>
    <p class="note">Ton solde calculé baisse de <b>${eur(imp)}</b> au total (jusqu'au prochain « solde au 1er » saisi). Fais-le si ta banque a bien débité le montant entier.</p>
    <div style="display:flex;flex-direction:column;gap:2px">${L.map(x => `<label class="row chk" style="padding:6px 4px;min-height:0"><input type="checkbox" data-hc="${x.k}|${x.e.id}" checked><span class="rt"><span class="rn">${esc(x.e.name || x.e.cat)}</span><span class="rs">${esc(mlab(x.k))}${x.e.date ? ' · le ' + x.e.date : ''}</span></span><b class="num">${eur(num(x.e.amount))}</b></label>`).join('')}</div>
    <div class="dact"><button class="btn" data-x>Annuler</button><button class="btn p" data-ok>Convertir la sélection</button></div></div>`;
  d.onclick = ev => {
    if (ev.target.closest('[data-x]')) return d.close();
    if (!ev.target.closest('[data-ok]')) return;
    const keys = [...d.querySelectorAll('[data-hc]:checked')].map(i => i.dataset.hc); d.close(); if (!keys.length) return;
    mutate(() => keys.forEach(kk => { const [k, id] = kk.split('|'), e = (S.months[k]?.expenses || []).find(x => x.id === id); if (e) { e.share = eff(e); e.isDivided = false; } }), keys.length + ' dépense' + (keys.length > 1 ? 's converties' : ' convertie'));
  };
  d.showModal();
}
