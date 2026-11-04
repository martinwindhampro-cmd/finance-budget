/* ============================== CHARGES FIXES PARTAGÉES & « J'AI REMBOURSÉ » ==============================
   1. Charge fixe partagée (collection shfix) : je propose une de mes charges fixes à une personne connectée.
      Si elle accepte, la MÊME charge fixe (nom, montant, jour, catégorie, logo) est créée chez elle, depuis le compte
      qu'elle choisit. Si c'est un virement automatique vers un compte dont elle est aussi membre (ex. compte joint),
      c'est le même virement automatique depuis son compte (recette fixe en face sur le joint).
      shfix/{id} = { members[2], emails{}, from, fromEmail, fromAcc, tmplId, to, toEmail, status pending/accepted/declined,
                     at, answeredAt, toAcc, toAccName, tpl{name, amount, date, cat, site?, img?, xfer?{acc, accName}} }
   2. « J'ai remboursé » : quand je rembourse une AUTRE personne, le remboursement est « à confirmer » (p.pend) ;
      elle confirme (la recette arrive sur le compte qu'elle choisit) ou répond « Pas reçu » (p.rej).
   3. Pastille sur l'icône de l'app (nombre de demandes à traiter).                                                    */
let SHFIX = [];
function shfixListen() {
  return db.collection('shfix').where('members', 'array-contains', currentUser.uid).onSnapshot(q => {
    SHFIX = q.docs.map(d => ({ id: d.id, ...d.data() }));
    shfixNotify();
    if (loaded) { renderChrome(); if (['messages', 'parametres', 'accueil'].includes(UI.view)) render(); }
  }, e => console.warn('Charges fixes partagées', e.code));
}
const shfixForMe = () => SHFIX.filter(s => s.status === 'pending' && mine(s.to));
const shfixOf = (acc, tmplId) => SHFIX.filter(s => s.fromAcc === acc && s.tmplId === tmplId && s.status !== 'declined');
function shfixWhat(t) {
  const x = t.xfer, d = t.date ? ' le ' + t.date : '';
  return eur(num(t.amount)) + ' chaque mois' + d + (x ? ' · virement vers « ' + (ACC[x.acc]?.name || x.accName || 'un compte') + ' »' : '') + (t.cat && t.cat !== 'Virement' ? ' · ' + t.cat : '');
}
// Proposer une charge fixe (modèle tmplId du compte affiché) à une personne connectée
function shfixDialog(tmplId) {
  const t = S.templates.expenses.find(x => x.tmplId === tmplId); if (!t) return;
  const ppl = linkedPeople().filter(p => p.uid);
  if (!ppl.length) return toast('Connecte-toi d\'abord à la personne (Paramètres › Mes connexions)');
  const already = shfixOf(active, tmplId).map(s => s.to);
  const free = ppl.filter(p => !already.includes(p.uid));
  if (!free.length) return toast('Déjà partagée avec ' + ppl.map(p => shortName(p.email)).join(', '));
  formDialog({ title: '👥 Partager « ' + esc(t.name) + ' »', ok: 'Envoyer la demande',
    intro: `<b>${esc(shfixWhat(t))}</b><br>La personne reçoit une demande. Si elle accepte, la même charge fixe est ajoutée dans ses comptes (elle choisit le compte d'où elle part). Chacun garde la sienne : ta charge fixe ne change pas.`,
    fields: [{ id: 'who', label: 'Avec qui ?', type: 'select', options: free.map(p => shortName(p.email) + ' · ' + p.email), value: shortName(free[0].email) + ' · ' + free[0].email }],
    onSave: v => {
      const p = free.find(x => v.who.endsWith(' · ' + x.email)); if (!p) return false;
      const tpl = { name: t.name, amount: num(t.amount), date: t.date || '', cat: t.cat || '' };
      if (t.site) tpl.site = t.site; if (t.img && t.img.length < 60000) tpl.img = t.img;
      if (t.xfer?.kind === 'acc' && t.xfer.acc) tpl.xfer = { acc: t.xfer.acc, accName: ACC[t.xfer.acc]?.name || t.xfer.accName || '' };
      const id = uid(), now = Date.now();
      db.collection('shfix').doc(id).set({ members: [currentUser.uid, p.uid], emails: { [currentUser.uid]: myEmail(), [p.uid]: p.email }, from: currentUser.uid, fromEmail: myEmail(), fromAcc: active, tmplId,
        to: p.uid, toEmail: p.email, status: 'pending', at: now, tpl })
        .then(() => { toast('👥 Demande envoyée à ' + shortName(p.email)); render(); })
        .catch(er => toast(er.code === 'permission-denied' ? '⚠ Refusé par Firebase : les règles Firestore (firestore.rules) doivent être publiées' : '⚠ ' + (er.code || er.message)));
    } });
}
// Demande reçue : accepter (choisir le compte) ou refuser
function shfixAnswerDialog(id) {
  const s = SHFIX.find(x => x.id === id); if (!s || s.status !== 'pending') return;
  const t = s.tpl, dest = t.xfer && myAcc(t.xfer.acc) ? t.xfer.acc : null;
  const A = allAccs().filter(a => a !== dest && ACC[a].kind !== 'epargne'); if (!A.length) return toast('Ajoute d\'abord un compte courant');
  const def = A.includes(recvAccount()) ? recvAccount() : A[0];
  formDialog({ title: '👥 ' + esc(t.name), ok: 'Accepter', delLabel: 'Refuser',
    intro: `<b>${esc(shortName(s.fromEmail))}</b> te propose de partager cette charge fixe :<br><b>${esc(shfixWhat(t))}</b>.<br>Si tu acceptes, la même charge fixe est ajoutée dans ton compte${dest ? ', en virement automatique vers « ' + esc(ACC[dest].name) + ' »' : ''}.`,
    fields: [{ id: 'acc', label: dest ? 'Depuis quel compte part ton virement ?' : 'Dans quel compte ?', type: 'select', options: A.map(a => ACC[a].name), value: ACC[def]?.name }],
    onDelete: () => shfixAnswer(id, false),
    onSave: r => { shfixAnswer(id, true, A.find(a => ACC[a].name === r.acc)); } });
}
async function shfixAnswer(id, ok, acc) {
  const s = SHFIX.find(x => x.id === id); if (!s) return;
  const ref = db.collection('shfix').doc(id);
  try {
    let go = false;
    await db.runTransaction(async tx => { const sn = await tx.get(ref); if (!sn.exists || sn.data().status !== 'pending') return; go = true;
      tx.update(ref, Object.assign({ status: ok ? 'accepted' : 'declined', answeredAt: Date.now() }, ok && acc ? { toAcc: acc, toAccName: ACC[acc]?.name || '' } : {})); });
    if (!go) return toast('Demande déjà traitée');
    if (ok && acc) await fixCreate(acc, s.tpl);
    toast(ok ? '✓ Charge fixe ajoutée : ' + s.tpl.name + ' · ' + eur(num(s.tpl.amount)) : 'Demande refusée'); render();
  } catch (er) { toast('⚠ ' + (er.code || er.message)); }
}
// Crée une charge fixe (et l'élément du mois en cours, à payer) dans un de mes comptes ; virement automatique si la destination est à moi
async function fixCreate(src, t) {
  const k = nowK(), stid = uid(), dtid = uid(), rid = uid(), xid = uid();
  const dest = t.xfer && myAcc(t.xfer.acc) && t.xfer.acc !== src ? t.xfer.acc : null;
  const deco = Object.assign({}, t.site ? { site: t.site } : {}, t.img ? { img: t.img } : {});
  const cat = t.cat && t.cat !== 'Virement' ? t.cat : dest ? 'Virement' : (t.cat || 'Autre');
  const tpl = Object.assign({ tmplId: stid, name: t.name, amount: num(t.amount), date: t.date || '', cat, isDivided: false }, deco, dest ? { xfer: { kind: 'acc', acc: dest, accName: ACC[dest].name, auto: true, rid } } : {});
  const inst = Object.assign({ id: uid(), name: t.name, amount: num(t.amount), date: t.date || '', status: 'Prévu', cat, isFixed: true, tmplId: stid, isDivided: false }, deco, dest ? { xfer: { id: xid, kind: 'acc', acc: dest, accName: ACC[dest].name, rid } } : {});
  const addCat = o => { if (cat && cat !== 'Virement' && o.categories && !o.categories.includes(cat)) o.categories.push(cat); };
  if (src === active) mutate(() => { addCat(S); month(k).expenses.unshift(inst); tplAdd('expenses', tpl, shiftK(k, 1)); }, false);
  else await txMonth(src, k, m => m.expenses.unshift(inst), o => { addCat(o); o.templates.expenses.push(tpl); });
  if (!dest) return;
  const sn = ACC[src].name, itpl = Object.assign({ tmplId: dtid, name: t.name, amount: num(t.amount), date: t.date || '', isDivided: false, xfer: { kind: 'acc', acc: src, accName: sn, auto: true, rid } }, deco);
  const iinst = Object.assign({ id: uid(), name: t.name, amount: num(t.amount), date: t.date || '', status: 'En attente', isFixed: true, tmplId: dtid, xfer: { id: xid, kind: 'acc', acc: src, accName: sn, rid } }, deco, isShared(dest) ? { by: currentUser.email } : {});
  if (dest === active) mutate(() => { month(k).incomes.unshift(iinst); tplAdd('incomes', itpl, shiftK(k, 1)); }, false);
  else await txMonth(dest, k, m => m.incomes.unshift(iinst), o => o.templates.incomes.push(itpl));
}
function shfixDrop(id) { db.collection('shfix').doc(id).delete().then(() => render()).catch(() => {}); }
// Petite étiquette dans la liste des charges fixes : avec qui elle est partagée
function shfixTag(tmplId) {
  const L = shfixOf(active, tmplId); if (!L.length) return '';
  return L.map(s => `<span class="xtag">👥 ${esc(shortName(s.toEmail))} ${s.status === 'accepted' ? '✓' : '⏳'}</span>`).join('');
}

/* ---------- « J'ai remboursé » : à confirmer par celui qui reçoit ---------- */
const payConfirmsForMe = () => PDEBTS.filter(d => !d.closed && mine(lenderOf(d).uid)).flatMap(d => (d.payments || []).filter(p => p.pend && !p.rej && !mine(p.by)).map(p => ({ d, p })));
const payRejectsForMe = () => PDEBTS.filter(d => !d.closed).flatMap(d => (d.payments || []).filter(p => p.rej && mine(p.by)).map(p => ({ d, p })));
function payConfirmDialog(id, pid) {
  const e = findDebt(id); const p = e && (e.d.payments || []).find(x => x.id === pid); if (!p || !p.pend) return;
  const A = allAccs(), who = shortName(borrowerOf(e.d).email || e.d.emails?.[p.by]);
  const def = myAcc(p.toAcc) ? p.toAcc : myAcc(p.to) ? p.to : lenderAcc(e) || A[0];
  formDialog({ title: '💸 ' + esc(who) + ' t\'a remboursé ?', ok: 'Confirmer', delLabel: 'Pas reçu',
    intro: `<b>${eur(p.amount)}</b> le ${fmtD(p.date)} · ${esc(e.d.name)}${p.re ? '<br><small>Montant ou date modifié(e) après ta confirmation.</small>' : ''}<br>Vérifie sur ton compte bancaire que l'argent est bien arrivé.`,
    fields: [{ id: 'acc', label: 'Reçu sur quel compte ?', type: 'select', options: A.map(a => ACC[a].name), value: ACC[def]?.name }],
    onDelete: () => payConfirm(id, pid, false),
    onSave: r => { payConfirm(id, pid, true, A.find(a => ACC[a].name === r.acc)); } });
}
async function payConfirm(id, pid, ok, acc) {
  const e = findDebt(id); const p = e && (e.d.payments || []).find(x => x.id === pid); if (!p) return;
  try {
    if (!ok) { await updateDebt(e, x => { const q = (x.payments || []).find(z => z.id === pid); if (q) q.rej = { at: Date.now(), by: currentUser.uid }; }); toast('Signalé : pas reçu'); return render(); }
    const k = p.date.slice(0, 7), dd = String(+p.date.slice(8, 10)), incId = p.inc && myAcc(p.to) ? p.inc : uid();
    const from = shortName(e.d.emails?.[p.by] || borrowerOf(e.d).email);
    const line = x => Object.assign(x || { id: incId, status: 'Reçu', isFixed: false, debt: id, xfer: { id: p.xid || uid(), kind: 'person', from: e.d.emails?.[p.by] || '' } }, { name: p.label || 'Remboursement ' + from, amount: num(p.amount), date: dd }, isShared(acc) ? { by: currentUser.email } : {});
    if (p.inc && myAcc(p.to) && p.to !== acc) await lineSet(p.to, p.ik || p.k, null, 'incomes', p.inc);      // compte changé : on retire l'ancienne ligne
    await lineSet(acc, p.inc && p.to === acc ? (p.ik || p.k) : null, k, 'incomes', incId, line);
    await updateDebt(e, x => { const q = (x.payments || []).find(z => z.id === pid); if (!q) return; delete q.pend; delete q.rej; delete q.re; Object.assign(q, { to: acc, toName: ACC[acc]?.name || '', inc: incId, ik: k, okAt: Date.now() }); });
    toast('✓ ' + eur(p.amount) + ' reçus sur « ' + (ACC[acc]?.name || '') + ' »'); render();
  } catch (er) { toast('⚠ ' + (er.code || er.message)); }
}
// Celui qui a remboursé : « Pas reçu » → renvoyer ou supprimer
async function payRejAction(id, pid, what) {
  const e = findDebt(id); const p = e && (e.d.payments || []).find(x => x.id === pid); if (!p) return;
  if (what === 'resend') { await updateDebt(e, x => { const q = (x.payments || []).find(z => z.id === pid); if (q) { delete q.rej; q.pend = 1; q.at = Date.now(); } }); toast('Renvoyé pour confirmation'); return render(); }
  await cleanMovs(Object.assign({}, p, { inc: '' }));
  await updateDebt(e, x => { x.payments = (x.payments || []).filter(z => z.id !== pid); });
  toast('Remboursement supprimé'); render();
}
function payConfMsgHTML() {
  const C = payConfirmsForMe(), R = payRejectsForMe(), F = shfixForMe(); if (!C.length && !R.length && !F.length) return '';
  return `<section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>À valider</h2>
    ${C.map(({ d, p }) => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="gemo">💸</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(shortName(d.emails?.[p.by]))}</b> dit t'avoir remboursé <b>${eur(p.amount)}</b> · ${esc(d.name)}</span><span class="rs">le ${fmtD(p.date)}${p.re ? ' · modifié' : ''}</span></span>
      <span class="chips"><button class="btn sm p" data-a="pc-ok" data-id="${d.id}" data-v="${p.id}">Confirmer</button><button class="btn sm" data-a="pc-no" data-id="${d.id}" data-v="${p.id}">Pas reçu</button></span></div>`).join('')}
    ${R.map(({ d, p }) => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="gemo">❌</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(shortName(d.emails?.[p.rej.by]))}</b> n'a pas reçu ton remboursement de <b>${eur(p.amount)}</b> · ${esc(d.name)}</span><span class="rs">du ${fmtD(p.date)}</span></span>
      <span class="chips"><button class="btn sm" data-a="pr-act" data-id="${d.id}" data-v="${p.id}" data-w="resend">Renvoyer</button><button class="btn sm" data-a="pr-act" data-id="${d.id}" data-v="${p.id}" data-w="drop">Supprimer</button></span></div>`).join('')}
    ${F.map(s => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="gemo">🔁</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(shortName(s.fromEmail))}</b> te propose une charge fixe partagée : <b>${esc(s.tpl.name)}</b></span><span class="rs" style="white-space:normal">${esc(shfixWhat(s.tpl))}</span></span>
      <span class="chips"><button class="btn sm p" data-a="shfix-yes" data-id="${s.id}">Voir et accepter</button><button class="btn sm" data-a="shfix-no" data-id="${s.id}">Refuser</button></span></div>`).join('')}
  </section>`;
}
const validCount = () => payConfirmsForMe().length + payRejectsForMe().length + shfixForMe().length;

/* ---------- Notifications (app ouverte ou en arrière-plan) ---------- */
let payStSeen = null, shSeen = null;
function payNotify() {
  const st = {}; PDEBTS.forEach(d => (d.payments || []).forEach(p => { if (p.pend || p.rej || p.okAt) st[d.id + p.id] = p.rej ? 'rej' : p.pend ? 'pend' + (p.at || '') : 'ok'; }));
  if (payStSeen && loaded) PDEBTS.forEach(d => (d.payments || []).forEach(p => {
    const s = st[d.id + p.id], was = payStSeen[d.id + p.id]; if (!s || s === was) return;
    if (s.startsWith('pend') && !mine(p.by) && mine(lenderOf(d).uid)) { const t = shortName(d.emails?.[p.by]) + ' dit t\'avoir remboursé ' + eur(p.amount) + ' · ' + d.name; toast('💸 ' + t); browserNotify('Remboursement à confirmer', t); }
    if (mine(p.by) && was && was.startsWith('pend') && (s === 'ok' || s === 'rej')) { const o = shortName(d.emails?.[d.members.find(u => !mine(u))]), t = s === 'ok' ? o + ' a confirmé ton remboursement de ' + eur(p.amount) : o + ' n\'a pas reçu ton remboursement de ' + eur(p.amount); toast((s === 'ok' ? '✓ ' : '❌ ') + t); browserNotify('Remboursement', t + ' · ' + d.name); }
  }));
  payStSeen = st; appBadge();
}
function shfixNotify() {
  const st = {}; SHFIX.forEach(s => st[s.id] = s.status);
  if (shSeen && loaded) SHFIX.forEach(s => {
    if (shSeen[s.id] === s.status) return;
    if (s.status === 'pending' && mine(s.to)) { const t = shortName(s.fromEmail) + ' te propose une charge fixe partagée : ' + s.tpl.name + ' (' + eur(num(s.tpl.amount)) + ')'; toast('🔁 ' + t); browserNotify('Charge fixe partagée', t); }
    if (s.status !== 'pending' && shSeen[s.id] === 'pending' && mine(s.from)) { const t = shortName(s.toEmail) + (s.status === 'accepted' ? ' a accepté ' : ' a refusé ') + '« ' + s.tpl.name + ' »'; toast((s.status === 'accepted' ? '✓ ' : '❌ ') + t); browserNotify('Charge fixe partagée', t); }
  });
  shSeen = st; appBadge();
}
// Pastille sur l'icône de l'app installée (iPhone, Android, PC) : nombre de choses à traiter
function appBadge() {
  try { if (!navigator.setAppBadge || !currentUser) return; const n = unreadCount(); (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
}
