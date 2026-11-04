
/* ============================== MODE SIMPLE ==============================
   L'essentiel seulement : combien il me reste, ajouter une dépense / une rentrée d'argent, ce qui reste à payer.
   Choix propre à chaque appareil (ex. simple sur le téléphone, complet sur le PC).                              */
const SIMPLE = () => { try { return localStorage.getItem('mode') === 'simple'; } catch (e) { return false; } };
const SIMPLE_VIEWS = ['accueil', 'mouvements', 'parametres', 'messages', 'comptes', 'releves'];
function setMode(m) {
  try { localStorage.setItem('mode', m); } catch (e) {}
  document.documentElement.classList.toggle('simple', m === 'simple');
  if (m === 'simple' && !SIMPLE_VIEWS.includes(UI.view)) UI.view = 'accueil';
  if (m === 'simple' && !['all', 'todo', 'inc'].includes(UI.flt)) UI.flt = 'all';
  UI.allSet = false; render();
  toast(m === 'simple' ? 'Affichage simple' : 'Affichage complet');
}
document.documentElement.classList.toggle('simple', SIMPLE());

// Première ouverture sur téléphone : on demande quel affichage la personne préfère
let modeAsked = false;
function askModeOnce() {
  if (modeAsked) return; modeAsked = true;
  const has = () => { try { return localStorage.getItem('mode') !== null; } catch (e) { return true; } };
  if (has() || innerWidth > 760) return;
  setTimeout(() => {
    if (has() || $('dlg').open || P) return;
    const d = $('dlg');
    d.innerHTML = `<div class="dw"><div class="dh"><h2>Bienvenue 👋</h2></div>
      <p class="note" style="font-size:15px">Comment veux-tu utiliser l'application ? Tu pourras changer à tout moment dans Réglages.</p>
      <button class="row rowb modeopt" data-m="simple"><span class="ico" style="--c:#10B981">${svg('check')}</span><span class="rt"><span class="rn">Simple</span><span class="rs" style="white-space:normal">L'essentiel : ce qu'il me reste, ajouter une dépense, ce qui est à payer.</span></span></button>
      <button class="row rowb modeopt" data-m="full"><span class="ico" style="--c:#4338CA">${svg('chart')}</span><span class="rt"><span class="rn">Complet</span><span class="rs" style="white-space:normal">Tout : budgets, épargne, historique, alertes, virements…</span></span></button></div>`;
    d.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; d.close(); setMode(b.dataset.m); };
    d.showModal();
  }, 700);
}

/* ---------- Accueil simple ---------- */
function vSimpleAccueil() {
  const k = ck(), m = month(k), c = calc(m, k), V = $('v-accueil'), isCur = k === nowK(), mn = MN[cur.getMonth()].toLowerCase();
  const empty = !S.templates.expenses.length && !S.templates.incomes.length && !m.expenses.length && !m.incomes.length;
  const al = alerts(k);
  const unpaid = m.expenses.filter(e => e.status !== 'Payé').sort((a, b) => (parseInt(a.date) || 99) - (parseInt(b.date) || 99));
  const recent = [...m.expenses.map(x => [x, 'expenses']), ...m.incomes.map(x => [x, 'incomes'])].filter(([x, t]) => isPaid(x, t))
    .sort((a, b) => (parseInt(b[0].date) || 0) - (parseInt(a[0].date) || 0)).slice(0, 5);
  V.innerHTML = `
  ${empty ? `<section class="card" style="display:flex;flex-direction:column;gap:12px">
      <h2>Pour commencer</h2>
      <p class="note" style="font-size:15px">Trois petites étapes, ensuite tout se fait tout seul chaque mois.</p>
      <button class="btn big" data-a="bank">1. Combien j'ai sur mon compte</button>
      <button class="btn big" data-a="ob-inc">2. Mon salaire (chaque mois)</button>
      <button class="btn big" data-a="ob-fix">3. Une facture qui revient (loyer, abonnement…)</button></section>` : ''}
  <section class="hero simple-hero" aria-label="Ce qu'il me reste" style="background:color-mix(in srgb,${ACC[active]?.color || '#4338CA'} 42%,#0B0A24)">
    <span class="t">${c.past ? 'Il me restait fin ' + mn : 'Il me reste pour finir le mois'}</span>
    <span class="v num${c.rav < 0 ? ' neg' : ''}">${eur(c.rav)}</span>
    ${c.perDay != null && c.rav > 0 ? `<span class="s">soit environ <b class="num">${eur0(c.perDay)} par jour</b> jusqu'au ${dim(k)} ${mn}</span>` : c.rav < 0 ? '<span class="s">Attention : les dépenses prévues dépassent ce que tu as.</span>' : ''}
    <div class="srows">
      <button class="srow" data-a="bank"><span>Sur mon compte ${isCur ? 'aujourd\'hui' : ''}</span><b class="num">${eur(c.current)}</b></button>
      <button class="srow" data-a="flt" data-v="todo" data-go="mouvements"><span>Encore à payer ce mois</span><b class="num">${eur(c.outPlan)}</b></button>
    </div>
  </section>
  <div class="sbtns">
    <button class="sbtn out" data-a="s-new" data-t="expenses"><b>−</b>Dépense</button>
    <button class="sbtn in" data-a="s-new" data-t="incomes"><b>+</b>Rentrée d'argent</button>
  </div>
  ${al.length ? `<div class="alert ${al[0].lvl === 'bad' ? 'bad' : ''}" role="status">${svg('warn')}<span>${esc(al[0].text)}</span><button class="lnk" data-a="${al.length > 1 ? 'alerts' : 'alertgo'}">Voir</button></div>` : ''}
  <section class="card" style="display:flex;flex-direction:column;gap:2px">
    <div class="ch"><h2>À payer ce mois</h2>${unpaid.length > 4 ? '<button class="lnk" data-a="flt" data-v="todo" data-go="mouvements">Tout voir</button>' : ''}</div>
    ${unpaid.slice(0, 4).map(e => rowHTML(e, 'expenses', k)).join('') || '<p class="empty">Tout est payé 👍</p>'}
  </section>
  <section class="card" style="display:flex;flex-direction:column;gap:2px">
    <div class="ch"><h2>Derniers mouvements</h2><button class="lnk" data-view="mouvements">Tout voir</button></div>
    ${recent.map(([x, t]) => rowHTML(x, t, k)).join('') || '<p class="empty">Rien pour l\'instant. Touche « Dépense » ou « Rentrée d\'argent ».</p>'}
  </section>
  ${debtsHTML(true)}
  ${goals().length ? goalsHTML() : ''}
  <p class="note" style="text-align:center;font-size:13px">Touche une ligne pour la modifier. Touche l'étiquette « À payer » pour la marquer payée.</p>`;
}

/* ---------- Saisie simple ---------- */
function paintSimplePanel() {
  const d = P.d, ex = P.type === 'expenses', sav = isSavAcc(), paid = isPaid(d, P.type);
  const fixed = !P.isNew && P.id && month()[P.type].find(e => e.id === P.id)?.isFixed;
  const names = [...new Set(Object.values(S.months).flatMap(m => m[P.type].map(e => e.name)).filter(Boolean))].slice(-80);
  const W = sav ? (ex ? ['Retrait', 'retiré'] : ['Versement', 'versé']) : ex ? ['Dépense', 'payé'] : ['Rentrée d\'argent', 'reçu'];
  $('panel').innerHTML = `
  <div class="pbody simple-p">
    <div class="dh"><h2 id="pn-title">${P.isNew ? 'Nouvelle ' + W[0].toLowerCase() : 'Modifier'}</h2><button class="ib sm" data-p="close" aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    ${P.isNew ? `<div class="seg big" role="group" aria-label="Type"><button class="${ex ? 'on' : ''}" data-p="type" data-v="expenses">${sav ? 'Retrait' : 'Dépense'}</button><button class="${!ex ? 'on' : ''}" data-p="type" data-v="incomes">${sav ? 'Versement' : 'Rentrée d\'argent'}</button></div>` : ''}
    <label class="fl">Combien ?<span class="amt" style="margin:0"><input id="pn-a" inputmode="decimal" placeholder="0,00" aria-label="Montant" value="${esc(d.amount)}" data-pf="amount"><span>${P.cur && P.cur !== 'EUR' ? esc(P.cur) : '€'}</span></span></label>
    ${fxSelectHTML()}
    <label class="fl">C'est quoi ?<input class="in" id="pn-n" list="pn-dl" autocomplete="off" value="${esc(d.name)}" data-pf="name" placeholder="${ex ? 'ex. Courses, Essence, Loyer' : 'ex. Salaire, Remboursement'}"><datalist id="pn-dl">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
    <div class="fl">C'est déjà ${W[1]} ?<div class="seg big" role="group"><button class="${paid ? 'on' : ''}" data-p="spaid" data-v="1">Oui, ${W[1]}</button><button class="${!paid ? 'on' : ''}" data-p="spaid" data-v="0">Pas encore</button></div></div>
    <label class="fl">Quel jour du mois ?<input class="in" id="pn-d" type="number" min="1" max="31" inputmode="numeric" value="${esc(d.date)}" data-pf="date" placeholder="ex. ${today()}"></label>
    ${fixed ? `<div class="fixinfo"><b>Revient chaque mois</b><button class="lnk" data-p="stop" style="align-self:flex-start;color:inherit;text-decoration:underline">Ne plus répéter à partir du mois prochain</button></div>`
      : `<label class="chk big"><input type="checkbox" data-p="repeat" ${P.repeat ? 'checked' : ''}>Revient tous les mois</label>`}
    ${sav ? '' : `<button class="lnk" data-p="full" style="align-self:flex-start;font-size:14px">Plus d'options (catégorie, icône${ex ? ', ½ partagé' : ''}…)</button>`}
  </div>
  <div class="pfoot">
    <button class="btn p big" style="flex:1" data-p="save">Enregistrer</button>
    ${!P.isNew ? `<button class="btn big danger" data-p="del">${svg('trash', 18)} Supprimer</button>` : ''}
  </div>`;
}

/* ---------- Réglages simples ---------- */
function vSimpleParametres() {
  $('v-parametres').innerHTML = `
  <div class="grid2">
    ${installHTML()}
    <section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:10px"><h2>Mon compte</h2>
      <p class="note">${esc(currentUser?.email || '')}</p>
      <button class="btn big" data-a="bank">Corriger le solde de mon compte</button>
      <button class="btn big" data-a="pwd">Changer de mot de passe</button>
      <button class="btn big" data-a="logout">${svg('out', 18)} Se déconnecter</button>
    </section>
  </div>
  <button class="btn" data-a="s-allset" style="align-self:center">Afficher tous les réglages</button>`;
}
