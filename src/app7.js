
/* ============================== VIREMENTS ==============================
   • Entre mes comptes : sortie ici + entrée sur l'autre compte, liées (même identifiant de virement).
   • Vers une personne : sortie ici + dépôt dans sa « boîte » transfers/{id} ; son app l'ajoute en direct
     comme recette dans son compte de réception, puis marque le virement « reçu ».                       */
const xfBusy = new Set();
/* ---------- Annuaire : les comptes que je propose à ceux qui me font un virement (nom + banque seulement) ---------- */
let dirLast = '', dirTimer = null;
function publishDir() {
  clearTimeout(dirTimer);
  dirTimer = setTimeout(() => {
    if (!sameUser() || !accIds.length || accIds.some(id => !ACC[id])) return;
    const hide = U.recvHide || [], def = recvAccount();
    const accounts = accIds.filter(id => id === def || !hide.includes(id)).map(id => { const a = ACC[id]; return { id, name: a.name || 'Compte', bank: a.bank || '', site: a.site || '', color: a.color || '', kind: a.kind || 'courant' }; });
    const doc = { uid: currentUser.uid, recv: def, accounts }, j = JSON.stringify(doc);
    if (j === dirLast) return; dirLast = j;
    db.collection('directory').doc(myEmail()).set(Object.assign(doc, { at: Date.now() })).catch(e => { dirLast = ''; console.warn('Annuaire', e.code); });
  }, 1200);
}
const DIR = {}, DIR_T = {};            // email → { recv, accounts } | null (inconnu) ; absent = pas encore cherché
let dirLookT = null;
const okEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
function xfLookupSoon() { clearTimeout(dirLookT); dirLookT = setTimeout(() => xfLookup(P?.d?.email), 450); }
function xfLookup(e) {
  e = String(e || '').trim().toLowerCase(); if (!okEmail(e)) return paintDest();
  if (DIR_T[e] && Date.now() - DIR_T[e] < 15000) return paintDest();     // à jour (ou recherche en cours)
  DIR_T[e] = Date.now(); paintDest();
  db.collection('directory').doc(e).get().then(s => { DIR[e] = s.exists ? s.data() : null; }).catch(() => { if (!(e in DIR)) DIR[e] = null; }).then(paintDest);
}
function destHTML() {
  if (!P || P.xk !== 'person') return '';
  const e = String(P.d.email || '').trim().toLowerCase(); if (!okEmail(e) || e === myEmail()) return '';
  const D = DIR[e];
  if (D === undefined) return '<p class="note" style="font-size:12px">Recherche de ses comptes…</p>';
  if (!D || !(D.accounts || []).length) return `<p class="note" style="font-size:12px">${isLinked(e) ? 'Ses comptes ne sont pas encore visibles (app pas à jour chez elle ?)' : 'Pour choisir sur quel compte elle reçoit, connectez-vous (elle doit accepter).'} Sinon, le virement arrivera sur son compte par défaut.${isLinked(e) || linkWith(e)?.status === 'pending' ? '' : ' <button class="lnk" data-p="linkreq">Demander la connexion</button>'}${linkWith(e)?.status === 'pending' ? ' <b>Demande en attente.</b>' : ''}</p>`;
  if (!P.toAccPicked || !D.accounts.some(a => a.id === P.toAcc)) P.toAcc = D.accounts.some(a => a.id === D.recv) ? D.recv : D.accounts[0].id;
  return `<div class="fl">Sur quel compte de ${esc(e.split('@')[0])} ?${D.accounts.map(a => `<button class="row rowb${P.toAcc === a.id ? ' on' : ''}" data-p="tacc" data-v="${esc(a.id)}" style="border:1px solid ${P.toAcc === a.id ? 'var(--acc)' : 'var(--line)'};${P.toAcc === a.id ? 'background:var(--acc-s)' : ''}"><span class="accbig">${accBadge(a, 18)}</span><span class="rt"><span class="rn">${esc(a.name)}</span><span class="rs">${esc([a.bank, a.kind === 'epargne' ? 'Épargne' : 'Courant', a.id === D.recv ? 'par défaut' : ''].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`;
}
function paintDest() { const el = $('pn-dacc'); if (el) el.innerHTML = destHTML(); }
function xfWhere(t) {
  if (t.dir === 'in') { const a = (U.xfAcc || {})[t.id] || t.toAcc; return ACC[a] ? ' · sur ' + esc(ACC[a].name) : t.toAccName ? ' · sur ' + esc(t.toAccName) : ''; }
  return t.toAccName ? ' · sur ' + esc(t.toAccName) : '';
}
// Déplacer un virement reçu vers un autre de mes comptes
async function xferMove(dest) {
  const t = P.type, id = P.id, k = ck(), src = month()[t].find(e => e.id === id); if (!src || !ACC[dest]) return;
  const x = JSON.parse(JSON.stringify(src)); x.id = uid(); const dn = ACC[dest].name;
  closePanel();
  try { await txMonth(dest, k, m => m.incomes.unshift(x)); }
  catch (e) { return toast('⚠ Déplacement impossible (' + (e.code || e.message) + '). Vérifie ta connexion.'); }
  mutate(() => { const m = month(k); m[t] = m[t].filter(e => e.id !== id); }, 'Déplacé vers « ' + dn + ' »');
  if (x.xfer?.id) { (U.xfAcc = U.xfAcc || {})[x.xfer.id] = dest; saveUser(); }
}
const xfStatus = id => (XF.out.find(t => t.id === id) || {}).status;
function xferLabel(x, type) {
  const f = x.xfer || {};
  if (f.kind === 'acc') return (type === 'incomes' ? 'Virement de ' : 'Virement vers ') + (f.accName || 'un compte');
  if (f.kind === 'person' && type === 'expenses') { const st = xfStatus(f.id); return 'Virement à ' + String(f.to || '').split('@')[0] + (f.toAccName ? ' (' + f.toAccName + ')' : '') + (st === 'received' ? ' · reçu ✓' : st === 'sent' ? ' · envoyé' : ''); }
  if (f.kind === 'person') return 'Virement de ' + String(f.from || '').split('@')[0];
  return 'Virement';
}
// Mois d'un AUTRE compte, modifié dans une transaction (créé à partir de ses charges fixes s'il n'existe pas encore)
function monthFromMeta(metaStr) {
  const T = (J(metaStr) || {}).templates || {};
  return { bankBalance: null, savingGoal: null, expenses: (T.expenses || []).map(t => instance('expenses', t)), incomes: (T.incomes || []).map(t => instance('incomes', t)), budgets: (T.budgets || []).map(t => instance('budgets', t)) };
}
function txMonth(accId, k, fn, metaFn) {
  return db.runTransaction(async tx => {
    const aRef = accDoc(accId), mRef = monthCol(accId).doc(k);
    const aS = await tx.get(aRef), mS = await tx.get(mRef);
    if (!aS.exists) throw new Error('Compte introuvable');
    const m = mS.exists ? JSON.parse(mS.data().data) : monthFromMeta(aS.data().meta);
    const flow = x => sum((x.incomes || []).filter(i => i.status === 'Reçu')) - sum((x.expenses || []).filter(e => e.status === 'Payé'), cash), all = x => sum(x.incomes || []) - sum(x.expenses || [], eff);
    const before = flow(m), beforeAll = all(m);
    fn(m);
    tx.set(mRef, { data: canon(m), updatedAt: Date.now(), updatedBy: currentUser.uid });
    const upd = {};
    if (metaFn) { const o = J(aS.data().meta) || {}; o.templates = o.templates || {}; ['expenses','incomes','budgets'].forEach(t => o.templates[t] = o.templates[t] || []); metaFn(o); upd.meta = canon(o); }
    // Solde affiché dans « Tous mes comptes » mis à jour tout de suite (sans attendre l'ouverture du compte)
    const d = Math.round((flow(m) - before) * 100) / 100, dA = Math.round((all(m) - beforeAll) * 100) / 100, s = aS.data().summary;
    if ((d || dA) && s && s.k && k <= s.k) { const dp = k < s.k ? d : dA;   // mois passé : seul le réel compte ; mois en cours : le prévu aussi
      upd.summary = Object.assign({}, s, { current: Math.round((num(s.current) + d) * 100) / 100, est: Math.round((num(s.est) + dp) * 100) / 100, rav: Math.round((num(s.rav) + dp) * 100) / 100 }); }
    if (Object.keys(upd).length) tx.update(aRef, Object.assign(upd, { updatedAt: Date.now(), updatedBy: currentUser.uid }));
  });
}
// Répercute une modification (ou une suppression si upd = null) sur l'autre côté du virement
// L'autre côté d'un virement entre mes comptes : même identifiant de virement, ou même virement automatique (rid)
const xfMatch = (e, xf) => !!e.xfer && e.xfer.kind === 'acc' && (xf.id && e.xfer.id ? e.xfer.id === xf.id : !!xf.rid && e.xfer.rid === xf.rid);
function xferPropagate(xf, upd) {
  if (!xf || (!xf.id && !xf.rid)) return;
  const k = ck();
  if (xf.kind === 'acc' && xf.acc && accIds.includes(xf.acc)) {
    txMonth(xf.acc, k, m => {
      ['expenses','incomes'].forEach(t => {
        if (!upd) m[t] = m[t].filter(e => !xfMatch(e, xf));
        else m[t].forEach(e => { if (!xfMatch(e, xf)) return;
          if (upd.amount != null) e.amount = upd.amount; if (upd.date !== undefined) e.date = upd.date; if (upd.label) e.name = upd.label;
          if (upd.paid != null) e.status = t === 'incomes' ? (upd.paid ? 'Reçu' : 'En attente') : (upd.paid ? 'Payé' : 'Prévu'); });
      });
    }).catch(e => toast('⚠ L\'autre compte n\'a pas pu être mis à jour (' + (e.code || e.message) + ')'));
  }
  if (xf.kind === 'person' && xf.id && xf.to && xfStatus(xf.id) === 'sent') {
    const r = db.collection('transfers').doc(xf.id);
    (upd ? r.update({ amount: upd.amount, date: upd.date, label: upd.label }) : r.delete()).catch(() => {});
  }
}
// Virement automatique modifié / supprimé ici → même chose sur le compte d'en face (modèle + mois affiché)
function xferTplSync(type, t, mode, old = t) {
  const xf = t && t.xfer; if (!xf || xf.kind !== 'acc' || !xf.acc || !accIds.includes(xf.acc)) return Promise.resolve();
  const other = type === 'expenses' ? 'incomes' : 'expenses', me = active, k = ck();
  if (!xf.rid) { xf.rid = uid(); save(); }                                     // ancien virement : on crée le lien
  return db.runTransaction(async tx => {
    const aRef = accDoc(xf.acc), mRef = monthCol(xf.acc).doc(k), aS = await tx.get(aRef), mS = await tx.get(mRef);
    if (!aS.exists) return;
    const o = J(aS.data().meta) || {}; o.templates = o.templates || {}; const L = o.templates[other] = o.templates[other] || [];
    const dt = L.find(z => z.xfer && z.xfer.kind === 'acc' && z.xfer.acc === me && (z.xfer.rid ? z.xfer.rid === xf.rid : z.name === old.name && num(z.amount) === num(old.amount)));
    if (!dt) return;
    dt.xfer.rid = xf.rid;
    if (mode === 'upd') { dt.name = t.name; dt.amount = t.amount; dt.date = t.date; ['site', 'img'].forEach(f => { if (t[f]) dt[f] = t[f]; else delete dt[f]; }); }
    else o.templates[other] = L.filter(z => z !== dt);
    tx.update(aRef, { meta: canon(o), updatedAt: Date.now(), updatedBy: currentUser.uid });
    if (mS.exists) {
      const m = JSON.parse(mS.data().data), paid = e => e.status === 'Payé' || e.status === 'Reçu';
      if (mode === 'del') m[other] = m[other].filter(e => e.tmplId !== dt.tmplId || paid(e));
      else if (mode === 'upd') m[other].forEach(e => { if (e.tmplId === dt.tmplId && !paid(e)) { e.name = dt.name; e.amount = dt.amount; e.date = dt.date; } });
      if (mode !== 'stop') tx.set(mRef, { data: canon(m), updatedAt: Date.now(), updatedBy: currentUser.uid });
    }
  }).catch(e => toast('⚠ « ' + (ACC[xf.acc]?.name || 'L\'autre compte') + ' » n\'a pas pu être mis à jour (' + (e.code || e.message) + ')'));
}
function contactSuggestions() {
  const me = myEmail(), seen = new Set(), out = [];
  const add = e => { e = String(e || '').toLowerCase(); if (e && e !== me && !seen.has(e)) { seen.add(e); out.push(e); } };
  (U.contacts || []).slice().sort((a, b) => b.n - a.n || b.last - a.last).forEach(c => add(c.email));
  accIds.forEach(id => Object.values(ACC[id]?.memberEmails || {}).forEach(add));
  XF.out.forEach(t => add(t.to)); XF.in.forEach(t => add(t.fromEmail));
  return out.slice(0, 8);
}
function typeSeg() {
  const sav = isSavAcc(), t = P.type;
  const b = (v, l) => `<button class="${t === v ? 'on' : ''}" data-p="type" data-v="${v}">${l}</button>`;
  return `<div class="seg" role="group" aria-label="Type">${sav ? b('incomes', 'Versement') + b('expenses', 'Retrait') : b('expenses', 'Dépense') + b('incomes', 'Recette')}${b('xfer', 'Virement')}</div>`;
}
function paintXfer() {
  const d = P.d, others = accIds.filter(id => id !== active && ACC[id]), sug = contactSuggestions();
  if (P.xk === 'acc' && !P.dest && others.length) P.dest = others[0];
  if (P.xk === 'person' && okEmail(String(d.email || '').trim().toLowerCase())) setTimeout(() => xfLookup(d.email), 0);
  const auto = P.xk === 'acc' ? 'Virement vers ' + (ACC[P.dest]?.name || '…') : 'Virement à ' + (String(d.email || '').split('@')[0] || '…');
  $('panel').innerHTML = `
  <div class="pbody">
    <div class="dh"><h2 id="pn-title">Nouveau virement</h2><button class="ib sm" data-p="close" aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    ${typeSeg()}
    <label class="amt"><input id="pn-a" inputmode="decimal" placeholder="0,00" aria-label="Montant" value="${esc(d.amount)}" data-pf="amount"><span>€</span></label>
    <div class="seg" role="group" aria-label="Destination"><button class="${P.xk === 'acc' ? 'on' : ''}" data-p="xk" data-v="acc">Vers un de mes comptes</button><button class="${P.xk === 'person' ? 'on' : ''}" data-p="xk" data-v="person">Vers une personne</button></div>
    ${P.xk === 'acc' ? `<div class="fl">Compte d'arrivée
        ${others.map(id => { const a = ACC[id]; return `<button class="row rowb${P.dest === id ? ' on' : ''}" data-p="dest" data-v="${id}" style="border:1px solid ${P.dest === id ? 'var(--acc)' : 'var(--line)'};${P.dest === id ? 'background:var(--acc-s)' : ''}"><span class="accbig">${accBadge(a, 18)}</span><span class="rt"><span class="rn">${esc(a.name)}</span><span class="rs">${esc(accSub(id))}</span></span></button>`; }).join('') || '<p class="note">Crée d\'abord un autre compte (sélecteur de compte › Nouveau compte).</p>'}</div>`
    : `<label class="fl">Destinataire (email)<input class="in" id="pn-e" type="email" list="pn-el" value="${esc(d.email || '')}" data-pf="email" placeholder="email de la personne" autocomplete="off"><datalist id="pn-el">${sug.map(e => `<option value="${esc(e)}">`).join('')}</datalist></label>
      ${sug.length ? `<div class="chips" style="margin-top:-6px">${sug.map(e => `<button class="chip${String(d.email || '').toLowerCase() === e ? ' on' : ''}" data-p="sugg" data-v="${esc(e)}"><span class="avatar">${initials(e)}</span>${esc(e.split('@')[0])}</button>`).join('')}</div>` : ''}
      <div id="pn-dacc" style="display:contents">${destHTML()}</div>
      <small class="note" style="font-size:12px;margin-top:-8px">La personne doit avoir un compte sur l'app avec cet email. Elle le reçoit en direct comme recette.</small>`}
    <label class="fl">Libellé<input class="in" id="pn-n" list="pn-xl" autocomplete="off" value="${esc(d.name)}" data-pf="name" placeholder="ex. Super U, EDF, Loyer… (sinon « ${esc(auto)} »)"><datalist id="pn-xl">${[...new Set(Object.values(S.months).flatMap(m => m.expenses.map(e => e.name)).filter(Boolean))].slice(-80).map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
    <div class="fl">Catégorie <small style="font-weight:500;color:var(--mute)">— pour qu'il compte dans la bonne dépense (courses, énergie…)</small>
      <div class="chips">${['Virement', ...S.categories.filter(c => c !== 'Virement')].map(c => `<button class="chip cat${c === (d.cat || 'Virement') ? ' on' : ''}" style="--c:${catInfo(c).col}" data-p="cat" data-v="${esc(c)}"><i></i>${c === 'Virement' ? 'Aucune (simple virement)' : esc(c)}</button>`).join('')}</div></div>
    <div class="fl">Icône${P.xk === 'person' ? ' (vue aussi par le destinataire)' : ''}
      <div class="seg" role="group" aria-label="Icône"><button class="${P.icon === 'cat' ? 'on' : ''}" data-p="icon" data-v="cat">Par défaut</button><button class="${P.icon === 'site' ? 'on' : ''}" data-p="icon" data-v="site">Logo du site</button><button class="${P.icon === 'img' ? 'on' : ''}" data-p="icon" data-v="img">Mon image</button></div>
      ${P.icon === 'site' ? `<span style="display:flex;gap:10px;align-items:center">${ico({ cat: d.cat, site: cleanSite(d.site) }, 'expenses')}<input class="in" id="pn-site" value="${esc(d.site || '')}" data-pf="site" placeholder="Site web, ex. magasins-u.com" style="font-weight:500"></span>` : ''}
      ${P.icon === 'img' ? `<span style="display:flex;gap:10px;align-items:center">${ico({ cat: d.cat, img: d.img }, 'expenses')}<button class="btn sm" data-p="pickimg">${d.img ? 'Changer l\'image' : 'Choisir une image'}</button></span>` : ''}</div>
    <label class="fl">Jour du mois<input class="in" id="pn-d" type="number" min="1" max="31" inputmode="numeric" value="${esc(d.date)}" data-pf="date" placeholder="sans date"></label>
    ${P.xk === 'acc' ? `<label class="chk"><input type="checkbox" data-p="repeat" ${P.repeat ? 'checked' : ''}>Chaque mois (virement automatique)</label>` : ''}
  </div>
  <div class="pfoot"><button class="btn p" style="flex:1" data-p="save">Enregistrer le virement</button></div>`;
}
async function saveXfer() {
  const d = P.d, amt = Math.round(parseAmt(d.amount) * 100) / 100;
  if (!(amt > 0)) { $('pn-a').focus(); return toast('Saisis un montant'); }
  const k = ck(), src = active, srcName = accName(), dd = day(d.date), xid = uid(), label = d.name.trim();
  const cat = d.cat && (d.cat === 'Virement' || S.categories.includes(d.cat)) ? d.cat : 'Virement';
  const site = P.icon === 'site' ? cleanSite(d.site) : '', img = P.icon === 'img' ? (d.img || '') : '', deco = Object.assign({}, site ? { site } : {}, img ? { img } : {});
  if (P.xk === 'acc') {
    const dest = P.dest; if (!dest || !ACC[dest] || dest === src) return toast('Choisis le compte d\'arrivée');
    const dn = ACC[dest].name, repeat = P.repeat, rid = repeat ? uid() : null, stid = uid(), dtid = uid(); closePanel();
    const link = repeat ? { rid } : {};
    mutate(() => {
      month(k).expenses.unshift(Object.assign({ id: uid(), name: label || 'Virement vers ' + dn, amount: amt, date: dd, status: 'Payé', cat, isFixed: !!repeat, xfer: Object.assign({ id: xid, kind: 'acc', acc: dest, accName: dn }, link) }, repeat ? { tmplId: stid } : {}, deco));
      if (repeat) tplAdd('expenses', Object.assign({ tmplId: stid, name: label || 'Virement vers ' + dn, amount: amt, date: dd, cat, isDivided: false, xfer: { kind: 'acc', acc: dest, accName: dn, auto: true, rid } }, deco), shiftK(k, 1));
    }, (label || 'Virement') + ' → ' + dn + ' · ' + eur(amt) + (cat !== 'Virement' ? ' (' + cat + ')' : ''));
    try {
      await txMonth(dest, k, m => m.incomes.unshift(Object.assign({ id: uid(), name: label || 'Virement de ' + srcName, amount: amt, date: dd, status: 'Reçu', isFixed: !!repeat, xfer: Object.assign({ id: xid, kind: 'acc', acc: src, accName: srcName }, link) }, repeat ? { tmplId: dtid } : {}, deco, isShared(dest) ? { by: currentUser.email } : {})),
        repeat ? o => o.templates.incomes.push(Object.assign({ tmplId: dtid, name: label || 'Virement de ' + srcName, amount: amt, date: dd, isDivided: false, xfer: { kind: 'acc', acc: src, accName: srcName, auto: true, rid } }, deco)) : null);
      if (isShared(dest)) accDoc(dest).collection('activity').add({ by: currentUser.uid, byEmail: currentUser.email, text: 'Virement reçu de « ' + srcName + ' » · ' + eur(amt), at: Date.now(), month: k }).catch(() => {});
    } catch (e) { toast('⚠ Enregistré ici, mais pas sur « ' + dn + ' » (' + (e.code || e.message) + '). Vérifie ta connexion.'); }
  } else {
    const to = String(d.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { $('pn-e')?.focus(); return toast('Email du destinataire invalide'); }
    if (to === myEmail()) return toast('Pour toi-même, choisis « Vers un de mes comptes »');
    const D = DIR[to], ta = D && (D.accounts || []).find(a => a.id === P.toAcc), taN = ta ? ta.name : '';
    closePanel();
    mutate(() => {
      const x = { id: uid(), name: label || 'Virement à ' + to.split('@')[0], amount: amt, date: dd, status: 'Payé', cat, isFixed: false, xfer: Object.assign({ id: xid, kind: 'person', to }, taN ? { toAccName: taN } : {}) };
      if (site) x.site = site; if (img) x.img = img; month(k).expenses.unshift(x);
    }, 'Virement à ' + to.split('@')[0] + ' · ' + eur(amt));
    const c = (U.contacts = U.contacts || []).find(z => z.email === to); if (c) { c.n++; c.last = Date.now(); } else U.contacts.push({ email: to, n: 1, last: Date.now() }); saveUser();
    db.collection('transfers').doc(xid).set({ from: currentUser.uid, fromEmail: currentUser.email, to, amount: amt, label, date: dd, k, site, img, status: 'sent', at: Date.now(), ...(ta ? { toAcc: ta.id, toAccName: taN } : {}) })
      .catch(e => toast('⚠ Virement non transmis (' + (e.code || e.message) + ')'));
  }
}

/* ---------- Réception des virements d'autres personnes ---------- */
function xfListen(field, val, key) {
  return db.collection('transfers').where(field, '==', val).onSnapshot(q => {
    XF[key] = q.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at);
    if (key === 'in') processTransfers();
    if (loaded) { renderChrome(); if (['messages','mouvements','accueil'].includes(UI.view)) render(); }
  }, err => console.warn('Virements', err.code));
}
function recvAccount() { const r = U.recvAcc; if (r && accIds.includes(r) && ACC[r]) return r; return accIds.find(id => ACC[id] && ACC[id].kind !== 'epargne') || accIds.find(id => ACC[id]) || null; }
function processTransfers() { if (!sameUser() || !accIds.length) return; XF.in.filter(t => t.status === 'sent').forEach(receiveTransfer); }
async function receiveTransfer(t) {
  if (xfBusy.has(t.id)) return;
  let acc = recvAccount();
  if (t.toAcc && accIds.includes(t.toAcc)) { if (!ACC[t.toAcc]) return; acc = t.toAcc; }   // compte choisi par l'expéditeur (attend qu'il soit chargé)
  if (!acc) return;
  xfBusy.add(t.id);
  try {
    let done = false;
    await db.runTransaction(async tx => {
      const tRef = db.collection('transfers').doc(t.id), aRef = accDoc(acc), mRef = monthCol(acc).doc(t.k || nowK());
      const tS = await tx.get(tRef); if (!tS.exists || tS.data().status !== 'sent') return;
      const aS = await tx.get(aRef), mS = await tx.get(mRef); if (!aS.exists) return;
      const v = tS.data(), m = mS.exists ? JSON.parse(mS.data().data) : monthFromMeta(aS.data().meta);
      const x = { id: uid(), name: v.label || 'Virement de ' + String(v.fromEmail || '').split('@')[0], amount: num(v.amount), date: day(v.date), status: 'Reçu', isFixed: false, xfer: { id: t.id, kind: 'person', from: v.fromEmail } };
      if (v.site) x.site = v.site; if (v.img) x.img = v.img;
      m.incomes.unshift(x);
      tx.set(mRef, { data: canon(m), updatedAt: Date.now(), updatedBy: currentUser.uid });
      tx.update(tRef, { status: 'received', toAcc: acc, toAccName: ACC[acc]?.name || '', receivedAt: Date.now() });
      done = true;
    });
    if (done) { const who = String(t.fromEmail || '').split('@')[0]; toast('💸 ' + who + ' t\'a fait un virement de ' + eur(t.amount) + ' → ' + (ACC[acc]?.name || '')); browserNotify('Virement reçu', who + ' · ' + eur(t.amount) + (t.label ? ' · ' + t.label : '')); }
  } catch (e) { console.warn('Réception virement', e.code || e.message); }
  finally { xfBusy.delete(t.id); }
}

/* ============================== APPLICATION INSTALLÉE (PC & iPhone) ============================== */
const APP_VERSION = '4 nov. · v33';
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (loaded && UI.view === 'parametres') render(); });
addEventListener('appinstalled', () => { installEvt = null; toast('✅ Application installée'); if (loaded) render(); });
if ('serviceWorker' in navigator && window.isSecureContext) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e)));
function installHTML() {
  let body;
  if (standalone()) body = '<p class="note"><b style="color:var(--ok)">✓ Tu utilises l\'application installée.</b> Elle se met à jour toute seule à chaque ouverture.</p>';
  else if (installEvt) body = '<p class="note">Ajoute Suivi dépenses à ton ordinateur ou ton téléphone : une icône, sa propre fenêtre, sans barre d\'adresse.</p><button class="btn p" data-a="install">Installer l\'application</button>';
  else if (isIOS()) body = `<p class="note">Sur iPhone, l'installation se fait depuis <b>Safari</b> :</p>
      <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px"><li>Touche le bouton <b>Partager</b> <span style="display:inline-block;vertical-align:-3px">${'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>'}</span> en bas de l'écran</li><li>Fais défiler et choisis <b>« Sur l'écran d'accueil »</b></li><li>Touche <b>Ajouter</b>, puis ouvre Suivi dépenses depuis son icône</li></ol>
      <p class="note" style="font-size:12px">Tu devras te reconnecter une fois dans l'application.</p>`;
  else body = '<p class="note">Dans <b>Chrome</b> ou <b>Edge</b> : clique sur l\'icône d\'installation à droite de la barre d\'adresse (un écran avec une flèche), ou menu ⋮ › <b>Installer Suivi dépenses</b> (Edge : ⋯ › Applications › Installer).</p>';
  let th = 'auto'; try { th = localStorage.getItem('theme') || 'auto'; } catch (e) {}
  const tb = (v, l) => `<button class="${th === v ? 'on' : ''}" data-a="theme" data-v="${v}">${l}</button>`;
  return `<section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:10px"><h2>Application</h2>
    <div class="fl">Affichage<div class="seg" role="group" aria-label="Affichage"><button class="${SIMPLE() ? 'on' : ''}" data-a="mode" data-v="simple">Simple</button><button class="${SIMPLE() ? '' : 'on'}" data-a="mode" data-v="full">Complet</button></div><small>Simple = l'essentiel, en gros. Choix propre à cet appareil.</small></div>
    <div class="fl">Apparence<div class="seg" role="group" aria-label="Apparence">${tb('auto', 'Auto')}${tb('light', 'Clair')}${tb('dark', 'Sombre')}</div><small>Auto = suit le réglage de l'appareil. Choix propre à cet appareil.</small></div>
    ${body}<small class="note" style="font-size:12px">Version ${APP_VERSION}</small></section>`;
}
