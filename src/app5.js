
/* ---------- COMPTES : sélecteur, vue d'ensemble, réglages ---------- */
const ACOL = [['Indigo','#4338CA'],['Vert','#0F766E'],['Bleu','#0369A1'],['Violet','#6D28D9'],['Rose','#BE185D'],['Orange','#C2410C'],['Ardoise','#334155']];
// Site web connu pour les banques courantes (modifiable) → logo automatique
const BANKS = [[/cr[ée]dit\s*agricole|\bca\b/i,'credit-agricole.fr'],[/bourso/i,'boursobank.com'],[/revolut/i,'revolut.com'],[/soci[ée]t[ée]\s*g[ée]n[ée]rale|\bsg\b/i,'societegenerale.fr'],
  [/bnp/i,'mabanque.bnpparibas'],[/\blcl\b/i,'lcl.fr'],[/caisse\s*d.?[ée]pargne/i,'caisse-epargne.fr'],[/banque\s*populaire/i,'banquepopulaire.fr'],[/banque\s*postale/i,'labanquepostale.fr'],
  [/cr[ée]dit\s*mutuel/i,'creditmutuel.fr'],[/\bcic\b/i,'cic.fr'],[/\bn26\b/i,'n26.com'],[/fortuneo/i,'fortuneo.fr'],[/hello\s*bank/i,'hellobank.fr'],[/monabanq/i,'monabanq.com'],[/nickel/i,'nickel.eu'],[/qonto/i,'qonto.com']];
const guessSite = (...t) => { const s = t.filter(Boolean).join(' '); const f = BANKS.find(([r]) => r.test(s)); return f ? f[1] : ''; };
// Pastille d'un compte : logo de la banque (si site) sur fond de couleur
function accBadge(a, size = 14) {
  const site = a.site || '';
  return `<i style="--c:${a.color || '#4338CA'}">${(a.members || []).length > 1 ? svg('users', size, 2.2) : svg('wallet', size, 2.2)}${site ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&amp;sz=64" data-site="${esc(site)}" alt="" referrerpolicy="no-referrer" onload="logoOk(this)" onerror="logoKo(this)">` : ''}</i>`;
}
const initials = e => String(e || '?').trim().charAt(0).toUpperCase();
function membersOf(id) { const a = ACC[id] || {}; return (a.members || []).map(u => ({ uid: u, email: a.memberEmails?.[u] || '?', owner: u === a.owner, me: u === currentUser?.uid })); }
function accSub(id) {
  const a = ACC[id] || {}, others = membersOf(id).filter(m => !m.me);
  return [a.kind === 'epargne' ? 'Épargne' : '', a.bank, others.length ? 'partagé avec ' + others.map(m => m.email.split('@')[0]).join(', ') : ''].filter(Boolean).join(' · ') || 'Compte personnel';
}
function accSwitcherHTML() {
  const a = ACC[active] || {};
  return `<button class="accsw" data-a="accmenu" aria-haspopup="menu" aria-expanded="${!!$('accmenu')}">${accBadge(a)}<span><b>${esc(a.name || 'Compte')}</b><small>${esc(accSub(active))}</small></span>${svg('down', 16, 2.2)}</button>`;
}
function accMenu(btn) {
  const old = $('accmenu'); if (old) { old.remove(); return; }
  const r = btn.getBoundingClientRect(), mnu = document.createElement('div');
  mnu.id = 'accmenu'; mnu.className = 'accmenu'; mnu.setAttribute('role', 'menu');
  mnu.style.top = Math.min(r.bottom + 6, innerHeight - 80) + 'px'; mnu.style.left = Math.max(8, Math.min(r.left, innerWidth - 300)) + 'px';
  mnu.innerHTML = accIds.filter(id => ACC[id]).map(id => { const a = ACC[id], sm = a.summary;
      return `<button role="menuitem" class="am${id === active ? ' on' : ''}" data-a="acc-open" data-id="${id}">${accBadge(a)}<span><b>${esc(a.name)}</b><small>${esc(accSub(id))}</small></span><em class="num">${sm ? eur0(sm.current) : ''}</em></button>`; }).join('')
    + `<hr><button role="menuitem" class="am" data-a="comptes">${svg('layers', 18)}<span><b>Tous mes comptes</b></span></button><button role="menuitem" class="am" data-a="acc-new">${svg('plus', 18)}<span><b>Nouveau compte</b></span></button>`;
  document.body.append(mnu);
  mnu.querySelector('button')?.focus();
}
document.addEventListener('click', e => { const m = $('accmenu'); if (m && !e.target.closest('#accmenu,[data-a=accmenu]')) m.remove(); }, true);

function vComptes() {
  const V = $('v-comptes'), ids = accIds.filter(id => ACC[id]);
  const tot = sum(ids, id => num(ACC[id].summary?.current)), est = sum(ids, id => num(ACC[id].summary?.est));
  V.innerHTML = `
  <section class="hero" style="flex:none;background:#151A2D">
    <div class="deco"><i style="right:-60px;top:-90px;width:260px;height:260px;background:#2B3150;opacity:.7"></i></div>
    <div style="display:flex;flex-direction:column;gap:6px"><span class="t">Solde total · ${ids.length} compte${ids.length > 1 ? 's' : ''} ${tip('solde total', 'Solde total', 'Somme des soldes actuels de tous tes comptes, y compris les comptes partagés (montant total du compte, pas ta part).' + eq(ids.map(id => [esc(ACC[id].name), ACC[id].summary ? eur(ACC[id].summary.current) : '—']), ['= Total', eur(tot)]), 'dn rt')}</span>
      <span class="v num">${eur(tot)}</span><span class="s">Fin de mois estimée, tous comptes : <b class="num">${eur(est)}</b></span></div>
  </section>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">
    ${ids.map(id => { const a = ACC[id], sm = a.summary, mem = membersOf(id);
      return `<button class="card" data-a="acc-open" data-id="${id}" style="border:0;text-align:left;display:flex;flex-direction:column;gap:14px;${id === active ? 'box-shadow:inset 0 0 0 2px ' + (a.color || '#4338CA') : ''}">
        <span style="display:flex;align-items:center;gap:12px" class="accbig">${accBadge(a, 20)}<span class="rt"><span class="rn">${esc(a.name)}</span><span class="rs">${esc([a.kind === 'epargne' ? 'Épargne' : 'Courant', a.bank].filter(Boolean).join(' · '))}</span></span></span>
        <span style="display:flex;justify-content:space-between;gap:10px"><span><span class="note" style="display:block;font-size:12px">Solde actuel</span><b class="num" style="font-size:20px">${sm ? eur(sm.current) : '—'}</b></span><span style="text-align:right"><span class="note" style="display:block;font-size:12px">Fin de mois</span><b class="num" style="font-size:15px">${sm ? eur(sm.est) : '—'}</b></span></span>
        ${mem.length > 1 ? `<span class="chips">${mem.map(m => `<span class="chip" style="min-height:28px;padding:3px 10px;font-size:12px"><span class="avatar">${initials(m.email)}</span>${esc(m.me ? 'Moi' : m.email)}</span>`).join('')}</span>` : ''}
      </button>`; }).join('')}
    <button class="card" data-a="acc-new" style="border:2px dashed var(--line);box-shadow:none;background:none;display:flex;align-items:center;justify-content:center;gap:8px;min-height:160px;color:var(--mute);font-weight:700">${svg('plus')} Nouveau compte</button>
  </div>
  <p class="note">Les soldes sont ceux du mois en cours, mis à jour à chaque modification d'un compte.</p>`;
}

function accountSettingsHTML() {
  const a = ACC[active] || {}, mem = membersOf(active), me = currentUser?.uid, owner = a.owner === me;
  const pend = INV.out.filter(i => i.acc === active && i.status === 'pending');
  return `<section class="card" style="flex:1 1 340px;display:flex;flex-direction:column;gap:12px"><h2>Ce compte</h2>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      <label class="fl">Nom<input class="in" data-acc="name" value="${esc(a.name || '')}" placeholder="ex. Crédit Agricole"></label>
      <label class="fl">Banque<input class="in" data-acc="bank" value="${esc(a.bank || '')}" placeholder="ex. Crédit Agricole"></label>
    </div>
    <label class="fl">Logo · site web de la banque<span style="display:flex;gap:10px;align-items:center"><span class="accbig">${accBadge(a, 20)}</span><input class="in" data-acc="site" value="${esc(a.site || '')}" placeholder="ex. credit-agricole.fr (rempli tout seul pour les banques connues)" style="font-weight:500"></span></label>
    <div class="fl">Type de compte<div class="seg" role="group" aria-label="Type de compte"><button class="${a.kind !== 'epargne' ? 'on' : ''}" data-a="acc-kind" data-v="courant">Courant</button><button class="${a.kind === 'epargne' ? 'on' : ''}" data-a="acc-kind" data-v="epargne">Épargne</button></div><small>Épargne : écran simplifié (solde, versements, objectif commun) et compté dans l'onglet Épargne.</small></div>
    <div class="fl">Couleur<div class="chips">${ACOL.map(([n, c]) => `<button class="chip cat${(a.color || '#4338CA') === c ? ' on' : ''}" style="--c:${c}" data-a="acc-color" data-v="${c}" aria-label="${n}"><i></i>${n}</button>`).join('')}</div></div>
    <div class="fl">Membres
      ${mem.map(m => `<div class="row" style="padding:4px 2px"><span class="avatar lg">${initials(m.email)}</span><span class="rt"><span class="rn">${esc(m.email)}${m.me ? ' (moi)' : ''}</span><span class="rs">${m.owner ? 'Propriétaire' : 'Membre'}</span></span>${owner && !m.me ? `<button class="btn sm danger" data-a="acc-kick" data-id="${m.uid}">Retirer</button>` : ''}</div>`).join('')}
      ${pend.map(i => `<div class="row" style="padding:4px 2px"><span class="avatar lg" style="opacity:.5">${initials(i.to)}</span><span class="rt"><span class="rn">${esc(i.to)}</span><span class="rs">Invitation envoyée, en attente</span></span><button class="btn sm" data-a="inv-cancel" data-id="${esc(i.id)}">Annuler</button></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px"><input class="in" id="inv-email" type="email" placeholder="Email de la personne à inviter" aria-label="Email à inviter"><button class="btn p" data-a="inv-send">Inviter</button></div>
    <p class="note" style="font-size:12px">La personne doit avoir un compte sur l'app. Elle reçoit l'invitation dans sa messagerie (cloche) ; une fois acceptée, vous voyez et modifiez le même compte.</p>
    <div class="chips">${mem.length > 1 ? '<button class="btn sm" data-a="acc-leave">Quitter ce compte</button>' : ''}${owner ? '<button class="btn sm danger" data-a="acc-del">Supprimer ce compte</button>' : ''}</div>
  </section>`;
}

/* ---------- MESSAGERIE ---------- */
const ago = t => { const s = (Date.now() - t) / 1000; if (s < 60) return "à l'instant"; if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min'; if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h'; if (s < 172800) return 'hier'; return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
function vMessages() {
  const V = $('v-messages'), me = currentUser.uid, seen = USER?.seen || {}, ver = currentUser.emailVerified;
  const inv = INV.in.filter(i => i.status === 'pending'), al = alerts(nowK());
  const acts = Object.values(ACT).flat().sort((a, b) => b.at - a.at).slice(0, 50);
  const notifBtn = PUSH_URL ? (pushOn ? '' : '<button class="btn sm" data-a="push-on">🔔 Activer les notifications</button>') : window.Notification && Notification.permission === 'default' ? '<button class="btn sm" data-a="notif-on">Activer les notifications du navigateur</button>' : '';
  V.innerHTML = `
  ${linksMsgHTML()}
  ${payConfMsgHTML()}
  ${debtReqsMsgHTML()}
  ${splitMsgHTML()}
  ${inv.length ? `<section class="card" style="display:flex;flex-direction:column;gap:12px"><h2>Invitations</h2>
    ${!ver ? `<div class="alert">${svg('mail')}<span>Pour accepter, confirme d'abord ton adresse email (sécurité : ça prouve que l'invitation t'est bien destinée).</span></div>
      <div class="chips"><button class="btn sm" data-a="verify-send">Recevoir l'email de confirmation</button><button class="btn sm" data-a="verify-check">J'ai confirmé</button></div>` : ''}
    ${inv.map(i => `<div class="row" style="padding:6px 4px;flex-wrap:wrap"><span class="avatar lg">${initials(i.fromEmail)}</span><span class="rt" style="min-width:200px"><span class="rn" style="white-space:normal"><b>${esc(i.fromEmail)}</b> t'invite à rejoindre « ${esc(i.accName)} »</span><span class="rs">${ago(i.at)}</span></span>
      <span class="chips"><button class="btn sm p" data-a="inv-accept" data-id="${esc(i.id)}" ${ver ? '' : 'disabled title="Confirme ton email d\'abord"'}>Accepter</button><button class="btn sm" data-a="inv-decline" data-id="${esc(i.id)}">Refuser</button></span></div>`).join('')}
  </section>` : ''}
  <section class="card" style="display:flex;flex-direction:column;gap:6px"><div class="ch"><h2>Alertes · ${mlab(nowK())}</h2><span class="note">${esc(accName())}</span></div>
    ${al.map(a => `<button class="alert ${a.lvl === 'bad' ? 'bad' : ''}" data-a="al-go" data-v="${esc(a.go)}" data-f="${esc(a.flt || '')}" data-q="${esc(a.q || '')}" style="border:0;text-align:left;cursor:pointer">${svg('warn')}<span>${esc(a.text)}</span></button>`).join('') || '<p class="empty" style="padding:12px">Tout est sous contrôle ce mois-ci.</p>'}
  </section>
  <section class="card" style="display:flex;flex-direction:column;gap:2px"><div class="ch"><h2>Activité des comptes partagés</h2>${notifBtn}</div>
    ${acts.map(a => { const nw = a.by !== me && a.at > (seen[a.acc] || 0);
      return `<div class="row" style="padding:8px 6px;${nw ? 'background:var(--acc-s)' : ''}"><span class="avatar lg" style="--c:${ACC[a.acc]?.color || '#4338CA'}">${initials(a.byEmail)}</span><span class="rt"><span class="rn" style="white-space:normal">${esc(a.text)}</span><span class="rs">${esc(a.by === me ? 'Moi' : a.byEmail)} · ${esc(ACC[a.acc]?.name || '')} · ${ago(a.at)}</span></span>${nw ? '<span class="pill warn">nouveau</span>' : ''}</div>`; }).join('')
      || `<p class="empty" style="padding:12px">${accIds.some(id => isShared(id)) ? 'Aucune activité pour l\'instant.' : 'Aucun compte partagé. Invite quelqu\'un depuis Paramètres › Ce compte.'}</p>`}
    <p class="note" style="font-size:12px;padding-top:8px">Les notifications du navigateur s'affichent quand l'app est ouverte (même en arrière-plan). Quand l'app est fermée, tu verras les nouveautés ici à la prochaine ouverture.</p>
  </section>
  ${XF.in.length || XF.out.length ? `<section class="card" style="display:flex;flex-direction:column;gap:2px"><div class="ch"><h2>Virements</h2><span class="note">Par défaut : ${esc(ACC[recvAccount()]?.name || '—')} <button class="lnk" data-view="parametres" data-pt="profil">changer</button></span></div>
    ${XF.in.map(t => ({ ...t, dir: 'in' })).concat(XF.out.map(t => ({ ...t, dir: 'out' }))).filter(t => !(U.xfHide || []).includes(t.id)).sort((a, b) => b.at - a.at).slice(0, 20).map(t => { const nw = t.dir === 'in' && (t.receivedAt || 0) > (seen.xfer || 0);
      return `<div class="row" style="padding:8px 6px;${nw ? 'background:var(--acc-s)' : ''}"><span class="ico" style="--c:${t.dir === 'in' ? '#10B981' : '#0EA5E9'}">${svg(t.dir === 'in' ? 'up' : 'swap')}</span><span class="rt"><span class="rn" style="white-space:normal">${t.dir === 'in' ? '<b>' + esc(String(t.fromEmail).split('@')[0]) + '</b> → toi' : 'Toi → <b>' + esc(String(t.to).split('@')[0]) + '</b>'}${t.label ? ' · ' + esc(t.label) : ''}</span><span class="rs">${ago(t.at)}${xfWhere(t)}</span></span><b class="num" style="color:${t.dir === 'in' ? 'var(--ok)' : 'var(--ink)'}">${t.dir === 'in' ? '+' : '−'}${eur(t.amount)}</b><span class="pill ${t.status === 'received' ? 'ok' : ''}" style="margin-left:8px">${t.status === 'received' ? 'Reçu' : 'Envoyé'}</span><button class="x" data-a="xf-hide" data-id="${esc(t.id)}" aria-label="Retirer de la liste" title="Retirer de la liste">${svg('x', 15)}</button></div>`; }).join('') || '<p class="empty" style="padding:12px">Aucun virement à afficher.</p>'}
  </section>` : ''}
  ${INV.out.length ? `<section class="card" style="display:flex;flex-direction:column;gap:2px"><h2 style="margin-bottom:8px">Invitations envoyées</h2>
    ${INV.out.map(i => `<div class="row" style="padding:6px 4px"><span class="rt"><span class="rn">${esc(i.to)} · « ${esc(i.accName)} »</span><span class="rs">${ago(i.at)}</span></span><span class="pill ${i.status === 'accepted' ? 'ok' : i.status === 'declined' ? 'warn' : ''}">${{ pending: 'En attente', accepted: 'Acceptée', declined: 'Refusée' }[i.status] || i.status}</span><button class="x" data-a="inv-cancel" data-id="${esc(i.id)}" aria-label="Supprimer">${svg('x', 15)}</button></div>`).join('')}
  </section>` : ''}`;
  clearTimeout(vMessages.t); vMessages.t = setTimeout(markSeen, 1500);
}

/* ---------- Actions comptes & messagerie ---------- */
function newAccountDialog(kind) {
  formDialog({ title: 'Nouveau compte', intro: 'Un compte = un compte bancaire, avec ses propres mouvements, charges fixes et budgets.',
    fields: [{ id: 'name', label: 'Nom', ph: 'ex. Revolut perso' }, { id: 'bank', label: 'Banque', ph: 'ex. Revolut, Crédit Agricole, Boursorama…' },
      { id: 'site', label: 'Site web de la banque (logo, facultatif)', ph: 'rempli tout seul pour les banques connues' },
      { id: 'kind', label: 'Type', type: 'select', options: ['Courant', 'Épargne'], value: kind === 'epargne' ? 'Épargne' : 'Courant' },
      { id: 'color', label: 'Couleur', type: 'select', options: ACOL.map(c => c[0]), value: ACOL[(accIds.length) % ACOL.length][0] },
      { id: 'email', label: 'Partager avec (facultatif)', ph: 'email de l\'autre personne', hint: 'Pour un compte joint. Tu pourras aussi inviter plus tard.' }],
    ok: 'Créer',
    onSave: v => {
      if (!v.name) { toast('Donne un nom au compte'); return false; }
      createAccount({ name: v.name, bank: v.bank, site: cleanSite(v.site) || guessSite(v.bank, v.name), color: (ACOL.find(c => c[0] === v.color) || ACOL[0])[1], kind: v.kind === 'Épargne' ? 'epargne' : 'courant' }).then(id => {
        if (v.email) inviteMember(v.email, id, v.name).then(() => toast('Compte créé · invitation envoyée à ' + v.email)).catch(e => toast(e.message));
        else toast('Compte « ' + v.name + ' » créé');
        UI.view = 'accueil'; openAccount(id);
      }).catch(e => toast('Création impossible : ' + (e.code || e.message)));
    } });
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-a]'); if (!b || !currentUser) return;
  const a = b.dataset.a, id = b.dataset.id;
  const fail = e => toast('⚠ ' + (e.message || e.code || 'Erreur'));
  switch (a) {
    case 'accmenu': return accMenu(b);
    case 'acc-open': $('accmenu')?.remove(); if (id !== active) openAccount(id); return go(UI.view === 'comptes' || UI.view === 'messages' ? 'accueil' : UI.view);
    case 'comptes': $('accmenu')?.remove(); return go('comptes');
    case 'acc-new': $('accmenu')?.remove(); return newAccountDialog();
    case 'acc-new-sav': return newAccountDialog('epargne');
    case 'acc-kind': return accDoc(active).update({ kind: b.dataset.v }).then(() => { if (b.dataset.v === 'epargne' && UI.view === 'budgets') UI.view = 'accueil'; toast(b.dataset.v === 'epargne' ? 'Compte passé en Épargne' : 'Compte passé en Courant'); }).catch(fail);
    case 'sav-incl': { ev.stopPropagation(); U.savIncl[id] = b.checked; saveUser(); render(); return toast(b.checked ? 'Compté dans ton épargne' : 'Retiré de ton épargne totale'); }
    case 'sav-goal': return savGoalDialog();
    case 'acc-color': return accDoc(active).update({ color: b.dataset.v }).catch(fail);
    case 'inv-send': { const e = $('inv-email').value; return inviteMember(e).then(() => { toast('Invitation envoyée à ' + e.trim()); $('inv-email').value = ''; }).catch(fail); }
    case 'inv-cancel': return db.collection('invites').doc(id).delete().then(() => toast('Invitation supprimée')).catch(fail);
    case 'inv-accept': { const i = INV.in.find(x => x.id === id); if (!i) return;
      b.disabled = true; return acceptInvite(i).then(() => { toast('Bienvenue dans « ' + i.accName + ' » !'); UI.view = 'accueil'; openAccount(i.acc); })
        .catch(e => { b.disabled = false; fail(e.code === 'permission-denied' ? new Error('Refusé : confirme ton email puis réessaie (ou l\'invitation a été annulée).') : e); }); }
    case 'inv-decline': return db.collection('invites').doc(id).update({ status: 'declined', answeredAt: Date.now() }).then(() => toast('Invitation refusée')).catch(fail);
    case 'verify-send': return currentUser.sendEmailVerification().then(() => toast('📧 Email envoyé à ' + currentUser.email + ' — clique sur le lien puis sur « J\'ai confirmé »')).catch(fail);
    case 'verify-check': return currentUser.reload().then(() => currentUser.getIdToken(true)).then(() => { currentUser = auth.currentUser; render(); toast(currentUser.emailVerified ? '✅ Email confirmé' : 'Pas encore confirmé : clique sur le lien reçu par email'); }).catch(fail);
    case 'notif-on': return Notification.requestPermission().then(() => render());
    case 'push-on': return pushEnable();
    case 'al-go': cur = keyDate(nowK()); return go(b.dataset.v, { flt: b.dataset.f || 'all', q: b.dataset.q || '' });
    case 'acc-kick': { const m = membersOf(active).find(x => x.uid === id); if (!m || !confirm('Retirer ' + m.email + ' de ce compte ? Il n\'y aura plus accès.')) return;
      return removeMember(active, id).then(() => toast(m.email + ' retiré')).catch(fail); }
    case 'acc-leave': if (!confirm('Quitter « ' + accName() + ' » ? Tu n\'y auras plus accès (les autres membres le gardent).')) return;
      return leaveAccount(active).then(() => toast('Tu as quitté le compte')).catch(fail);
    case 'acc-del': { const n = accName(); if (accIds.length < 2) return toast('C\'est ton seul compte : crée-en un autre avant de le supprimer.');
      if (prompt('Supprimer définitivement « ' + n + ' », ses mouvements et ses sauvegardes' + (isShared() ? ' (pour TOUS les membres)' : '') + ' ?\nTape SUPPRIMER pour confirmer.') !== 'SUPPRIMER') return;
      const old = active; flush(); return deleteAccountData(old).then(() => toast('Compte « ' + n + ' » supprimé')).catch(fail); }
  }
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.dataset.acc || !active) return;
  const f = el.dataset.acc; let v = el.value.trim(); if (f === 'name' && !v) return render();
  const upd = { [f]: f === 'site' ? cleanSite(v) : v };
  if ((f === 'bank' || f === 'name') && !ACC[active]?.site) { const g = guessSite(v); if (g) upd.site = g; }   // logo automatique
  accDoc(active).update(upd).then(() => toast('Compte mis à jour')).catch(e => toast('⚠ ' + (e.code || e.message)));
});
