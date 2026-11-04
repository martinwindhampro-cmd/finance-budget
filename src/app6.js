
/* ---------- ACCUEIL D'UN COMPTE ÉPARGNE ---------- */
function vSavAccueil() {
  const k = ck(), m = month(k), c = calc(m, k), V = $('v-accueil'), a = ACC[active] || {}, G = S.goal || {};
  const inMo = sum(m.incomes.filter(i => i.status === 'Reçu')), outMo = sum(m.expenses.filter(e => e.status === 'Payé'), cash);
  // Variation moyenne sur les derniers mois écoulés (pour estimer la date de l'objectif)
  const past = Object.keys(S.months).sort().filter(x => x < nowK() && !isDraft(S.months[x])).slice(-6);
  const avg = past.length ? sum(past, x => calc(S.months[x], x).flow) / past.length : c.flow;
  const goal = num(G.amount), gp = goal > 0 ? Math.min(100, pct(c.current, goal)) : 0;
  let eta = '';
  if (goal > 0) { if (c.current >= goal) eta = 'Objectif atteint 🎉'; else if (avg > 0) { const n = Math.ceil((goal - c.current) / avg), d = new Date(); d.setMonth(d.getMonth() + n); eta = `Atteint vers ${MS[d.getMonth()]} ${d.getFullYear()} au rythme moyen (${eur0(avg)} / mois)`; } else eta = 'Rythme actuel insuffisant pour estimer une date'; }
  const ks = Object.keys(S.months).sort().filter(x => x <= nowK() && !isDraft(S.months[x]));
  const recent = []; groups(m, k, 'all', '').filter(g => g.key !== 'next').forEach(g => g.items.forEach(it => recent.push([g, it])));
  let lastG = null;
  const recentHTML = recent.slice(0, 8).map(([g, [x, t]]) => { const h = g !== lastG ? `<div class="lbl">${g.label}</div>` : ''; lastG = g; return h + rowHTML(x, t, k, { pill: false }); }).join('') || '<p class="empty">Aucun versement ce mois-ci. Clique sur « + Ajouter ».</p>';
  const mem = membersOf(active);
  V.innerHTML = `
  <div class="grid2">
    <section class="hero sav" aria-label="Solde du compte épargne" style="background:color-mix(in srgb,${a.color || '#0F766E'} 45%,#03221F)">
      <div class="deco"><i style="right:-50px;top:-70px;width:240px;height:240px;background:rgba(255,255,255,.08)"></i></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span class="t">${esc(a.name || 'Épargne')} · solde actuel ${tip('solde', 'Solde du compte', eq([['Solde au 1er ' + MN[cur.getMonth()].toLowerCase(), eur(c.init)], ['+ Versements reçus', eur(inMo)], ['− Retraits', eur(outMo)]], ['= Solde actuel', eur(c.current)], c.bankSet ? '' : 'Solde du 1er calculé depuis le mois précédent.'), 'dn rt')}</span>
        <span class="v num">${eur(c.current)}</span>
        <span class="s">Ce mois : <b class="num">+${eur(inMo)}</b> versés · <b class="num">−${eur(outMo)}</b> retirés</span>
      </div>
      ${goal > 0 ? `<div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--sav-t)"><span>${esc(G.name || 'Objectif')} · ${eur0(goal)}</span><b class="num" style="color:#fff">${Math.round(gp)} %</b></div>
        <div class="hb"><i style="width:${gp}%"></i></div><span style="font-size:12px;color:var(--sav-t)">${eta}</span></div>` : ''}
      <div style="display:flex;gap:14px;flex-wrap:wrap"><button class="bk" data-a="sav-goal">${goal > 0 ? 'Modifier l\'objectif' : '+ Fixer un objectif commun'}</button><button class="bk" data-a="bank">Solde de départ : ${eur(c.init)} ${c.bankSet ? '(saisi)' : '(calculé)'}</button></div>
    </section>
    <section class="card small" style="display:flex;flex-direction:column;gap:12px"><h2>${mem.length > 1 ? 'Membres' : 'Compte personnel'}</h2>
      ${mem.map(x => `<div class="row" style="padding:2px"><span class="avatar lg">${initials(x.email)}</span><span class="rt"><span class="rn">${esc(x.me ? 'Moi' : x.email)}</span><span class="rs">${x.owner ? 'Propriétaire' : 'Membre'}</span></span></div>`).join('')}
      <label class="chk" style="font-size:13px"><input type="checkbox" data-a="sav-incl" data-id="${active}" ${savIncluded(active) ? 'checked' : ''}>Compter dans mon épargne totale</label>
      ${mem.length < 2 ? '<button class="lnk" data-view="parametres" data-pt="compte" style="align-self:flex-start">Partager ce compte</button>' : ''}
    </section>
  </div>
  ${savIntHTML()}
  ${ks.length > 1 ? `<section class="card"><div class="ch"><h2>Évolution du solde</h2></div><div class="cvh" style="height:240px"><canvas id="c-savacc"></canvas></div></section>` : ''}
  <section class="card" style="display:flex;flex-direction:column;gap:2px"><div class="ch"><h2>Versements et retraits · ${MN[cur.getMonth()]}</h2><button class="lnk" data-view="mouvements">Tout voir</button></div>${recentHTML}</section>`;
  if (ks.length > 1) chart('c-savacc', { type: 'line', data: { labels: ks.map(mshort), datasets: [{ label: 'Solde fin de mois', data: ks.map(x => Math.round(calc(S.months[x], x).est)), borderColor: a.color || '#0F766E', backgroundColor: 'transparent', tension: .3, borderWidth: 3, pointRadius: 3 }] }, options: chartOpts({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ' ' + eur(x.raw) } } } }) });
}
function savGoalDialog() {
  const G = S.goal || {};
  formDialog({ title: 'Objectif du compte', intro: isShared() ? 'Objectif commun, visible par tous les membres.' : 'Objectif de ce compte.',
    fields: [{ id: 'name', label: 'Nom', value: G.name || '', ph: 'ex. Vacances, apport maison…' }, { id: 'amount', label: 'Montant visé', type: 'num', value: G.amount || '' }],
    onSave: v => mutate(() => { if (!(v.amount > 0)) delete S.goal; else S.goal = { name: v.name, amount: v.amount }; }, v.amount > 0 ? 'Objectif : ' + (v.name || '') + ' ' + eur0(v.amount) : 'Objectif retiré'),
    onDelete: G.amount ? () => mutate(() => { delete S.goal; }, 'Objectif retiré') : null, delLabel: 'Retirer' });
}
