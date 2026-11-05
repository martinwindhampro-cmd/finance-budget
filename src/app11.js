
/* ============================== PARTAGE D'UNE DÉPENSE ==============================
   « J'ai payé 120 € pour 4 » : une part à rembourser par personne (égale ou non).
   • personne connectée → avance partagée (pdebts) avec une DEMANDE qu'elle accepte (et choisit son compte) ou refuse ;
   • simple nom → avance suivie seulement de mon côté.
   Chaque part porte grp = { id, name, total, mine, n, parts:[{who, amount}] } pour afficher le partage complet. */
const SPLIT_TXT = 'Quelqu\'un d\'autre (juste un nom)';
const invPending = d => d.invite && d.invite.status === 'pending';
const invDeclined = d => d.invite && d.invite.status === 'declined';
// Les demandes reçues (pas encore acceptées) ne comptent pas encore chez moi
const invNotMine = d => d.invite && d.invite.status !== 'accepted' && mine(borrowerOf(d).uid);
const invitesForMe = () => PDEBTS.filter(d => !d.closed && invPending(d) && mine(borrowerOf(d).uid));
const declinedForMe = () => PDEBTS.filter(d => !d.closed && invDeclined(d) && mine(lenderOf(d).uid));

let SP = null;
function splitDialog(preset = {}) {
  const A = allAccs().filter(a => ACC[a].kind !== 'epargne'); if (!A.length) return toast('Ajoute d\'abord un compte courant');
  const ppl = linkedPeople().filter(p => p.uid);
  const acc0 = preset.acc || (A.includes(active) ? active : A[0]), oth = allAccs().find(a => a !== acc0);
  SP = { mode: 'eq', me: true, add: !preset.expId, rows: [{ p: ppl[0] ? 'u:' + ppl[0].uid : oth ? 'a:' + oth : 'txt', who: '', amt: '' }], ppl, A, preset };
  const d = $('dlg'); d.onclick = null; d.oninput = null; d.onchange = null;
  d.innerHTML = `<form class="dw" style="max-height:90vh;overflow:auto" novalidate>
    <div class="dh"><h2>👥 Partager une dépense</h2><button type="button" class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    <p class="note">Tu as payé pour plusieurs personnes ? Chacune a sa part à te rembourser. ${ppl.length ? 'Les personnes connectées reçoivent une demande à accepter.' : 'Pour envoyer une demande à quelqu\'un, connecte-toi d\'abord à lui (Paramètres › Mes connexions).'}</p>
    <label class="fl">Pour quoi ?<input class="in" id="sp-name" value="${esc(preset.name || '')}" placeholder="ex. Restaurant, Airbnb, Cadeau"></label>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      <label class="fl">Total payé<input class="in" id="sp-tot" inputmode="decimal" value="${esc(preset.amount != null ? fmtIn(preset.amount) : '')}" placeholder="ex. 120"></label>
      <label class="fl">Payé depuis<select class="in" id="sp-acc">${A.map(a => `<option value="${a}" ${a === acc0 ? 'selected' : ''}>${esc(ACC[a].name)}</option>`).join('')}</select></label>
    </div>
    ${preset.expId ? '' : `<label class="chk"><input type="checkbox" id="sp-add" checked>Ajouter aussi la dépense dans ce compte</label>`}
    <div class="fl">Répartition<div class="seg" role="group"><button type="button" class="on" data-sp-mode="eq">Parts égales</button><button type="button" data-sp-mode="free">Montants libres</button></div></div>
    <label class="chk"><input type="checkbox" id="sp-me" checked><span id="sp-me-l">${spMeLabel(acc0)}</span></label>
    <div id="sp-rows" style="display:flex;flex-direction:column;gap:8px"></div>
    <button type="button" class="btn sm" data-sp-add style="align-self:flex-start">${svg('plus', 15)} Ajouter une personne</button>
    <label class="chk" id="sp-comp-l" hidden><input type="checkbox" id="sp-comp" checked>Déduire des avances en cours (comme Tricount)</label>
    <div id="sp-compi" class="note" style="font-size:12.5px;display:flex;flex-direction:column;gap:2px"></div>
    <div id="sp-sum" class="spsum"></div>
    <div class="dact"><button type="button" class="btn" data-x>Annuler</button><button class="btn p" id="sp-ok">Créer le partage</button></div></form>`;
  splitRows(); splitSum();
  d.onclick = ev => {
    if (ev.target.closest('[data-x]')) return d.close();
    const m = ev.target.closest('[data-sp-mode]'); if (m) { splitRead(); SP.mode = m.dataset.spMode; d.querySelectorAll('[data-sp-mode]').forEach(b => b.classList.toggle('on', b === m)); splitRows(); return splitSum(); }
    if (ev.target.closest('[data-sp-add]')) { splitRead(); const used = SP.rows.map(r => r.p); const nx = SP.ppl.find(p => !used.includes('u:' + p.uid)); SP.rows.push({ p: nx ? 'u:' + nx.uid : 'txt', who: '', amt: '' }); splitRows(); splitSum(); return d.querySelector('#sp-rows .sprow:last-child select')?.focus(); }
    const rm = ev.target.closest('[data-sp-rm]'); if (rm) { splitRead(); SP.rows.splice(+rm.dataset.spRm, 1); splitRows(); return splitSum(); }
  };
  d.oninput = () => { splitRead(); splitSum(); };
  d.onchange = ev => { splitRead();
    if (ev.target.id === 'sp-acc') { $('sp-me-l').textContent = spMeLabel(ev.target.value); SP.rows.forEach(r => { if (r.p === 'a:' + ev.target.value) r.p = 'txt'; }); splitRows(); }
    if (ev.target.matches('.sprow select')) splitRows(); splitSum(); };
  d.querySelector('form').onsubmit = ev => { ev.preventDefault(); splitRead(); splitSave(); };
  d.showModal(); (preset.name ? $('sp-me') : $('sp-name')).focus();
}
function splitRead() {
  if (!SP) return;
  SP.me = $('sp-me').checked; SP.comp = !$('sp-comp') || $('sp-comp').checked; SP.add = $('sp-add') ? $('sp-add').checked : false;
  document.querySelectorAll('#sp-rows .sprow').forEach((el, i) => { const r = SP.rows[i]; if (!r) return;
    r.p = el.querySelector('select').value; const w = el.querySelector('[data-who]'); if (w) r.who = w.value; const a = el.querySelector('[data-amt]'); if (a && SP.mode === 'free') r.amt = a.value; });
}
function splitRows() {
  const used = SP.rows.map(r => r.p);
  $('sp-rows').innerHTML = SP.rows.map((r, i) => `<div class="sprow">
    <select class="in" aria-label="Personne ${i + 1}">${allAccs().map(a => `<option value="a:${a}" ${r.p === 'a:' + a ? 'selected' : ''} ${a === $('sp-acc').value || (used.includes('a:' + a) && r.p !== 'a:' + a) ? 'disabled' : ''}>🏦 ${esc(ACC[a].name)}</option>`).join('')}${SP.ppl.map(p => `<option value="u:${p.uid}" ${r.p === 'u:' + p.uid ? 'selected' : ''} ${used.includes('u:' + p.uid) && r.p !== 'u:' + p.uid ? 'disabled' : ''}>👤 ${esc(shortName(p.email))}</option>`).join('')}<option value="txt" ${r.p === 'txt' ? 'selected' : ''}>${SPLIT_TXT}</option></select>
    ${r.p === 'txt' ? `<input class="in" data-who value="${esc(r.who)}" placeholder="Son nom" aria-label="Son nom">` : ''}
    <input class="in num" data-amt inputmode="decimal" aria-label="Sa part" ${SP.mode === 'eq' ? 'readonly tabindex="-1"' : ''} value="${esc(r.amt)}" placeholder="sa part">
    <button type="button" class="x" data-sp-rm="${i}" aria-label="Retirer" ${SP.rows.length < 2 ? 'disabled' : ''}>${svg('x', 15)}</button></div>`).join('');
}
// Parts en centimes : égales (les centimes en trop pour moi si je participe, sinon pour les premiers)
function splitShares() {
  const T = Math.round(parseAmt($('sp-tot').value || '0') * 100), n = SP.rows.length;
  if (SP.mode === 'eq') {
    const k = n + (SP.me ? 1 : 0), base = Math.floor(T / k), rem = T - base * k;
    const parts = SP.rows.map((_, i) => base + (!SP.me && i < rem ? 1 : 0));
    return { T, parts, mine: SP.me ? base + rem : 0, ok: T > 0 };
  }
  const parts = SP.rows.map(r => Math.round(parseAmt(r.amt || '0') * 100)), rest = T - parts.reduce((s, x) => s + x, 0);
  return { T, parts, mine: SP.me ? rest : 0, rest, ok: T > 0 && (SP.me ? rest >= 0 : rest === 0) };
}
function splitSum() {
  const s = splitShares(), c = v => eur(v / 100);
  if (SP.mode === 'eq') document.querySelectorAll('#sp-rows [data-amt]').forEach((el, i) => { el.value = s.T > 0 ? fmtIn(s.parts[i] / 100) : ''; });
  const others = s.parts.reduce((a, b) => a + b, 0);
  $('sp-sum').innerHTML = s.T <= 0 ? '<span class="note">Indique le total payé.</span>'
    : SP.mode === 'free' && !s.ok ? `<b style="color:var(--bad)">${s.rest > 0 ? 'Reste ' + c(s.rest) + ' à répartir' : 'Dépasse le total de ' + c(-s.rest)}</b>`
    : `<span>À récupérer <b class="num">${c(others)}</b> · ${SP.rows.length} personne${SP.rows.length > 1 ? 's' : ''}</span>${SP.me ? `<span class="note">Ma part : <b class="num" style="color:var(--ink)">${c(s.mine)}</b></span>` : ''}`;
  // avances déjà en cours avec ces personnes : la part vient en déduction (ou s'ajoute)
  const acc = $('sp-acc').value, M = SP.rows.map(r => spComp(acc, r)), any = M.some(Boolean);
  $('sp-comp-l').hidden = !any; const on = any && $('sp-comp').checked;
  $('sp-compi').innerHTML = on && s.T > 0 ? M.map((m, i) => { if (!m) return ''; const part = s.parts[i], left = Math.round(debtInfo(m.e.d).left * 100), nm = spWho(SP.rows[i]);
    return m.dir > 0 ? `<span>↔ ${esc(nm)} : <b>−${c(Math.min(part, left))}</b> sur les ${c(left)} que « ${esc(ACC[acc].name)} » lui doit${part > left ? ' · le reste (' + c(part - left) + ') devient une avance' : ''}</span>`
      : `<span>↔ ${esc(nm)} : <b>+${c(part)}</b> ajoutés aux ${c(left)} qu'il doit déjà</span>`; }).join('') : '';
  const n = SP.rows.filter((r, i) => r.p.startsWith('u:') && !(on && M[i] && (M[i].dir < 0 || s.parts[i] <= Math.round(debtInfo(M[i].e.d).left * 100)))).length;
  $('sp-ok').textContent = n ? 'Envoyer ' + (n > 1 ? 'les ' + n + ' demandes' : 'la demande') : on && M.every(Boolean) ? 'Déduire' : 'Créer le partage';
}
async function splitSave() {
  const name = $('sp-name').value.trim(), acc = $('sp-acc').value, s = splitShares();
  if (!name) return toast('Indique pour quoi');
  if (!(s.T > 0)) return toast('Indique le total payé');
  if (!s.ok) return toast(s.rest > 0 ? 'Il reste ' + eur(s.rest / 100) + ' à répartir' : 'Les parts dépassent le total');
  // un nom qui est celui d'un de mes comptes → ce compte
  SP.rows.forEach(r => { if (r.p === 'txt') { const a = allAccs().find(x => ACC[x].name.trim().toLowerCase() === r.who.trim().toLowerCase()); if (a && a !== acc) r.p = 'a:' + a; } });
  if (SP.rows.some(r => r.p === 'txt' && !r.who.trim())) return toast('Indique le nom de chaque personne');
  if (SP.rows.some(r => r.p === 'a:' + acc)) return toast('Le compte qui a payé ne peut pas se rembourser lui-même');
  if (s.parts.some(x => x <= 0)) return toast('Chaque part doit être supérieure à 0');
  const gid = uid(), P0 = SP.preset, k = P0.k || nowK(), now = Date.now(), full = s.parts.slice();
  // compensation avec les avances en cours (façon Tricount)
  const comps = [];
  if (SP.comp) SP.rows.forEach((r, i) => { const m = spComp(acc, r); if (!m) return; const part = s.parts[i];
    if (m.dir > 0) { const ded = Math.min(part, Math.round(debtInfo(m.e.d).left * 100)); comps.push({ m, c: ded, i }); s.parts[i] = part - ded; }
    else { comps.push({ m, c: -part, i }); s.parts[i] = 0; } });
  const who = r => r.p === 'txt' ? r.who.trim() : r.p.startsWith('a:') ? ACC[r.p.slice(2)]?.name || 'Compte' : shortName(SP.ppl.find(p => 'u:' + p.uid === r.p)?.email);
  const grp = { id: gid, name, total: s.T / 100, mine: s.mine / 100, me: SP.me, by: currentUser.uid, acc, parts: SP.rows.map((r, i) => ({ who: who(r), amount: full[i] / 100 })) };
  if (SP.me) grp.parts.unshift({ who: ACC[acc].name, amount: s.mine / 100, payer: true });
  const local = [], shared = [];
  SP.rows.forEach((r, i) => {
    if (!(s.parts[i] > 0)) return;                                       // entièrement compensé
    const d = { id: uid(), name, amount: s.parts[i] / 100, emo: '👥', at: now, payments: [], grp };
    if (r.p.startsWith('a:')) { const b = r.p.slice(2); local.push(Object.assign(d, { lender: { kind: 'acc', acc, accName: ACC[acc].name }, borrower: { kind: 'acc', acc: b, accName: ACC[b].name } })); }
    else if (r.p === 'txt') local.push(Object.assign(d, { lender: { kind: 'acc', acc, accName: ACC[acc].name }, borrower: { kind: 'text', who: r.who.trim() } }));
    else { const p = SP.ppl.find(x => 'u:' + x.uid === r.p);
      shared.push(Object.assign(d, { lender: { kind: 'user', uid: currentUser.uid, email: myEmail(), acc, accName: ACC[acc].name }, borrower: { kind: 'user', uid: p.uid, email: p.email },
        invite: { status: 'pending', at: now }, members: [currentUser.uid, p.uid], emails: { [currentUser.uid]: myEmail(), [p.uid]: p.email }, createdBy: currentUser.uid, updatedAt: now })); }
  });
  $('dlg').close(); const add = SP.add, SP0 = SP; SP = null;
  const jobs = shared.map(d => db.collection('pdebts').doc(d.id).set(d)), made = local.length + shared.length;
  const cat = autoCat(name) || 'Autre';
  comps.forEach(z => jobs.push(compAdd(z.m.e, { label: name, tot: s.T / 100, part: full[z.i] / 100, half: SP0.mode === 'eq' && SP0.rows.length === 1 && SP0.me, side: 'B', payer: ACC[acc].name, cat, date: todayISO(), mk: 'other' })));
  if (local.length) {
    if (acc === active) mutate(() => { debts().push(...local); }, false);
    else jobs.push(db.runTransaction(async tx => { const ref = accDoc(acc), sn = await tx.get(ref), o = J(sn.data().meta) || {}; o.debts = (o.debts || []).concat(local); tx.update(ref, { meta: canon(o), updatedAt: Date.now(), updatedBy: currentUser.uid }); }));
  }
  if (add) jobs.push(onAcc(acc, k, m => m.expenses.unshift(Object.assign({ id: uid(), name, amount: s.T / 100, share: s.mine / 100, date: String(today()), status: 'Payé', cat, isFixed: false, isDivided: false }, made ? { split: gid } : {}))));
  else if (P0.expId) jobs.push(onAcc(acc, k, m => { const x = m.expenses.find(e => e.id === P0.expId); if (x) { if (made) x.split = gid; x.share = s.mine / 100; } }));
  const res = await Promise.allSettled(jobs), bad = res.filter(r => r.status === 'rejected');
  shared.forEach(d => pushTo(d.borrower.email, meName() + ' te demande ta part · ' + name, 'iv|' + d.id));
  if (bad.length) console.warn('Partage', bad.map(b => b.reason));
  const cm = comps.map(z => (z.c > 0 ? '−' : '+') + eur(Math.abs(z.c) / 100) + ' ' + (z.c > 0 ? 'déduits' : 'ajoutés') + ' (' + spWho(SP0.rows[z.i]) + ')').join(', ');
  toast(bad.length ? '⚠ Partage incomplet, vérifie ta connexion' : (made ? '👥 Partage créé' + (shared.length ? ' · ' + shared.length + ' demande' + (shared.length > 1 ? 's envoyées' : ' envoyée') : '') + (cm ? ' · ' : '') : '↔ ') + cm);
  render(); if (made) setTimeout(() => groupView(gid), 500); else if (comps[0]) setTimeout(() => debtView(comps[0].m.e.d.id), 500);
}

/* ---------- Affichage d'un partage ---------- */
const grpParts = gid => allDebts().filter(e => e.d.grp?.id === gid);
function grpStats(L) {
  const t = sum(L, e => num(e.d.amount)), left = sum(L, e => e.d.arch || invDeclined(e.d) ? 0 : debtInfo(e.d).left), r = sum(L, e => debtInfo(e.d).r);
  return { t, left, r, p: t > 0 ? Math.min(100, r / t * 100) : 0, wait: L.filter(e => invPending(e.d)).length, no: L.filter(e => invDeclined(e.d)).length };
}
function groupRowHTML(gid, L) {
  const g = L[0].d.grp, s = grpStats(L);
  return `<button class="drow" data-a="grp-open" data-id="${esc(gid)}"><span class="gemo">👥</span>
    <span class="rt"><span class="rn">${esc(g.name)} <span class="note" style="font-weight:500">· ${(n => n + ' personne' + (n > 1 ? 's' : ''))(g.parts ? g.parts.filter(p => !p.payer).length : L.length)}</span></span>
      <span class="rs">Reste <b class="num" style="color:var(--ink)">${eur(s.left)}</b> sur ${eur(s.t)}${s.wait ? ' · ⏳ ' + s.wait : ''}${s.no ? ' · <b style="color:var(--bad)">❌ ' + s.no + ' refus</b>' : ''}</span>
      <span class="bar" style="display:block;margin-top:6px"><i style="width:${s.p}%;--c:#10B981"></i></span></span>
    <b class="num dpct">${Math.round(s.p)} %</b></button>`;
}
function groupHistRowHTML(gid, L) {
  const g = L[0].d.grp, s = grpStats(L);
  return `<button class="drow done" data-a="grp-open" data-id="${esc(gid)}"><span class="gemo">👥</span>
    <span class="rt"><span class="rn">${esc(g.name)} <span class="note" style="font-weight:500">· reçu ${eur0(s.r)} sur ${eur0(s.t)}</span></span><span class="rs">Partage entre ${g.parts.length} · total ${eur0(g.total)}</span></span>
    <b class="num dpct">${Math.round(s.p)} %</b></button>`;
}
function partState(d) {
  if (invPending(d)) return ['⏳ en attente de son accord', 'var(--warn)'];
  if (invDeclined(d)) return ['❌ a refusé', 'var(--bad)'];
  if (d.arch) return ['🗂️ clôturée', 'var(--mute)'];
  const i = debtInfo(d); return i.done ? ['✅ remboursé', 'var(--ok)'] : ['reste ' + eur(i.left), 'var(--ink)'];
}
function groupView(gid) {
  const L = grpParts(gid); if (!L.length) return;
  const g = L[0].d.grp, s = grpStats(L), dl = $('dlg'); dl.onclick = null; dl.oninput = null; dl.onchange = null;
  dl.innerHTML = `<div class="dw" style="max-height:88vh;overflow:auto"><div class="dh"><h2>👥 ${esc(g.name)}</h2><button class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    <div class="dbig"><span class="note">${s.left > 0 ? 'Reste à récupérer' : 'Tout est récupéré 🎉'}</span><b class="num">${eur(s.left)}</b>
      <span class="note">Total payé ${eur(g.total)} depuis ${esc(ACC[g.acc]?.name || '')}${g.me ? ' · sa part ' + eur(g.mine) : ''}</span>
      <span class="bar" style="display:block;height:10px"><i style="width:${s.p}%;--c:#10B981"></i></span></div>
    <div style="display:flex;flex-direction:column;gap:2px">
      ${g.me ? `<div class="row rowb" style="padding:8px 4px;cursor:default"><span class="avatar">${initials(ACC[g.acc]?.name || myEmail())}</span><span class="rt"><span class="rn">${esc(ACC[g.acc]?.name || 'Moi')}</span><span class="rs">a payé · sa part reste à sa charge</span></span><b class="num">${eur(g.mine)}</b></div>` : ''}
      ${L.map(e => { const d = e.d, st = partState(d), B = borrowerOf(d);
        return `<button class="row rowb" style="padding:8px 4px" data-part="${d.id}"><span class="avatar">${initials(B.email || B.who)}</span><span class="rt"><span class="rn">${esc(sideLabel(B))}${B.kind === 'user' ? ' 🤝' : ''}</span><span class="rs" style="color:${st[1]}">${st[0]}</span></span><b class="num">${eur(num(d.amount))}</b></button>`; }).join('')}
    </div>
    ${s.no ? '<p class="note" style="font-size:12px">Touche une part refusée pour la garder en suivi perso ou la retirer.</p>' : ''}
    <div class="dact"><button class="btn" data-x>Fermer</button></div></div>`;
  dl.onclick = ev => {
    if (ev.target.closest('[data-x]')) return dl.close();
    const p = ev.target.closest('[data-part]'); if (p) { const id = p.dataset.part; dl.close(); setTimeout(() => debtView(id), 50); }
  };
  if (!dl.open) dl.showModal();
}

/* ---------- Demande reçue : accepter (et choisir son compte) / refuser ---------- */
function inviteDialog(id) {
  const d = PDEBTS.find(x => x.id === id); if (!d || !invPending(d)) return;
  const L = lenderOf(d), A = allAccs().filter(a => a !== L.acc), def = A.includes(recvAccount()) ? recvAccount() : A[0], g = d.grp;   // pas le compte qui a avancé (ex. compte joint)
  if (!A.length) return toast('Il te faut un autre compte que « ' + (L.accName || 'le compte joint') + ' » pour rembourser');
  formDialog({ title: '👥 ' + esc(d.name), ok: 'Accepter', delLabel: 'Refuser',
    intro: `<b>${esc(myAcc(L.acc) ? ACC[L.acc].name : shortName(L.email))}</b> a payé <b>${eur(g?.total ?? d.amount)}</b>${g ? ' pour ' + g.parts.length + ' personnes' : ''}. Ta part : <b>${eur(d.amount)}</b>.${g ? '<br><small>' + g.parts.map(p => esc(p.who) + ' ' + eur(p.amount)).join(' · ') + '</small>' : ''}`,
    fields: [{ id: 'acc', label: 'Depuis quel compte tu rembourseras ?', type: 'select', options: A.map(a => ACC[a].name), value: ACC[def]?.name }],
    onDelete: () => inviteAnswer(id, false),
    onSave: r => { inviteAnswer(id, true, A.find(a => ACC[a].name === r.acc)); } });
}
function inviteAnswer(id, ok, acc) {
  const d = PDEBTS.find(x => x.id === id); if (!d) return;
  return updateDebt({ d, home: { shared: id } }, x => {
    if (!invPending(x)) return;
    x.invite = Object.assign({}, x.invite, { status: ok ? 'accepted' : 'declined', answeredAt: Date.now() });
    if (ok && acc) { x.borrower.acc = acc; x.borrower.accName = ACC[acc]?.name || ''; }
  }).then(() => { toast(ok ? '✓ Part acceptée : ' + eur(d.amount) + ' à rembourser' : 'Demande refusée'); pushTo(lenderOf(d).email, meName() + (ok ? ' a accepté' : ' a refusé') + ' sa part · ' + d.name, 'd|' + d.id); render(); })
    .catch(er => toast('⚠ ' + (er.code || er.message)));
}
// Côté de celui qui a payé, quand une part est refusée
async function declinedAction(id, what) {
  const e = findDebt(id); if (!e) return; const d = e.d;
  if (what === 'resend') return updateDebt(e, x => { x.invite = { status: 'pending', at: Date.now() }; }).then(() => { toast('Demande renvoyée'); render(); });
  if (what === 'keep') {                                        // devient une avance suivie de mon côté, au nom de la personne
    const acc = lenderAcc(e), loc = { id: uid(), name: d.name, amount: d.amount, emo: d.emo, at: d.at, payments: d.payments || [], grp: d.grp, lender: { kind: 'acc', acc, accName: ACC[acc]?.name || '' }, borrower: { kind: 'text', who: shortName(borrowerOf(d).email) } };
    if (acc === active) mutate(() => debts().push(loc), false);
    else await db.runTransaction(async tx => { const ref = accDoc(acc), s = await tx.get(ref), o = J(s.data().meta) || {}; o.debts = (o.debts || []).concat([loc]); tx.update(ref, { meta: canon(o), updatedAt: Date.now(), updatedBy: currentUser.uid }); });
  }
  await updateDebt(e, x => { x.closed = true; }); await db.collection('pdebts').doc(id).delete().catch(() => {});
  toast(what === 'keep' ? 'Gardée en suivi perso' : 'Part retirée'); render();
}
function splitMsgHTML() {
  const I = invitesForMe(), D = declinedForMe(); if (!I.length && !D.length) return '';
  return `<section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Remboursements partagés</h2>
    ${I.map(d => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="gemo">👥</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(sideLabel(lenderOf(d)))}</b> te demande <b>${eur(d.amount)}</b> · ${esc(d.name)}</span><span class="rs">${d.grp ? 'Total ' + eur(d.grp.total) + ' entre ' + d.grp.parts.length + ' personnes · ' : ''}${ago(d.invite.at)}</span></span>
      <span class="chips"><button class="btn sm p" data-a="inv-split" data-id="${d.id}">Voir et accepter</button><button class="btn sm" data-a="inv-split-no" data-id="${d.id}">Refuser</button></span></div>`).join('')}
    ${D.map(d => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="gemo">❌</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(shortName(borrowerOf(d).email))}</b> a refusé sa part de ${eur(d.amount)} · ${esc(d.name)}</span><span class="rs">${ago(d.invite.answeredAt || d.invite.at)}</span></span>
      <span class="chips"><button class="btn sm" data-a="split-dec" data-v="keep" data-id="${d.id}">Garder en suivi perso</button><button class="btn sm" data-a="split-dec" data-v="resend" data-id="${d.id}">Renvoyer</button><button class="btn sm" data-a="split-dec" data-v="drop" data-id="${d.id}">Retirer</button></span></div>`).join('')}
  </section>`;
}
// Notifications : nouvelle demande reçue, réponse à mes demandes
let splitSeen = null;
function splitNotify() {
  const st = {}; PDEBTS.forEach(d => { if (d.invite) st[d.id] = d.invite.status; });
  if (splitSeen && loaded) PDEBTS.forEach(d => {
    if (!d.invite || splitSeen[d.id] === d.invite.status) return;
    const s = d.invite.status;
    if (s === 'pending' && mine(borrowerOf(d).uid)) { const t = shortName(lenderOf(d).email) + ' te demande ' + eur(d.amount) + ' · ' + d.name; toast('👥 ' + t); notifyLocal('Remboursement partagé', t); }
    if (s !== 'pending' && splitSeen[d.id] === 'pending' && mine(lenderOf(d).uid)) { const t = shortName(borrowerOf(d).email) + (s === 'accepted' ? ' a accepté sa part (' : ' a refusé sa part (') + eur(d.amount) + ') · ' + d.name; toast((s === 'accepted' ? '✓ ' : '❌ ') + t); notifyLocal('Remboursement partagé', t); }
  });
  splitSeen = st;
}

// Libellé de la case « une part reste au compte qui a payé »
function spMeLabel(acc) { const a = ACC[acc]; return a && isShared(acc) ? 'Le compte « ' + a.name + ' » garde aussi une part (à sa charge)' : 'Je participe aussi (ma part reste à ma charge)'; }

// Nom d'une ligne du partage
function spWho(r) { return r.p === 'txt' ? r.who.trim() : r.p.startsWith('a:') ? ACC[r.p.slice(2)]?.name || 'Compte' : shortName(SP?.ppl?.find(p => 'u:' + p.uid === r.p)?.email || linkedPeople().find(p => 'u:' + p.uid === r.p)?.email || ''); }
// Partage : on déduit seulement quand celui qui paie doit déjà de l'argent à la personne (le sens inverse reste une nouvelle avance, plus lisible)
function spComp(acc, r) { const m = compFind(acc, r.p, r.who); return m && m.dir > 0 ? m : null; }
