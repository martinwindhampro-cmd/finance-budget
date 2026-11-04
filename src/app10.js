
/* ============================== CONNEXIONS ENTRE UTILISATEURS ==============================
   Deux personnes « connectées » (demande acceptée) voient le NOM de leurs comptes (jamais les soldes) :
   pour se faire des virements sur le bon compte et suivre des remboursements entre elles.
   links/{a__b} : emails triés, from, to, status pending / accepted / declined, uids {uid: email}.          */
let LINKS = [];
const pairId = (a, b) => [String(a).toLowerCase(), String(b).toLowerCase()].sort().join('__');
const linkWith = e => LINKS.find(l => l.emails.includes(String(e).toLowerCase()) && l.emails.includes(myEmail()));
const isLinked = e => linkWith(e)?.status === 'accepted';
const otherOf = l => l.emails.find(e => e !== myEmail());
const linkedPeople = () => LINKS.filter(l => l.status === 'accepted').map(l => ({ email: otherOf(l), uid: Object.keys(l.uids || {}).find(u => l.uids[u] === otherOf(l)) }));
const shortName = e => { const s = String(e || '').split('@')[0]; return s.charAt(0).toUpperCase() + s.slice(1); };
function linkListen() {
  return db.collection('links').where('emails', 'array-contains', myEmail()).onSnapshot(q => {
    const before = LINKS; LINKS = q.docs.map(d => ({ id: d.id, ...d.data() }));
    LINKS.filter(l => l.status === 'accepted' && before.some(b => b.id === l.id && b.status === 'pending') && l.fromEmail === myEmail())
      .forEach(l => { toast('🤝 ' + shortName(otherOf(l)) + ' a accepté la connexion'); Object.keys(DIR_T).forEach(e => delete DIR_T[e]); });
    if (loaded) { renderChrome(); if (['messages', 'parametres', 'budgets'].includes(UI.view)) render(); }
  }, e => console.warn('Connexions', e.code));
}
async function linkRequest(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!okEmail(e)) return toast('Email invalide'), false;
  if (e === myEmail()) return toast('C\'est ton propre email 🙂'), false;
  const ex = linkWith(e);
  if (ex?.status === 'accepted') return toast('Vous êtes déjà connectés'), true;
  if (ex?.status === 'pending' && ex.to === myEmail()) return linkAnswer(ex.id, true);
  if (ex?.status === 'pending') return toast('Demande déjà envoyée, en attente de réponse'), false;
  const id = pairId(myEmail(), e), ref = db.collection('links').doc(id);
  try {
    if (ex) await ref.delete();                                         // demande refusée auparavant : on recommence
    await ref.set({ emails: [myEmail(), e].sort(), from: currentUser.uid, fromEmail: myEmail(), to: e, status: 'pending', at: Date.now(), uids: { [currentUser.uid]: myEmail() } });
    toast('Demande de connexion envoyée à ' + e); return false;
  } catch (er) { toast('⚠ Demande non envoyée (' + (er.code || er.message) + ')'); return false; }
}
function linkAnswer(id, ok) {
  const upd = { status: ok ? 'accepted' : 'declined', answeredAt: Date.now() };
  if (ok) upd['uids.' + currentUser.uid] = myEmail();
  return db.collection('links').doc(id).update(upd).then(() => { toast(ok ? '🤝 Connexion acceptée' : 'Demande refusée'); publishDir(); return ok; })
    .catch(e => { toast('⚠ ' + (e.code || e.message)); return false; });
}
function linkRemove(id) {
  const l = LINKS.find(x => x.id === id); if (!l) return;
  if (!confirm('Retirer la connexion avec ' + otherOf(l) + ' ? Vous ne verrez plus le nom de vos comptes respectifs.')) return;
  db.collection('links').doc(id).delete().then(() => toast('Connexion retirée')).catch(e => toast('⚠ ' + (e.code || e.message)));
}
const linkPending = () => LINKS.filter(l => l.status === 'pending' && l.to === myEmail());
function linksMsgHTML() {
  const P_ = linkPending(); if (!P_.length) return '';
  return `<section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Demandes de connexion</h2>
    ${P_.map(l => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="avatar lg">${initials(l.fromEmail)}</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(l.fromEmail)}</b> veut se connecter avec toi</span><span class="rs" style="white-space:normal">Vous verrez le nom de vos comptes (jamais les soldes ni les mouvements) pour vous faire des virements et suivre vos remboursements.</span></span>
      <span class="chips"><button class="btn sm p" data-a="link-yes" data-id="${esc(l.id)}">Accepter</button><button class="btn sm" data-a="link-no" data-id="${esc(l.id)}">Refuser</button></span></div>`).join('')}
  </section>`;
}
function linksCardHTML() {
  const L = LINKS.slice().sort((a, b) => (a.status === 'accepted' ? 0 : 1) - (b.status === 'accepted' ? 0 : 1));
  return `<section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:10px"><h2>Mes connexions</h2>
    <p class="note" style="font-size:13px">Les personnes connectées voient le nom de tes comptes (pas les soldes) : virements sur le bon compte, remboursements entre vous. Chacun doit accepter.</p>
    ${L.map(l => `<div class="row" style="padding:4px"><span class="avatar">${initials(otherOf(l))}</span><span class="rt"><span class="rn">${esc(otherOf(l))}</span><span class="rs">${l.status === 'accepted' ? '✓ connectés' : l.status === 'pending' ? (l.to === myEmail() ? 'te demande la connexion' : 'en attente de sa réponse') : 'a refusé'}</span></span>
      ${l.status === 'pending' && l.to === myEmail() ? `<button class="btn sm p" data-a="link-yes" data-id="${esc(l.id)}">Accepter</button>` : ''}<button class="x" data-a="link-del" data-id="${esc(l.id)}" aria-label="Retirer">${svg('x', 15)}</button></div>`).join('') || '<p class="empty" style="padding:6px">Aucune connexion pour l\'instant.</p>'}
    <span style="display:flex;gap:8px"><input class="in" id="link-email" type="email" placeholder="Email de la personne" aria-label="Email de la personne"><button class="btn p" data-a="link-req">Connecter</button></span>
  </section>`;
}

/* ============================== REMBOURSEMENTS ==============================
   Une « avance » : quelqu'un (un de mes comptes, ou une personne connectée) a avancé de l'argent ;
   quelqu'un d'autre (un compte, une personne connectée, ou juste un nom) le rembourse petit à petit.
   • entre mes comptes → rangée dans le compte qui a avancé (S.debts, visible par ses membres) ;
   • avec une autre personne → document partagé pdebts/{id} (visible par les deux).
   Onglet Budgets : « À recevoir » (ce compte a avancé) et « À rembourser » (ce compte rembourse).              */
const debts = () => S.debts = S.debts || [];
let PDEBTS = [];
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function debtInfo(d) {
  // dépenses communes « ajoutées » (montant négatif) : augmentent ce qui est dû
  const P = d.payments || [], t = Math.round((num(d.amount) + sum(P.filter(p => num(p.amount) < 0), p => -num(p.amount))) * 100) / 100, r = sum(P.filter(p => num(p.amount) > 0), p => num(p.amount)), left = Math.max(0, Math.round((t - r) * 100) / 100);
  return { t, r, left, p: t > 0 ? Math.min(100, r / t * 100) : 0, done: t > 0 && left <= 0 };
}
function pdebtListen() {
  return db.collection('pdebts').where('members', 'array-contains', currentUser.uid).onSnapshot(q => {
    PDEBTS = q.docs.map(d => ({ id: d.id, ...d.data() }));
    processDebtReqs(); splitNotify(); setTimeout(() => compSync(), 600);
    if (loaded) { renderChrome(); if (['budgets', 'accueil', 'messages'].includes(UI.view)) render(); }
  }, e => console.warn('Remboursements partagés', e.code));
}
// Ancien format (v11-v12) : to = compte qui a avancé, who = texte
const lenderOf = (d, home) => d.lender || { kind: 'acc', acc: d.to || home };
const borrowerOf = d => d.borrower || { kind: 'text', who: d.who || '' };
// Toutes les avances que je vois : celles de mes comptes + celles partagées avec des personnes
function allDebts() {
  const out = [];
  accIds.filter(a => ACC[a]).forEach(a => { const L = a === active ? debts() : ((J(ACC[a].meta) || {}).debts || []); L.forEach(d => out.push({ d, home: { acc: a } })); });
  PDEBTS.filter(d => !d.closed && !invNotMine(d)).forEach(d => out.push({ d, home: { shared: d.id } }));
  return out;
}
const findDebt = id => allDebts().find(x => x.d.id === id);
const mine = u => u === currentUser.uid;
// Un compte partagé (joint) qui a avancé appartient à ses deux membres : chacun le voit « à recevoir »
const myAcc = a => !!a && accIds.includes(a) && !!ACC[a];
function lenderAcc(e) { const l = lenderOf(e.d, e.home.acc); if (l.kind === 'acc') return l.acc;
  if (l.kind === 'user') { if (mine(l.uid)) return myAcc(l.acc) ? l.acc : recvAccount(); if (myAcc(l.acc)) return l.acc; } return null; }
function borrowerAcc(e) { const b = borrowerOf(e.d); if (b.kind === 'acc') return b.acc; if (b.kind !== 'user' || !mine(b.uid)) return null;
  const la = lenderOf(e.d, e.home.acc).acc; let a = myAcc(b.acc) ? b.acc : recvAccount();
  if (a && a === la) a = allAccs().find(x => x !== la && ACC[x].kind !== 'epargne') || null;     // jamais le compte qui a avancé lui-même
  return a; }
const lenderIsMine = L => L.kind !== 'user' || mine(L.uid) || myAcc(L.acc);
function sideLabel(s, home) {
  if (!s) return '';
  if (s.kind === 'acc') return ACC[s.acc]?.name || s.accName || 'un compte';
  if (s.kind === 'user') return mine(s.uid) ? 'Moi' + (s.acc && ACC[s.acc] ? ' (' + ACC[s.acc].name + ')' : '') : myAcc(s.acc) ? ACC[s.acc].name : shortName(s.email);
  return s.who || '';
}
// Modifie une avance là où elle est rangée
function updateDebt(e, fn) {
  if (e.home.acc === active) { mutate(() => { const x = debts().find(z => z.id === e.d.id); if (x) fn(x); }, false); return Promise.resolve(); }
  if (e.home.acc) return db.runTransaction(async tx => {
    const ref = accDoc(e.home.acc), s = await tx.get(ref); if (!s.exists) throw new Error('Compte introuvable');
    const o = J(s.data().meta) || {}, x = (o.debts || []).find(z => z.id === e.d.id); if (!x) throw new Error('Avance introuvable');
    fn(x); tx.update(ref, { meta: canon(o), updatedAt: Date.now(), updatedBy: currentUser.uid });
  });
  return db.runTransaction(async tx => {
    const ref = db.collection('pdebts').doc(e.home.shared), s = await tx.get(ref); if (!s.exists) throw new Error('Avance introuvable');
    const x = s.data(); fn(x); x.updatedAt = Date.now(); tx.set(ref, x);
  });
}
function debtRowHTML(e, role) {
  const d = e.d, i = debtInfo(d), other = role === 'in' ? borrowerOf(d) : lenderOf(d, e.home.acc);
  const who = sideLabel(other); const col = role === 'in' ? '#10B981' : '#F59E0B';
  return `<button class="drow${i.done ? ' done' : ''}" data-a="debt-open" data-id="${d.id}">
    <span class="gemo">${i.done ? '✅' : esc(d.emo || '💸')}</span>
    <span class="rt"><span class="rn">${esc(d.name)}${who ? ` <span class="note" style="font-weight:500">· ${role === 'in' ? 'par ' : 'à '}${esc(who)}</span>` : ''}</span><span class="rs">${i.done ? 'Entièrement remboursé' : 'Reste <b class="num" style="color:var(--ink)">' + eur(i.left) + '</b> sur ' + eur(i.t)}${e.home.shared ? ' · 🤝 partagé' : ''}${invPending(d) ? ' · ⏳ en attente de son accord' : ''}${invDeclined(d) ? ' · <b style="color:var(--bad)">❌ refusé</b>' : ''}${(d.reqs || []).some(q => q.status === 'pending') ? ' · <b style="color:var(--warn)">⏳ suppression demandée</b>' : ''}</span>
      <span class="bar" style="display:block;margin-top:6px"><i style="width:${i.p}%;--c:${i.done ? 'var(--ok)' : col}"></i></span></span>
    <b class="num dpct">${Math.round(i.p)} %</b></button>`;
}
function debtsHTML(compact) {
  if (isSavAcc()) return '';
  const All = allDebts().filter(e => lenderAcc(e) === active || borrowerAcc(e) === active), isOld = e => !!e.d.arch || debtInfo(e.d).done;
  // Partages (une part par personne) : regroupés côté de celui qui a payé
  const G = {}; All.filter(e => e.d.grp && lenderAcc(e) === active).forEach(e => (G[e.d.grp.id] = G[e.d.grp.id] || []).push(e));
  const gOld = gid => G[gid].every(e => isOld(e)), inG = e => e.d.grp && G[e.d.grp.id] && lenderAcc(e) === active;
  const IN = All.filter(e => !inG(e) && !isOld(e) && lenderAcc(e) === active), OUT = All.filter(e => !inG(e) && !isOld(e) && borrowerAcc(e) === active), OLD = All.filter(e => !inG(e) && isOld(e));
  const GA = Object.keys(G).filter(g => !gOld(g)), GO = Object.keys(G).filter(gOld);
  const tsOld = e => e.d.arch?.at || e.d.doneAt || 0;
  const H = OLD.map(e => [tsOld(e), histRowHTML(e)]).concat(GO.map(g => [Math.max(...G[g].map(tsOld)), groupHistRowHTML(g, G[g])])).sort((a, b) => b[0] - a[0]);
  if (compact && !IN.length && !OUT.length && !GA.length) return '';
  const part = (L, role, gs = []) => { const LL = L.concat(...gs.map(g => G[g])), left = sum(LL, e => e.d.arch || invDeclined(e.d) ? 0 : debtInfo(e.d).left), tot = sum(LL, e => num(e.d.amount));
    return `<div class="dpart"><div class="dhead ${role}"><b>${role === 'in' ? 'À recevoir' : 'À rembourser'}</b><span class="num">${eur(left)}</span><span class="note">${tot > 0 ? Math.round((tot - left) / tot * 100) : 0} % remboursé</span></div>
      ${gs.map(g => groupRowHTML(g, G[g])).join('')}${L.map(e => debtRowHTML(e, role)).join('')}</div>`; };
  return `<section class="card" aria-label="Remboursements" style="display:flex;flex-direction:column;gap:6px">
    <div class="ch"><h2>Remboursements ${compact ? '' : tip('remboursements', 'Remboursements', '<b>À recevoir</b> : de l\'argent que « ' + esc(accName()) + ' » a avancé et qu\'on lui rembourse.<br><b>À rembourser</b> : ce que ce compte doit rendre.<br>Avec une personne connectée, l\'avance est partagée : vous voyez tous les deux le reste à jour.', 'rt')}</h2>${compact ? '' : `<span class="chips"><button class="btn sm" data-a="split-new">👥 Partager</button><button class="btn sm" data-a="debt-new">${svg('plus', 16)} Avance</button></span>`}</div>
    ${compact ? '' : balHTML()}${IN.length || GA.length ? part(IN, 'in', GA) : ''}${OUT.length ? part(OUT, 'out') : ''}
    ${!IN.length && !OUT.length && !GA.length ? `<p class="empty">${H.length ? 'Plus rien en cours 👍' : 'Quelqu\'un a avancé de l\'argent (mariage, restaurant, covoiturage…) ? Ajoute-le. Tu as payé pour plusieurs ? « Partager » répartit la dépense et envoie une demande à chacun.'}</p>` : ''}
    ${!compact && H.length ? `<button class="lnk" data-a="debt-hist" style="align-self:flex-start;margin-top:4px">${UI.debtHist ? '▾' : '▸'} Historique (${H.length})</button>
      ${UI.debtHist ? `<div class="dpart">${H.map(h => h[1]).join('')}</div>` : ''}` : ''}
  </section>`;
}
function histRowHTML(e) {
  const d = e.d, i = debtInfo(d), ab = !!d.arch, role = lenderAcc(e) === active ? 'in' : 'out';
  return `<button class="drow done" data-a="debt-open" data-id="${d.id}"><span class="gemo">${ab ? '🗂️' : '✅'}</span>
    <span class="rt"><span class="rn">${esc(d.name)} <span class="note" style="font-weight:500">· ${role === 'in' ? 'reçu' : 'rendu'} ${eur0(i.r)} sur ${eur0(i.t)}</span></span>
    <span class="rs">${ab ? 'Abandonnée le ' + fmtD(d.arch.at) + (i.left > 0 ? ' · ' + eur0(i.left) + ' non remboursés' : '') : 'Soldée' + (lastPay(d) ? ' le ' + fmtD(lastPay(d)) : '')}${e.home.shared ? ' · 🤝' : ''}</span></span>
    <b class="num dpct">${Math.round(i.p)} %</b></button>`;
}
const fmtD = t => new Date(typeof t === 'string' ? t + 'T12:00' : t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const lastPay = d => (d.payments || []).map(p => p.date).sort().pop();
function otherDebtsHTML(A) {
  const L = A.filter(e => !debtInfo(e.d).done).map(e => [e, lenderAcc(e), borrowerAcc(e)]).filter(([, la, ba]) => (la && la !== active) || (ba && ba !== active)).filter(([, la, ba]) => la !== active && ba !== active);
  if (!L.length) return '';
  return `<div class="odebts"><span class="note" style="font-size:12px">Dans tes autres comptes</span>${L.map(([e, la, ba]) => { const acc = la && ACC[la] ? la : ba;
    return `<button class="chip" data-a="debt-goto" data-acc="${acc}" data-id="${e.d.id}">${esc(e.d.emo || '💸')} ${esc(e.d.name)} · ${la && ACC[la] ? 'à recevoir' : 'à rembourser'} ${eur0(debtInfo(e.d).left)} <span class="note">(${esc(ACC[acc]?.name || '')})</span></button>`; }).join('')}</div>`;
}

/* ---------- Création / modification ---------- */
async function dirOf(email) { try { const s = await db.collection('directory').doc(email).get(); return s.exists ? s.data() : null; } catch (e) { return null; } }
// Sous un menu « personne », ajoute le choix de SON compte (lu dans son annuaire, visible car vous êtes connectés)
function personAccPicker(selId, label, getPerson, current) {
  const sel = $(selId); if (!sel) return;
  const box = document.createElement('div'); box.className = 'fl'; sel.closest('label').after(box);
  const upd = async () => {
    const p = getPerson(); if (!p || p.kind !== 'user' || mine(p.uid)) { box.innerHTML = ''; return; }
    box.innerHTML = `<span>${label(p)}</span><p class="note" style="font-size:12px">Chargement de ses comptes…</p>`;
    const D = await dirOf(p.email), L = (D?.accounts || []);
    if (!L.length) { box.innerHTML = `<span>${label(p)}</span><p class="note" style="font-size:12px">Ses comptes ne sont pas visibles : il faut qu'elle ouvre l'app à jour (et que vous soyez connectés). En attendant, ce sera son compte par défaut.</p>`; return; }
    const cur = L.some(a => a.id === current) ? current : D.recv;
    box.innerHTML = `<label class="fl">${label(p)}<select class="in" id="${selId}-acc">${L.map(a => `<option value="${esc(a.id)}" ${a.id === cur ? 'selected' : ''}>${esc(a.name)}${a.bank ? ' · ' + esc(a.bank) : ''}</option>`).join('')}</select></label>`;
  };
  sel.addEventListener('change', upd); upd();
}
const pickedAcc = selId => { const s = $(selId + '-acc'); return s ? { acc: s.value, accName: s.options[s.selectedIndex]?.text.split(' · ')[0] || '' } : {}; };
const allAccs = () => accIds.filter(a => ACC[a]);
function partyOptions() {      // [libellé, valeur] : mes comptes, puis les personnes connectées
  return allAccs().map(a => [ACC[a].name + (a === active ? ' (ce compte)' : ''), { kind: 'acc', acc: a, accName: ACC[a].name }])
    .concat(linkedPeople().filter(p => p.uid).map(p => ['👤 ' + shortName(p.email) + ' (' + p.email + ')', { kind: 'user', uid: p.uid, email: p.email }]));
}
const sameParty = (a, b) => a && b && a.kind === b.kind && (a.kind === 'acc' ? a.acc === b.acc : a.kind === 'user' ? a.uid === b.uid : a.who === b.who);
function debtDialog(id, preset) {
  const e = id ? findDebt(id) : null, d = e?.d, v = d || preset || {};
  if (e?.home.shared && d) return sharedEditDialog(e);
  const O = partyOptions(), TXT = 'Quelqu\'un d\'autre (juste un nom)', lab = p => (O.find(o => sameParty(o[1], p)) || [])[0];
  const L0 = d ? lenderOf(d, e.home.acc) : v.lender || { kind: 'acc', acc: active }, B0 = d ? borrowerOf(d) : v.borrower || { kind: 'text', who: v.who || '' };
  formDialog({ title: d ? 'Modifier l\'avance' : 'Nouvelle avance', intro: d ? '' : 'Qui a avancé l\'argent, et qui le rembourse ? Pour une autre personne, connectez-vous d\'abord (Paramètres › Profil & app › Mes connexions).',
    fields: [{ id: 'name', label: 'Pour quoi ?', value: v.name || '', ph: 'ex. Mariage, Restaurant, BlaBlaCar' }, { id: 'amount', label: 'Montant avancé', type: 'num', value: v.amount, ph: 'ex. 270' },
      { id: 'lend', label: 'Qui a avancé l\'argent ? (à recevoir)', type: 'select', options: O.map(o => o[0]), value: lab(L0) || O[0][0] },
      { id: 'borr', label: 'Qui rembourse ? (à rembourser)', type: 'select', options: O.map(o => o[0]).concat([TXT]), value: lab(B0) || TXT },
      { id: 'who', label: 'Son nom (si « quelqu\'un d\'autre »)', value: B0.kind === 'text' ? B0.who : '', ph: 'ex. Julie, nous deux…' }],
    onDelete: d ? () => removeDebt(e) : null,
    onSave: r => {
      if (!r.name) { toast('Indique pour quoi'); return false; }
      if (!(r.amount > 0)) { toast('Indique le montant avancé'); return false; }
      let lender = (O.find(o => o[0] === r.lend) || [])[1]; if (lender?.kind === 'user') lender = Object.assign({}, lender, pickedAcc('f_lend'));
      const borrower = r.borr === TXT ? { kind: 'text', who: r.who } : (O.find(o => o[0] === r.borr) || [])[1];
      if (!lender) { toast('Choisis qui a avancé'); return false; }
      if (sameParty(lender, borrower)) { toast('Ce ne peut pas être la même personne / le même compte'); return false; }
      const base = { name: r.name, amount: r.amount, lender, borrower, emo: v.emo || '💸' };
      if (d) { updateDebt(e, x => Object.assign(x, base)).then(() => toast('Avance modifiée')).catch(er => toast('⚠ ' + (er.code || er.message))); return; }
      createDebt(Object.assign(base, { id: uid(), at: Date.now(), payments: (preset && preset.payments) || [] }), preset?.fromGoal);
    } });
  personAccPicker('f_lend', p => 'Sur quel compte de ' + esc(shortName(p.email)) + ' la rembourser ?', () => (O.find(o => o[0] === $('f_lend').value) || [])[1], L0.acc);
}
async function createDebt(d, fromGoal) {
  const other = [d.lender, d.borrower].find(s => s.kind === 'user');
  try {
    if (other) {                                             // avec une autre personne : document partagé
      d.members = [currentUser.uid, other.uid]; d.emails = { [currentUser.uid]: myEmail(), [other.uid]: other.email };
      if (d.lender.kind === 'acc') d.lender = { kind: 'user', uid: currentUser.uid, email: myEmail(), acc: d.lender.acc, accName: d.lender.accName };
      if (d.borrower.kind === 'acc') d.borrower = { kind: 'user', uid: currentUser.uid, email: myEmail(), acc: d.borrower.acc, accName: d.borrower.accName };
      await db.collection('pdebts').doc(d.id).set(Object.assign(d, { createdBy: currentUser.uid, updatedAt: Date.now() }));
    } else {
      const home = d.lender.acc;                             // rangée dans le compte qui a avancé
      if (home === active) mutate(() => debts().push(d), false);
      else await db.runTransaction(async tx => { const ref = accDoc(home), s = await tx.get(ref), o = J(s.data().meta) || {}; o.debts = (o.debts || []).concat([d]); tx.update(ref, { meta: canon(o), updatedAt: Date.now(), updatedBy: currentUser.uid }); });
    }
    if (fromGoal) { U.goals = goals().filter(g => g.id !== fromGoal); saveUser(); }
    toast('Avance ajoutée : ' + d.name); render();
    setTimeout(() => debtView(d.id), 400);
  } catch (er) { toast('⚠ Avance non enregistrée (' + (er.code || er.message) + ')'); }
}
// ---- Suppression : choix de garder ou non les mouvements, accord des deux pour une avance partagée
const payHasMov = p => !!(p.inc || p.exp || p.xid || (p.lines && Object.keys(p.lines).length));
function askDeleteMode(what, hasMov, shared, purge) {
  return new Promise(res => {
    const d = $('dlg'); d.onclick = null; let done = false; const end = v => { if (done) return; done = true; d.close(); res(v); };
    d.innerHTML = `<div class="dw"><div class="dh"><h2>Supprimer ${esc(what)} ?</h2><button class="ib sm" data-x aria-label="Annuler">${svg('x', 16, 2.4)}</button></div>
      ${hasMov ? `<p class="note">Des virements / recettes ont déjà été enregistrés pour ces remboursements. Que veux-tu en faire ?</p>
      <button class="row rowb modeopt" data-m="keep"><span class="ico" style="--c:#10B981">${svg('check')}</span><span class="rt"><span class="rn">${purge ? 'Garder les mouvements' : 'Clôturer et garder les mouvements'}</span><span class="rs" style="white-space:normal">L'argent déjà remboursé reste dans les comptes.${purge ? '' : ' Plus rien à rembourser : l\'avance passe dans l\'historique (« abandonnée »).'}</span></span></button>
      <button class="row rowb modeopt" data-m="all"><span class="ico" style="--c:#E11D48">${svg('trash')}</span><span class="rt"><span class="rn">Supprimer aussi les mouvements</span><span class="rs" style="white-space:normal">Les virements et recettes créés par ces remboursements sont retirés des comptes${shared ? ', des deux côtés' : ''}.</span></span></button>`
      : `<p class="note">Aucun mouvement n'a été enregistré pour ${esc(what)}.</p><button class="btn danger big" data-m="all">Supprimer</button>`}
      ${shared ? `<p class="note" style="font-size:12px">🤝 Avance partagée : la suppression sera faite quand l'autre personne aura accepté.</p>` : ''}
      <button class="btn" data-x>Annuler</button></div>`;
    d.onclick = e => { if (e.target.closest('[data-x]')) return end(null); const b = e.target.closest('[data-m]'); if (b) end(b.dataset.m); };
    d.showModal();
  });
}
// Retire de MES comptes les mouvements liés à un remboursement (recette, virement sortant, virement reçu)
async function cleanMovs(p) {
  const hit = x => (p.inc && x.id === p.inc) || (p.exp && x.id === p.exp) || (p.xid && x.xfer && x.xfer.id === p.xid);
  const drop = m => { m.incomes = m.incomes.filter(x => !hit(x)); m.expenses = m.expenses.filter(x => !hit(x)); };
  const jobs = accIds.filter(a => ACC[a]).map(async a => {
    if (a === active) { const m = S.months[p.k]; if (m && [...m.incomes, ...m.expenses].some(hit)) mutate(() => drop(month(p.k)), false); return; }
    const s = await monthCol(a).doc(p.k).get().catch(() => null); if (!s || !s.exists) return;
    const m = JSON.parse(s.data().data); if ([...m.incomes, ...m.expenses].some(hit)) await txMonth(a, p.k, drop);
  });
  if (p.toUser && p.xid && xfStatus(p.xid) === 'sent') jobs.push(db.collection('transfers').doc(p.xid).delete());
  Object.values(p.lines || {}).forEach(ln => { if (myAcc(ln.acc)) jobs.push(lineSet(ln.acc, ln.k, null, 'expenses', ln.id)); });   // lignes d'une dépense commune
  await Promise.allSettled(jobs);
}
// Prévenir les autres membres d'un compte partagé (messagerie)
function warnMembers(e, text) {
  const accs = [...new Set([e.home.acc, lenderOf(e.d, e.home.acc).acc, borrowerOf(e.d).acc].filter(a => a && ACC[a] && isShared(a)))];
  accs.forEach(a => accDoc(a).collection('activity').add({ by: currentUser.uid, byEmail: currentUser.email, text: String(text).slice(0, 200), at: Date.now(), month: nowK() }).catch(() => {}));
}
async function removeDebt(e) {
  const d = e.d, shared = !!e.home.shared, purge = !!d.arch || debtInfo(d).done;
  if (shared && d.invite && d.invite.status !== 'accepted') {                // demande pas (encore) acceptée : retrait direct
    if (!confirm('Retirer la part de ' + sideLabel(borrowerOf(d)) + ' (' + eur(d.amount) + ') ?')) return;
    return declinedAction(d.id, 'drop');
  }
  const mode = await askDeleteMode((purge ? 'définitivement ' : '') + '« ' + d.name + ' »', (d.payments || []).some(payHasMov), shared, purge); if (!mode) return;
  if (shared) return debtRequest(e, { type: 'debt', mode, purge });
  if (mode === 'keep' && !purge) {                                   // abandon : on garde la trace dans l'historique
    await updateDebt(e, x => { x.arch = { at: Date.now(), by: currentUser.uid, kind: 'abandon', left: debtInfo(x).left }; delete x.auto; });
    warnMembers(e, 'Avance « ' + d.name + ' » clôturée (' + eur(debtInfo(d).left) + ' abandonnés, mouvements gardés)'); toast('Avance clôturée · dans l\'historique'); return render();
  }
  if (mode === 'all') for (const p of d.payments || []) await cleanMovs(p);
  const drop = () => { S.debts = debts().filter(x => x.id !== d.id); };
  if (e.home.acc === active) mutate(drop, false);
  else await db.runTransaction(async tx => { const ref = accDoc(e.home.acc), s = await tx.get(ref), o = J(s.data().meta) || {}; o.debts = (o.debts || []).filter(x => x.id !== d.id); tx.update(ref, { meta: canon(o), updatedAt: Date.now(), updatedBy: currentUser.uid }); });
  const txt = 'a supprimé l\'avance « ' + d.name + ' »' + (mode === 'keep' ? ' (mouvements gardés)' : ' et ses mouvements');
  warnMembers(e, txt.charAt(0).toUpperCase() + txt.slice(1)); toast('Avance supprimée' + (mode === 'keep' ? ' · mouvements gardés' : '')); render();
}
// ---- Avance partagée : demande à l'autre personne, puis chacun nettoie ses propres comptes
async function debtRequest(e, r) {
  const other = e.d.members.find(u => !mine(u)), req = Object.assign({ id: uid(), by: currentUser.uid, at: Date.now(), status: 'pending', done: {} }, r);
  await updateDebt(e, x => { x.reqs = (x.reqs || []).filter(q => !(q.status === 'pending' && q.by === currentUser.uid && q.type === r.type && q.pid === r.pid)); x.reqs.push(req); });
  toast('Demande envoyée à ' + shortName(e.d.emails?.[other]) + ' : en attente de son accord');
}
function debtAnswer(id, rid, ok) {
  const e = findDebt(id) || (PDEBTS.find(d => d.id === id) && { d: PDEBTS.find(d => d.id === id), home: { shared: id } }); if (!e) return;
  return updateDebt(e, x => {
    const q = (x.reqs || []).find(z => z.id === rid); if (!q || q.status !== 'pending') return;
    q.status = ok ? 'approved' : 'declined'; q.answeredAt = Date.now();
    if (ok && q.type === 'pay') { q.pay = (x.payments || []).find(p => p.id === q.pid) || null; x.payments = (x.payments || []).filter(p => p.id !== q.pid); }
    if (ok && q.type === 'debt' && q.mode === 'keep' && !q.purge) { x.arch = { at: Date.now(), by: q.by, kind: 'abandon', left: debtInfo(x).left }; delete x.auto; x.reqs = x.reqs.filter(z => z.id !== rid); return; }
    if (ok && q.type === 'debt') { q.pays = x.payments || []; x.closed = true; }
  }).then(() => toast(ok ? 'Suppression acceptée' : 'Suppression refusée'));
}
const reqText = (d, q) => (q.type === 'debt' ? (q.purge ? 'retirer de l\'historique « ' + d.name + ' »' : q.mode === 'keep' ? 'clôturer l\'avance « ' + d.name + ' » (abandonner le reste)' : 'supprimer l\'avance « ' + d.name + ' »') : 'supprimer un remboursement de « ' + d.name + ' » (' + eur(num((d.payments || []).find(p => p.id === q.pid)?.amount || q.pay?.amount)) + ')') + (q.type === 'debt' && q.mode === 'keep' ? '' : q.mode === 'keep' ? ', en gardant les mouvements' : ', avec ses mouvements');
const pendingForMe = () => PDEBTS.flatMap(d => (d.reqs || []).filter(q => q.status === 'pending' && !mine(q.by)).map(q => ({ d, q })));
let reqSeen = new Set(), reqBusy = new Set();
async function processDebtReqs() {
  for (const d of PDEBTS) for (const q of d.reqs || []) {
    const key = d.id + q.id;
    if (q.status === 'pending' && !mine(q.by) && !reqSeen.has(key)) { reqSeen.add(key); if (loaded) { toast('🤝 ' + shortName(d.emails?.[q.by]) + ' demande de ' + reqText(d, q)); browserNotify('Demande de suppression', shortName(d.emails?.[q.by]) + ' : ' + reqText(d, q)); } }
    if (q.status === 'declined' && mine(q.by) && !reqBusy.has(key)) { reqBusy.add(key); toast(shortName(d.emails?.[d.members.find(u => !mine(u))]) + ' a refusé de ' + reqText(d, q)); updateDebt({ d, home: { shared: d.id } }, x => { x.reqs = (x.reqs || []).filter(z => z.id !== q.id); }).catch(() => {}); }
    if (q.status === 'approved' && !(q.done || {})[currentUser.uid] && !reqBusy.has(key)) {
      reqBusy.add(key);
      try {
        if (q.mode === 'all') for (const p of (q.type === 'debt' ? q.pays || [] : [q.pay].filter(Boolean))) await cleanMovs(p);
        if (mine(q.by)) toast('✓ Suppression acceptée : ' + reqText(d, q));
        let gone = false;                                               // le dernier des deux à avoir nettoyé ses comptes efface l'avance
        await updateDebt({ d, home: { shared: d.id } }, x => { const z = (x.reqs || []).find(r => r.id === q.id); if (!z) return; z.done = Object.assign({}, z.done, { [currentUser.uid]: true });
          const all = x.members.every(u => z.done[u]); if (all && q.type === 'pay') x.reqs = x.reqs.filter(r => r.id !== q.id); gone = all && q.type === 'debt'; });
        if (gone) await db.collection('pdebts').doc(d.id).delete();
      } catch (er) { reqBusy.delete(key); console.warn('Suppression', er); }
    }
  }
}
function debtReqsMsgHTML() {
  const L = pendingForMe(); if (!L.length) return '';
  return `<section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Demandes de suppression</h2>
    ${L.map(({ d, q }) => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="gemo">${esc(d.emo || '💸')}</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(shortName(d.emails?.[q.by]))}</b> veut ${esc(reqText(d, q))}</span><span class="rs">Avance partagée · ${ago(q.at)}</span></span>
      <span class="chips"><button class="btn sm p" data-a="dreq-yes" data-id="${d.id}" data-r="${q.id}">Accepter</button><button class="btn sm" data-a="dreq-no" data-id="${d.id}" data-r="${q.id}">Refuser</button></span></div>`).join('')}
  </section>`;
}
// Avance partagée : chacun règle son propre compte (où il reçoit / d'où il rembourse)
function sharedEditDialog(e) {
  const d = e.d, iL = mine(lenderOf(d).uid), me = iL ? lenderOf(d) : borrowerOf(d), A = allAccs();
  formDialog({ title: 'Modifier · ' + d.name, intro: 'Avance partagée avec ' + shortName((iL ? borrowerOf(d) : lenderOf(d)).email) + '.',
    fields: [{ id: 'name', label: 'Pour quoi ?', value: d.name }, { id: 'amount', label: 'Montant avancé', type: 'num', value: d.amount },
      { id: 'acc', label: iL ? 'Sur quel compte je reçois les remboursements ?' : 'Depuis quel compte je rembourse ?', type: 'select', options: A.map(a => ACC[a].name), value: ACC[me.acc]?.name || ACC[recvAccount()]?.name }],
    onDelete: () => removeDebt(e),
    onSave: r => {
      if (!r.name || !(r.amount > 0)) { toast('Nom et montant obligatoires'); return false; }
      const acc = A.find(a => ACC[a].name === r.acc);
      const her = !iL ? pickedAcc('f_acc') : {};
      updateDebt(e, x => { x.name = r.name; x.amount = r.amount; const s = iL ? x.lender : x.borrower; s.acc = acc; s.accName = ACC[acc]?.name || ''; if (her.acc) Object.assign(x.lender, her); }).then(() => toast('Avance modifiée'));
    } });
  if (!iL) personAccPicker('f_acc', p => 'Sur quel compte de ' + esc(shortName(p.email)) + ' la rembourser ?', () => lenderOf(d), lenderOf(d).acc);
}

/* ---------- Fiche d'une avance ---------- */
function debtView(id) {
  const e = findDebt(id); if (!e) return; const d = e.d, i = debtInfo(d), P_ = (d.payments || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const L = lenderOf(d, e.home.acc), B = borrowerOf(d);
  const dl = $('dlg'); dl.onclick = null;
  dl.innerHTML = `<div class="dw" style="max-height:88vh;overflow:auto"><div class="dh"><h2>${esc(d.emo || '💸')} ${esc(d.name)}</h2><button class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    <div class="dwho"><span><small>A avancé</small><b>${esc(sideLabel(L) || '—')}</b></span>${svg('right', 16)}<span><small>Rembourse</small><b>${esc(sideLabel(B) || '—')}</b></span></div>
    <div class="dbig"><span class="note">${i.done ? 'Tout est remboursé 🎉' : 'Reste à rembourser'}</span><b class="num">${eur(i.left)}</b><span class="note">sur ${eur(i.t)} avancés · <b style="color:var(--ink)">${Math.round(i.p)} % remboursé</b></span>
      <span class="bar" style="display:block;height:10px"><i style="width:${i.p}%;--c:${i.done ? 'var(--ok)' : '#F59E0B'}"></i></span></div>
    ${(d.reqs || []).filter(q => q.status === 'pending').map(q => mine(q.by) ? `<div class="alert"><span>⏳ En attente de l'accord de ${esc(shortName(d.emails?.[d.members.find(u => !mine(u))]))} pour ${esc(reqText(d, q))}.</span><button class="lnk" data-rq-cancel="${q.id}">Annuler</button></div>`
      : `<div class="alert bad" style="flex-wrap:wrap"><span>${esc(shortName(d.emails?.[q.by]))} veut ${esc(reqText(d, q))}.</span><span class="chips"><button class="btn sm p" data-rq-yes="${q.id}">Accepter</button><button class="btn sm" data-rq-no="${q.id}">Refuser</button></span></div>`).join('')}
    ${d.grp ? `<button class="dopt" data-grp style="width:100%">👥 <span><b>Partage « ${esc(d.grp.name)} » · ${eur(d.grp.total)}</b><small>${esc(d.grp.parts.map(p => p.who + ' ' + eur(p.amount)).join(' · '))}${mine(d.grp.by) || myAcc(lenderAcc(e)) ? ' · voir tout' : ''}</small></span></button>` : ''}
    ${invPending(d) ? `<div class="alert"><span>⏳ Demande envoyée à ${esc(sideLabel(B))} : en attente de son accord.</span></div>` : ''}
    ${invDeclined(d) ? `<div class="alert bad" style="flex-wrap:wrap"><span>❌ ${esc(sideLabel(B))} a refusé cette part.</span><span class="chips"><button class="btn sm" data-dec="keep">Garder en suivi perso</button><button class="btn sm" data-dec="resend">Renvoyer</button><button class="btn sm" data-dec="drop">Retirer</button></span></div>` : ''}
    ${d.arch ? `<div class="alert"><span>🗂️ Clôturée le ${fmtD(d.arch.at)}${d.arch.left > 0 ? ' : ' + eur(d.arch.left) + ' abandonnés' : ''}. Elle est dans l'historique.</span><button class="lnk" data-reopen>Rouvrir</button></div>` : ''}
    ${i.done || d.arch || invDeclined(d) ? '' : `<button class="btn p big" data-pay>${svg('plus', 18)} Enregistrer un remboursement</button>
    <div class="dopts">
      <button class="dopt" data-auto>${d.auto ? `🔁 <span><b>${eur(d.auto.amount)} le ${d.auto.day} de chaque mois</b><small>prochain : ${fmtD(d.auto.next + '-' + String(Math.min(d.auto.day, dim(d.auto.next))).padStart(2, '0'))} · fin prévue ${mlab(autoEnd(d)).toLowerCase()}${d.auto.by !== currentUser.uid ? ' · réglé par ' + esc(shortName(d.emails?.[d.auto.by] || '')) : ''}</small></span>` : '🔁 <span><b>Remboursement automatique</b><small>ex. 20 € le 5 de chaque mois, jusqu\'au bout</small></span>'}</button>
      <button class="dopt" data-comp>↔ <span><b>Dépense commune</b><small>payée par l'un de vous : déduite ou ajoutée, sans virement</small></span></button>
      <button class="dopt" data-remind>${d.remind ? `🔔 <span><b>Rappel</b><small>${esc(remindText(d.remind))}</small></span>` : '🔔 <span><b>Rappel</b><small>choisis quand être prévenu</small></span>'}</button>
    </div>`}
    <div style="display:flex;flex-direction:column;gap:2px"><b style="font-size:14px">Remboursements ${P_.length ? '(' + P_.length + ')' : ''}</b>
      ${P_.map(p => p.comp ? compRowHTML(p, d) : `<div class="row prow" style="padding:8px 4px"><button class="rowb" data-pedit="${p.id}" style="flex:1;min-width:0"><span class="ico sm" style="--c:#10B981">${svg('up', 17)}</span><span class="rt"><span class="rn">${esc(p.label || 'Remboursement')}</span><span class="rs">${new Date(p.date + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${esc(p.fromName || 'Autre')} → ${esc(p.toName || '')}${p.by && p.by !== currentUser.uid ? ' · saisi par ' + esc(shortName(d.emails?.[p.by] || '')) : ''}${p.ed ? ' · modifié' : ''}</span></span><b class="num" style="color:var(--ok)">+${eur(p.amount)}</b></button>${!p.by || p.by === currentUser.uid ? `<button class="x" data-del="${p.id}" aria-label="Supprimer ce remboursement">${svg('trash', 15)}</button>` : ''}</div>`).join('') || '<p class="note" style="padding:6px 4px">Aucun remboursement pour l\'instant.</p>'}</div>
    <div class="dact"><button class="btn" data-ed>Modifier</button><button class="btn" data-x>Fermer</button></div></div>`;
  dl.onclick = ev => {
    if (ev.target.closest('[data-x]')) return dl.close();
    if (ev.target.closest('[data-ed]')) { dl.close(); return debtDialog(id); }
    if (ev.target.closest('[data-pay]')) { dl.close(); return payDialog(id); }
    if (ev.target.closest('[data-auto]')) { dl.close(); return autoDialog(id); }
    if (ev.target.closest('[data-remind]')) { dl.close(); return remindDialog(id); }
    if (ev.target.closest('[data-comp]')) { dl.close(); return compDialog(id); }
    const pe = ev.target.closest('[data-pedit]'); if (pe) { dl.close(); return payEditDialog(id, pe.dataset.pedit); }
    if (ev.target.closest('[data-grp]')) { if ((mine(d.grp.by) || myAcc(lenderAcc(e))) && d.grp.id) { dl.close(); return setTimeout(() => groupView(d.grp.id), 50); } return; }
    const dec = ev.target.closest('[data-dec]'); if (dec) { dl.close(); return declinedAction(id, dec.dataset.dec); }
    if (ev.target.closest('[data-reopen]')) { updateDebt(e, x => { delete x.arch; }).then(() => { toast('Avance rouverte'); render(); setTimeout(() => debtView(id), 300); }); return; }
    const del = ev.target.closest('[data-del]'); if (del) { dl.close(); return payDelete(id, del.dataset.del).then(() => setTimeout(() => debtView(id), 400)); }
    const ry = ev.target.closest('[data-rq-yes],[data-rq-no]'); if (ry) { const rid = ry.dataset.rqYes || ry.dataset.rqNo; debtAnswer(id, rid, !!ry.dataset.rqYes).then(() => setTimeout(() => { dl.close(); if (findDebt(id)) debtView(id); }, 400)); return; }
    const rc = ev.target.closest('[data-rq-cancel]'); if (rc) { updateDebt(findDebt(id), x => { x.reqs = (x.reqs || []).filter(q => q.id !== rc.dataset.rqCancel); }).then(() => setTimeout(() => debtView(id), 300)); return; }
  };
  if (!dl.open) dl.showModal();
}

/* ---------- Remboursement ---------- */
// Écrit dans un mois d'un de mes comptes : le compte affiché directement, un autre par transaction (son solde suit)
function onAcc(acc, k, fn) {
  if (acc === active) { mutate(() => fn(month(k)), false); return Promise.resolve(); }
  return txMonth(acc, k, fn);
}
async function payTargets(e) {
  const d = e.d, L = lenderOf(d, e.home.acc), B = borrowerOf(d);
  const A = allAccs(), nm = a => ACC[a].name + (a === active ? ' (ce compte)' : ''), OTHER = 'Autre : espèces, quelqu\'un d\'autre…';
  const lenderIsOther = !lenderIsMine(L);
  let TO = A.map(a => [nm(a), { acc: a }]), toDef = lenderAcc(e);
  if (lenderIsOther) {
    const D = await dirOf(L.email);
    if (!D || !(D.accounts || []).length) TO = [['Son compte de réception (' + shortName(L.email) + ')', { user: L, acc: L.acc || '' }]];
    else TO = D.accounts.map(a => [a.name + ' · ' + shortName(L.email), { user: L, acc: a.id, accName: a.name }]);
    toDef = L.acc || D?.recv;
  }
  const fromDef = B.kind === 'acc' ? B.acc : B.kind === 'user' && mine(B.uid) ? borrowerAcc(e) : null;
  const fromLab = fromDef ? nm(fromDef) : (B.kind === 'user' && !mine(B.uid)) || B.kind === 'text' ? OTHER : A[0] ? nm(A[0]) : OTHER;
  return { A, nm, OTHER, TO, toLab: (TO.find(t => t[1].acc === toDef) || TO[0])[0], fromLab, lenderIsOther, FROM: A.map(nm).concat([OTHER]) };
}
async function payDialog(id) {
  const e = findDebt(id); if (!e) return; const d = e.d, i = debtInfo(d), L = lenderOf(d, e.home.acc), B = borrowerOf(d);
  const A = allAccs(), nm = a => ACC[a].name + (a === active ? ' (ce compte)' : ''), OTHER = 'Autre : espèces, quelqu\'un d\'autre…';
  const lenderIsOther = !lenderIsMine(L);
  // Vers : mes comptes, ou les comptes de la personne (si connectés)
  let TO = A.map(a => [nm(a), { acc: a }]), toDef = lenderAcc(e);
  if (lenderIsOther) {
    let D = null; try { const s = await db.collection('directory').doc(L.email).get(); D = s.exists ? s.data() : null; } catch (er) {}
    if (!D || !(D.accounts || []).length) TO = [['Son compte de réception (' + shortName(L.email) + ')', { user: L, acc: L.acc || '' }]];
    else TO = D.accounts.map(a => [a.name + ' · ' + shortName(L.email), { user: L, acc: a.id, accName: a.name }]);
    toDef = L.acc || D?.recv;
  }
  const fromDef = B.kind === 'acc' ? B.acc : B.kind === 'user' && mine(B.uid) ? borrowerAcc(e) : null;
  let last = null; try { last = localStorage.getItem('payFrom'); } catch (er) {}
  const outside = B.kind === 'text' || (B.kind === 'user' && !mine(B.uid));   // c'est quelqu'un d'autre qui rembourse
  const fromSel = fromDef || (!outside && A.includes(last) && last !== toDef ? last : null);
  const toLab = (TO.find(t => t[1].acc === toDef) || TO[0])[0];
  formDialog({ title: 'Remboursement · ' + d.name, intro: `Reste ${eur(i.left)} à rembourser.`, ok: 'Enregistrer',
    fields: [{ id: 'amt', label: 'Montant', type: 'num', value: i.left, ph: '0,00' },
      { id: 'date', label: 'Date', value: todayISO() },
      { id: 'from', label: 'Depuis quel compte ? (l\'argent sort)', type: 'select', options: A.map(nm).concat([OTHER]), value: fromSel ? nm(fromSel) : ((B.kind === 'user' && !mine(B.uid)) || B.kind === 'text' ? OTHER : A.find(x => x !== toDef) ? nm(A.find(x => x !== toDef)) : OTHER) },
      { id: 'to', label: 'Vers quel compte ? (l\'argent arrive)', type: 'select', options: TO.map(t => t[0]), value: toLab, hint: lenderIsOther ? 'Le virement lui arrive en direct sur ce compte.' : 'Les deux comptes sont mis à jour tout de suite.' },
      { id: 'label', label: 'Libellé', value: 'Remboursement ' + d.name, ph: 'Remboursement…' }],
    onSave: r => {
      const amt = Math.round(num(r.amt) * 100) / 100;
      if (!(amt > 0)) { toast('Indique un montant'); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) { toast('Choisis une date'); return false; }
      const f = A.find(a => nm(a) === r.from) || null, t = (TO.find(x => x[0] === r.to) || [])[1];
      if (!t) { toast('Choisis le compte qui reçoit'); return false; }
      if (!t.user && f === t.acc) { toast('Choisis deux comptes différents'); return false; }
      if (t.user && !f) { toast('Choisis le compte d\'où part le virement'); return false; }
      if (amt > i.left + 0.001 && !confirm(`Ce montant dépasse ce qu'il reste (${eur(i.left)}). Enregistrer quand même ?`)) return false;
      try { localStorage.setItem('payFrom', f || ''); } catch (er) {}
      payCreate(id, { amount: amt, date: r.date, from: f, to: t, label: r.label.trim() || 'Remboursement ' + d.name });
    } });
  $('f_date').type = 'date';
}
async function payCreate(id, p, opt = {}) {
  const e = findDebt(id); if (!e) return; const d = e.d;
  const k = p.date.slice(0, 7), dd = String(+p.date.slice(8, 10)), xid = uid(), incId = uid(), expId = uid();
  const fromName = p.from ? ACC[p.from].name : 'Autre', toUser = p.to.user, toName = toUser ? (p.to.accName || 'compte de ' + shortName(toUser.email)) : ACC[p.to.acc].name;
  const pay = { auto: !!opt.auto, id: uid(), amount: p.amount, date: p.date, label: p.label, from: p.from || '', fromName, to: toUser ? '' : p.to.acc, toName, toUser: toUser ? toUser.email : '', k, inc: toUser ? '' : incId, exp: p.from ? expId : '', xid: p.from ? xid : '', by: currentUser.uid };
  const jobs = [updateDebt(e, x => { (x.payments = x.payments || []).push(pay); })];
  if (!toUser) {
    jobs.push(onAcc(p.to.acc, k, m => m.incomes.unshift(Object.assign({ id: incId, name: p.label, amount: p.amount, date: dd, status: 'Reçu', isFixed: false, debt: id },
      p.from ? { xfer: { id: xid, kind: 'acc', acc: p.from, accName: fromName } } : {}, isShared(p.to.acc) ? { by: currentUser.email } : {}))));
    if (p.from) jobs.push(onAcc(p.from, k, m => m.expenses.unshift({ id: expId, name: p.label, amount: p.amount, date: dd, status: 'Payé', cat: 'Virement', isFixed: false, isDivided: false, debt: id, xfer: { id: xid, kind: 'acc', acc: p.to.acc, accName: toName } })));
  } else {
    // vers le compte d'une autre personne : virement « vers une personne », reçu en direct chez elle
    jobs.push(onAcc(p.from, k, m => m.expenses.unshift({ id: expId, name: p.label, amount: p.amount, date: dd, status: 'Payé', cat: 'Virement', isFixed: false, isDivided: false, debt: id, xfer: Object.assign({ id: xid, kind: 'person', to: toUser.email }, p.to.accName ? { toAccName: p.to.accName } : {}) })));
    jobs.push(db.collection('transfers').doc(xid).set(Object.assign({ from: currentUser.uid, fromEmail: currentUser.email, to: toUser.email, amount: p.amount, label: p.label, date: dd, k, site: '', img: '', status: 'sent', at: Date.now(), debt: id }, p.to.acc ? { toAcc: p.to.acc, toAccName: p.to.accName || '' } : {})));
  }
  const res = await Promise.allSettled(jobs);
  const bad = res.some(r => r.status === 'rejected');
  if ((opt.leftBefore ?? debtInfo(d).left) - p.amount <= 0.005) await updateDebt(findDebt(id) || e, x => { if (debtInfo(x).done) { x.doneAt = x.doneAt || Date.now(); delete x.auto; } }).catch(() => {});
  if (opt.silent) return !bad;
  toast(bad ? '⚠ Un des comptes n\'a pas pu être mis à jour. Vérifie ta connexion.' : '+' + eur(p.amount) + ' remboursés · ' + d.name);
  setTimeout(() => { const n2 = findDebt(id); if (n2 && debtInfo(n2.d).done) toast('🎉 « ' + d.name + ' » est entièrement remboursé !'); debtView(id); }, 500);
}
async function payDelete(id, pid) {
  const e = findDebt(id); const p = e && (e.d.payments || []).find(x => x.id === pid); if (!p) return;
  const mode = await askDeleteMode('ce remboursement de ' + eur(p.amount), payHasMov(p), !!e.home.shared); if (!mode) return;
  if (e.home.shared) return debtRequest(e, { type: 'pay', pid, mode });
  if (mode === 'all') await cleanMovs(Object.assign({}, p, { inc: p.inc, exp: p.exp }));
  await updateDebt(e, x => { x.payments = (x.payments || []).filter(z => z.id !== pid); });
  warnMembers(e, 'Remboursement de ' + eur(p.amount) + ' supprimé sur « ' + e.d.name + ' »' + (mode === 'keep' ? ' (mouvements gardés)' : ''));
  toast('Remboursement supprimé' + (mode === 'keep' ? ' · mouvements gardés' : ''));
}
// Un « objectif » qui était en fait un remboursement → devient une avance
function goalToDebt(g) {
  $('dlg').close();
  const payments = num(g.saved) > 0 ? [{ id: uid(), amount: num(g.saved), date: todayISO(), label: 'Déjà remboursé (repris de l\'objectif)', from: '', fromName: 'Autre', to: '', toName: '', k: nowK(), inc: '', xid: '', by: currentUser.uid }] : [];
  debtDialog(null, { name: g.name.replace(/^rembours[ée]+s?\s*/i, '').replace(/^\w/, c => c.toUpperCase()), amount: g.target, emo: g.emo && g.emo !== '🎯' ? g.emo : '💸', payments, fromGoal: g.id, lender: { kind: 'acc', acc: active } });
}

/* ============================== REMBOURSEMENT AUTOMATIQUE ==============================
   « 20 € le 5 de chaque mois jusqu'au bout » : à la date prévue, l'app enregistre le remboursement (et ses mouvements)
   tout seule, dans l'app de celui qui l'a réglé. Elle s'arrête quand tout est remboursé.                                  */
function autoEnd(d) { const a = d.auto; if (!a) return ''; const n = Math.max(1, Math.ceil(debtInfo(d).left / Math.max(0.01, num(a.amount)))); return kAdd(a.next, n - 1); }
async function autoDialog(id) {
  const e = findDebt(id); if (!e) return; const d = e.d, i = debtInfo(d), T = await payTargets(e), a = d.auto;
  const nextDef = today() <= 28 ? nowK() : kAdd(nowK(), 1);
  formDialog({ title: '🔁 Remboursement automatique', intro: `Reste ${eur(i.left)}. Chaque mois à la date choisie, l'app enregistre le remboursement et les mouvements, jusqu'à ce que tout soit remboursé. Pense à programmer le même virement dans ta banque.`,
    ok: a ? 'Enregistrer' : 'Activer', delLabel: 'Arrêter', onDelete: a ? () => updateDebt(e, x => { delete x.auto; }).then(() => { toast('Remboursement automatique arrêté'); render(); }) : null,
    fields: [{ id: 'amt', label: 'Montant chaque mois', type: 'num', value: a?.amount ?? Math.min(i.left, Math.ceil(i.left / 3)), ph: 'ex. 20' },
      { id: 'day', label: 'Le combien du mois ?', value: a?.day ?? 5, ph: 'ex. 5' },
      { id: 'start', label: 'À partir de', value: a?.next || nextDef },
      { id: 'from', label: 'Depuis quel compte ?', type: 'select', options: T.FROM, value: a ? (a.from ? T.nm(a.from) : T.OTHER) : T.fromLab },
      { id: 'to', label: 'Vers quel compte ?', type: 'select', options: T.TO.map(t => t[0]), value: a ? (T.TO.find(t => t[1].acc === (a.to?.acc ?? a.to)) || T.TO[0])[0] : T.toLab }],
    onSave: r => {
      const amt = Math.round(num(r.amt) * 100) / 100, day = parseInt(r.day);
      if (!(amt > 0)) { toast('Indique le montant mensuel'); return false; }
      if (!(day >= 1 && day <= 31)) { toast('Jour entre 1 et 31'); return false; }
      if (!/^\d{4}-\d{2}$/.test(r.start)) { toast('Choisis le mois de départ'); return false; }
      const f = T.A.find(x => T.nm(x) === r.from) || null, to = (T.TO.find(x => x[0] === r.to) || [])[1];
      if (!to || (!to.user && f === to.acc)) { toast('Choisis deux comptes différents'); return false; }
      if (to.user && !f) { toast('Choisis le compte d\'où part le virement'); return false; }
      const auto = { amount: amt, day, next: r.start, from: f || '', to: to.user ? { user: to.user, acc: to.acc, accName: to.accName || '' } : { acc: to.acc }, by: currentUser.uid, label: 'Remboursement ' + d.name };
      updateDebt(e, x => { x.auto = auto; }).then(() => { toast('🔁 ' + eur(amt) + ' le ' + day + ' de chaque mois'); render(); setTimeout(() => autoRun(true), 1200); setTimeout(() => debtView(id), 600); });
    } });
  $('f_start').type = 'month';
}
let autoBusy = false, autoLast = 0;
async function autoRun(force) {
  if (autoBusy || !loaded || !currentUser || (!force && Date.now() - autoLast < 30000)) return; autoBusy = true; autoLast = Date.now();
  try {
    for (const e0 of allDebts()) {
      const e = e0; if (!e.d.auto || e.d.auto.by !== currentUser.uid || e.d.arch || debtInfo(e.d).done || (e.d.invite && e.d.invite.status !== 'accepted')) continue;
      const a = Object.assign({}, e.d.auto); let guard = 0;
      while (guard++ < 24) {
        const k = a.next, dd = Math.min(a.day, dim(k));
        if (k > nowK() || (k === nowK() && today() < dd)) break;
        let claimed = false, leftNow = 0;                       // on réserve l'échéance avant d'écrire (pas de doublon)
        await updateDebt(e, x => { if (x.auto && x.auto.next === k) { x.auto.next = kAdd(k, 1); claimed = true; leftNow = debtInfo(x).left; } else claimed = false; });
        if (!claimed) break;
        const amt = Math.min(num(a.amount), leftNow);
        const to = a.to?.user ? { user: a.to.user, acc: a.to.acc, accName: a.to.accName } : { acc: a.to?.acc ?? a.to };
        if (amt > 0 && (to.user || ACC[to.acc])) { await payCreate(e.d.id, { amount: Math.round(amt * 100) / 100, date: k + '-' + String(dd).padStart(2, '0'), from: a.from && ACC[a.from] ? a.from : null, to, label: a.label || 'Remboursement ' + e.d.name }, { silent: true, auto: true, leftBefore: leftNow });
          toast('🔁 Remboursement automatique : ' + eur(amt) + ' · ' + e.d.name); }
        a.next = kAdd(k, 1); if (leftNow - amt <= 0.005) break;      // échéance suivante (sans attendre la synchro)
      }
    }
  } catch (er) { console.warn('Auto', er); }
  finally { autoBusy = false; }
}

/* ============================== RAPPELS (critère choisi par l'utilisateur) ============================== */
const RM = { none: 'Aucun rappel', idle: 'Si aucun remboursement depuis… (jours)', monthly: 'Chaque mois, à une date', deadline: 'Avant une date limite' };
function remindText(r) {
  if (!r) return '';
  return r.type === 'idle' ? 'si rien depuis ' + r.days + ' jours' : r.type === 'monthly' ? 'le ' + r.day + ' de chaque mois s\'il reste quelque chose' : r.type === 'deadline' ? 'à rembourser avant le ' + fmtD(r.date) + (r.before ? ' (prévenir ' + r.before + ' j avant)' : '') : '';
}
function remindDialog(id) {
  const e = findDebt(id); if (!e) return; const r = e.d.remind || {};
  formDialog({ title: '🔔 Rappel · ' + e.d.name, intro: 'Choisis quand être prévenu (sur l\'accueil, dans la cloche et en notification). Le rappel est visible des deux côtés.',
    fields: [{ id: 'type', label: 'Me prévenir', type: 'select', options: Object.values(RM), value: RM[r.type || 'idle'] },
      { id: 'days', label: 'Nombre de jours sans remboursement', value: r.days ?? 30, ph: 'ex. 30' },
      { id: 'day', label: 'Jour du mois', value: r.day ?? 5, ph: 'ex. 5' },
      { id: 'date', label: 'Date limite', value: r.date || '' },
      { id: 'before', label: 'Prévenir combien de jours avant ?', value: r.before ?? 7, ph: 'ex. 7' }],
    onSave: v => {
      const type = Object.keys(RM).find(k => RM[k] === v.type); let rem = null;
      if (type === 'idle') { const n = parseInt(v.days); if (!(n >= 1)) { toast('Nombre de jours ?'); return false; } rem = { type, days: n }; }
      if (type === 'monthly') { const n = parseInt(v.day); if (!(n >= 1 && n <= 31)) { toast('Jour entre 1 et 31'); return false; } rem = { type, day: n }; }
      if (type === 'deadline') { if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) { toast('Choisis la date limite'); return false; } rem = { type, date: v.date, before: Math.max(0, parseInt(v.before) || 0) }; }
      updateDebt(e, x => { if (rem) x.remind = rem; else delete x.remind; }).then(() => { toast(rem ? '🔔 Rappel : ' + remindText(rem) : 'Rappel retiré'); render(); setTimeout(() => debtView(id), 300); });
    } });
  $('f_date').type = 'date';
  // n'afficher que les champs utiles au choix
  const show = () => { const t = Object.keys(RM).find(k => RM[k] === $('f_type').value); [['days', 'idle'], ['day', 'monthly'], ['date', 'deadline'], ['before', 'deadline']].forEach(([f, ty]) => { $('f_' + f).closest('label').hidden = t !== ty; }); };
  $('f_type').addEventListener('change', show); show();
}
// Rappels déclenchés pour le compte affiché (repris dans les alertes : accueil, cloche, notifications)
function debtAlerts() {
  const out = [], now = new Date(), td = todayISO();
  allDebts().filter(e => !e.d.arch && !invDeclined(e.d) && !debtInfo(e.d).done && e.d.remind && (lenderAcc(e) === active || borrowerAcc(e) === active)).forEach(e => {
    const d = e.d, r = d.remind, left = eur(debtInfo(d).left), role = lenderAcc(e) === active ? 'à recevoir' : 'à rembourser';
    if (r.type === 'idle') { const last = lastPay(d) ? new Date(lastPay(d) + 'T12:00') : new Date(d.at || Date.now()), n = Math.floor((now - last) / 864e5);
      if (n >= r.days) out.push({ id: 'dr_' + d.id + '_' + (lastPay(d) || 'c'), lvl: 'warn', text: `🔔 « ${d.name} » : aucun remboursement depuis ${n} jours (${left} ${role})`, go: 'budgets' }); }
    if (r.type === 'monthly' && today() >= r.day && !(d.payments || []).some(p => p.date.slice(0, 7) === nowK()))
      out.push({ id: 'dr_' + d.id + '_' + nowK(), lvl: 'warn', text: `🔔 « ${d.name} » : rappel du ${r.day} · ${left} ${role}`, go: 'budgets' });
    if (r.type === 'deadline') { const n = Math.round((new Date(r.date + 'T12:00') - new Date(td + 'T12:00')) / 864e5);
      if (n < 0) out.push({ id: 'dr_' + d.id + '_late', lvl: 'bad', text: `🔔 « ${d.name} » : date limite dépassée (${fmtD(r.date)}) · ${left} ${role}`, go: 'budgets' });
      else if (n <= (r.before || 0)) out.push({ id: 'dr_' + d.id + '_' + n, lvl: 'warn', text: `🔔 « ${d.name} » : ${n ? 'plus que ' + n + ' jour' + (n > 1 ? 's' : '') : 'c\'est aujourd\'hui'} avant la date limite · ${left} ${role}`, go: 'budgets' }); }
  });
  return out;
}
