
/* ---------- ÉPARGNE ---------- */
const AT = { 'Livret A': ['#14B8A6','bank'], 'LDDS': ['#10B981','sprout'], 'LEP': ['#84CC16','coin'], 'PEL': ['#6366F1','home'], 'PEA': ['#8B5CF6','trend'],
  'Assurance-vie': ['#0EA5E9','shield'], 'CTO': ['#A855F7','trend'], 'Crypto': ['#F59E0B','coin'], 'Autre': ['#94A3B8','tag'] };
const accs = () => U.savAcc = U.savAcc || [];
const aBal = (a, k = nowK()) => { const ks = Object.keys(a.hist || {}).sort().filter(x => x <= k); return ks.length ? num(a.hist[ks[ks.length - 1]]) : 0; };
const aLast = a => { const ks = Object.keys(a.hist || {}).sort(); return ks.length ? ks[ks.length - 1] : null; };
const svD = () => ({ capital: 0, monthly: 200, mode: 'fix', salary: 0, salGrowth: 2, pct: 10, raise: 0, bonus: 0, rate: 4, infl: 2, years: 20, goal: 50000 });
const sv = () => U.savings = Object.assign(svD(), U.savings || {});

// Simulation mois par mois (versements en fin de mois, intérêts composés mensuellement)
function svSim(p, r, base) {
  const mr = Math.pow(1 + r / 100, 1 / 12) - 1, N = Math.max(1, Math.round(num(p.years))) * 12;
  let capi = num(p.capital), cv = 0, gm = null, d1 = 0; const rows = [{ y: 0, cap: capi, cv: 0 }];
  for (let i = 1; i <= N; i++) {
    const yi = Math.floor((i - 1) / 12);
    const d = base != null ? base * Math.pow(1 + num(p.raise) / 100, yi)
      : p.mode === 'pct' ? num(p.salary) * Math.pow(1 + num(p.salGrowth) / 100, yi) * num(p.pct) / 100
      : num(p.monthly) * Math.pow(1 + num(p.raise) / 100, yi);
    if (i === 1) d1 = d;
    capi = capi * (1 + mr) + d; cv += d;
    if (i % 12 === 0) { capi += num(p.bonus); cv += num(p.bonus); }
    if (gm == null && num(p.goal) > 0 && capi >= num(p.goal)) gm = i;
    if (i % 12 === 0) rows.push({ y: i / 12, cap: capi, cv });
  }
  return { rows, cap: capi, cv, gm, d1 };
}
const gmTxt = gm => { const y = Math.floor(gm / 12), mo = gm % 12; return [y ? y + ' an' + (y > 1 ? 's' : '') : '', mo ? mo + ' mois' : ''].filter(Boolean).join(' '); };

// Comptes bancaires de type Épargne (dont les comptes partagés) et choix de les compter dans mon épargne
const savBankIds = () => accIds.filter(id => ACC[id] && isSavAcc(id));
const savIncluded = id => U.savIncl[id] !== false;
function vEpargne() {
  const V = $('v-epargne'), A = accs(), p = sv(), m = month(nowK());
  const SB = savBankIds(), simple = sum(A, a => aBal(a)), bankInc = sum(SB.filter(savIncluded), id => num(ACC[id].summary?.current));
  const tot = simple + bankInc, it = sum(A, a => aBal(a) * num(a.rate) / 100);
  const G = goals(), gs = sum(G, g => num(g.saved)), gt = sum(G, g => num(g.target));
  const keys = [...new Set(A.flatMap(a => Object.keys(a.hist || {})))].sort();
  // Répartition de l'épargne totale
  const BC = ['#38BDF8', '#FBBF24', '#F472B6', '#A3E635'];
  const parts = SB.filter(savIncluded).map((id, i) => [ACC[id].name, num(ACC[id].summary?.current), BC[i % BC.length]])
    .concat(A.map(a => [a.name, aBal(a), (AT[a.type] || AT.Autre)[0]])).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const top = parts.slice(0, 4), rest = sum(parts.slice(4), x => x[1]); if (rest > 0) top.push(['Autres', rest, '#94A3B8']);
  const sim = svSim(p, num(p.rate));

  const sbRows = SB.map(id => { const a = ACC[id], inc = savIncluded(id), mem = membersOf(id);
    return `<div class="srow2${inc ? '' : ' off'}"><button class="rowb" data-a="acc-open" data-id="${id}"><span class="accbig">${accBadge(a, 20)}</span><span class="rt"><span class="rn">${esc(a.name)}</span><span class="rs">${esc([a.bank, mem.length > 1 ? 'partagé à ' + mem.length : ''].filter(Boolean).join(' · ') || 'Compte épargne')}</span></span><b class="num">${a.summary ? eur(a.summary.current) : '—'}</b></button>
      <label class="swi" title="Compter ce compte dans mon épargne totale"><input type="checkbox" data-a="sav-incl" data-id="${id}" ${inc ? 'checked' : ''}><i></i><span>${inc ? 'Compté' : 'Ignoré'}</span></label></div>`; }).join('');
  const saRows = A.map(a => { const [col, ic] = AT[a.type] || AT.Autre, lk = aLast(a);
    return `<div class="srow2"><button class="rowb" data-a="sav-acc" data-id="${a.id}"><span class="ico" style="--c:${col}">${svg(ic)}</span><span class="rt"><span class="rn">${esc(a.name)}</span><span class="rs">${esc([a.type !== a.name ? a.type : '', num(a.rate) ? String(num(a.rate)).replace('.', ',') + ' %' : '', lk ? 'màj ' + mshort(lk) : ''].filter(Boolean).join(' · '))}</span></span><b class="num">${eur(aBal(a))}</b></button></div>`; }).join('');

  V.innerHTML = `
  <section class="hero sav savhero" aria-label="Épargne totale">
    <div class="deco"><i style="right:-50px;top:-70px;width:220px;height:220px;background:var(--sav-2);opacity:.6"></i></div>
    <div class="sh-l">
      <span class="t">Épargne totale ${tip('épargne totale', 'Épargne totale', 'Tes comptes d\'épargne simples + les comptes Épargne que tu as choisi de compter.' + eq(parts.map(x => [esc(x[0]), eur(x[1])]), ['= Total', eur(tot)]), 'dn rt')}</span>
      <span class="v num">${eur(tot)}</span>
      <div class="sh-meta">
        <span>Prévue ce mois <b class="num">${eur(num(m.savingGoal))}</b> <button class="lnk" data-a="saving" style="color:inherit">modifier</button></span>
        ${it > 0 ? `<span>Intérêts estimés <b class="num">≈ ${eur0(it)} / an</b></span>` : ''}
        ${G.length ? `<span>Objectifs <b class="num">${eur0(gs)}</b> sur ${eur0(gt)}</span>` : ''}
      </div>
    </div>
    <div class="sh-r">
      ${tot > 0 ? `<span class="t" style="font-size:13px">Répartition</span>
      <div class="stack" style="height:12px;background:rgba(255,255,255,.15)">${top.map(x => `<i style="flex:${x[1]};--c:${x[2]}"></i>`).join('')}</div>
      <div class="sleg">${top.map(x => `<span><i style="--c:${x[2]}"></i><em>${esc(x[0])}</em><b class="num">${eur0(x[1])}</b><small>${Math.round(x[1] / tot * 100)} %</small></span>`).join('')}</div>`
      : '<p style="color:var(--sav-t);font-size:14px;margin:0">Ajoute un compte d\'épargne ci-dessous pour suivre ton épargne.</p>'}
    </div>
  </section>

  <div class="savgrid">
    <section class="card scard" aria-label="Comptes Épargne">
      <div class="ch"><h2>Comptes Épargne ${tip('comptes épargne', 'Comptes Épargne', 'Les comptes du sélecteur dont le type est « Épargne », partagés ou non. Leur solde suit les versements et retraits saisis dedans. « Compté / Ignoré » : choisis ceux qui entrent dans ton épargne totale (utile pour un compte joint).', 'rt')}</h2><button class="btn sm" data-a="acc-new-sav">${svg('plus', 16)} Ajouter</button></div>
      ${sbRows || '<p class="empty">Un compte bancaire d\'épargne (Livret chez ta banque, compte joint épargne…) dont tu saisis les versements.</p>'}
      ${SB.length ? `<div class="sfoot"><span>Total compté</span><b class="num">${eur(bankInc)}</b></div>` : ''}
    </section>
    <section class="card scard" aria-label="Comptes d'épargne simples">
      <div class="ch"><h2>Comptes d'épargne simples ${tip('comptes simples', 'Comptes simples', 'Un solde que tu mets à jour toi-même de temps en temps (Livret A, PEA, assurance-vie…). Personnels, visibles par toi seul.', 'rt')}</h2><button class="btn sm" data-a="sav-new">${svg('plus', 16)} Ajouter</button></div>
      ${saRows || '<p class="empty">Livret A, PEA, assurance-vie… : tu indiques juste le solde de temps en temps.</p>'}
      ${A.length ? `<div class="sfoot"><button class="lnk" data-a="sav-bal">Mettre à jour mes soldes</button><b class="num">${eur(simple)}</b></div>` : ''}
    </section>
  </div>

  ${goalsHTML()}

  ${!UI.simOpen ? `<button class="card simbtn" data-a="sim-open"><span class="ico" style="--c:#14B8A6">${svg('trend')}</span><span class="rt"><span class="rn">Simulateur d'épargne</span><span class="rs">${p.mode === 'pct' ? num(p.pct) + ' % du salaire' : eur0(sim.d1) + ' / mois'} à ${String(num(p.rate)).replace('.', ',')} % pendant ${Math.round(num(p.years))} ans → <b class="num" style="color:var(--ink)">${eur0(sim.cap)}</b></span></span><span class="btn sm">Ouvrir</span></button>`
    : `<section class="card" aria-label="Simulateur d'épargne" style="display:flex;flex-wrap:wrap;gap:28px">
    <div style="flex:1 1 260px;display:flex;flex-direction:column;gap:16px">
      <div class="ch" style="margin:0"><h2>Simulateur</h2><button class="lnk" data-a="sim-open">Réduire</button></div>
      <div class="seg" role="group" aria-label="Mode de versement"><button class="${p.mode === 'fix' ? 'on' : ''}" data-a="svmode" data-v="fix">Montant fixe</button><button class="${p.mode === 'pct' ? 'on' : ''}" data-a="svmode" data-v="pct">% du salaire</button></div>
      ${p.mode === 'fix' ? svRange('monthly', 'Versement mensuel', 0, 2000, 10, ' €') : svRange('pct', 'Part du salaire épargnée', 0, 80, 1, ' %')}
      ${svRange('rate', 'Rendement annuel net', 0, 12, 0.1, ' %')}
      ${svRange('years', 'Durée', 1, 50, 1, ' ans')}
      <button class="lnk" data-a="svmore" style="align-self:flex-start">${UI.svMore ? 'Moins d\'options' : 'Plus d\'options (capital, salaire, inflation…)'}</button>
      ${UI.svMore ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        ${svNum('capital', 'Capital de départ', '€')}${svNum('goal', 'Objectif', '€')}
        ${p.mode === 'pct' ? svNum('salary', 'Salaire net mensuel', '€') + svNum('salGrowth', 'Hausse du salaire / an', '%') : svNum('raise', 'Hausse du versement / an', '%')}
        ${svNum('bonus', 'Versement exceptionnel / an', '€')}${svNum('infl', 'Inflation / an', '%')}
      </div>
      <button class="btn sm" data-a="sv-use">Partir de mon épargne actuelle (${eur0(tot)})</button>` : ''}
      <div class="chips"><button class="btn sm" data-a="sv-apply">Appliquer au mois</button><button class="btn sm" data-a="sv-take">Reprendre l'épargne du mois</button></div>
      <p class="note" style="font-size:12px">Simulation indicative : intérêts composés chaque mois, « prudent / dynamique » = rendement −2 / +2 points. Ce n'est pas un conseil financier.</p>
    </div>
    <div style="flex:2 1 380px;min-width:0;display:flex;flex-direction:column;gap:14px" id="sv-res"></div>
  </section>`}

  ${keys.length > 1 ? `<section class="card"><div class="ch"><h2>Évolution de mes comptes simples</h2></div><div class="cvh"><canvas id="c-acc"></canvas></div></section>` : ''}`;
  if (UI.simOpen) svResults();
  if (keys.length > 1) chart('c-acc', { type: 'bar', data: { labels: keys.map(mshort), datasets: A.map(a => ({ label: a.name, data: keys.map(k => aBal(a, k)), backgroundColor: (AT[a.type] || AT.Autre)[0], borderRadius: 4 })) },
    options: chartOpts({ scales: { x: { stacked: true, ticks: { color: cssv('--mute') }, grid: { display: false } }, y: { stacked: true, ticks: { color: cssv('--mute'), callback: v => Math.round(v).toLocaleString('fr-FR') + ' €' }, grid: { color: cssv('--line') }, border: { display: false } } } }) });
}
function svRange(f, l, min, max, step, u) {
  const v = sv()[f];
  return `<label class="fl"><span style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink2)">${l} <b class="num" style="color:var(--ink)" data-svl="${f}">${String(v).replace('.', ',')}${u}</b></span><input type="range" data-sv="${f}" data-u="${u}" min="${min}" max="${max}" step="${step}" value="${v}" style="accent-color:var(--acc);height:24px"></label>`;
}
const svNum = (f, l, u) => `<label class="fl">${l}<span style="display:flex;align-items:center;gap:6px"><input class="in" type="number" step="any" inputmode="decimal" data-sv="${f}" value="${sv()[f]}" style="text-align:right"><small>${u}</small></span></label>`;
function svResults() {
  const box = $('sv-res'); if (!box) return;
  const p = sv(), R = num(p.rate), c = svSim(p, R), lo = svSim(p, Math.max(0, R - 2)), hi = svSim(p, R + 2);
  const Y = Math.max(1, Math.round(num(p.years))), real = c.cap / Math.pow(1 + num(p.infl) / 100, Y), dep = num(p.capital), gain = c.cap - c.cv - dep;
  box.innerHTML = `<div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      <div class="kp" style="background:color-mix(in srgb,#14B8A6 12%,var(--card))"><span>Dans ${Y} an${Y > 1 ? 's' : ''}</span><b>${eur0(c.cap)}</b><small>${eur0(real)} en € d'aujourd'hui</small></div>
      <div class="kp"><span>Total versé</span><b>${eur0(c.cv + dep)}</b><small>dont départ ${eur0(dep)}</small></div>
      <div class="kp"><span>Intérêts ${tip('intérêts', 'Intérêts gagnés', eq([['Capital final', eur0(c.cap)], ['− Total versé', eur0(c.cv + dep)]], ['= Intérêts', eur0(gain)]), 'lf')}</span><b>${eur0(gain)}</b><small>${c.cap > 0 ? Math.round(gain / c.cap * 100) : 0} % du capital final</small></div>
    </div>
    <div class="cvh" style="height:240px"><canvas id="c-sv"></canvas></div>
    <div class="legend" style="font-size:12px"><span>1er versement : <b class="num">${eur(c.d1)}</b></span>${num(p.goal) > 0 ? `<span>Objectif ${eur0(p.goal)} : <b>${c.gm ? 'dans ' + gmTxt(c.gm) : 'non atteint'}</b></span>` : ''}<span style="margin-left:auto">Prudent <b class="num">${eur0(lo.cap)}</b> · Dynamique <b class="num">${eur0(hi.cap)}</b></span></div>`;
  const ds = (l, r, col, w, dash) => ({ label: l, data: r.rows.map(x => Math.round(x.cap)), borderColor: col, backgroundColor: col, tension: .25, pointRadius: 0, borderWidth: w, borderDash: dash || [] });
  chart('c-sv', { type: 'line', data: { labels: c.rows.map(r => r.y ? 'An ' + r.y : 'Auj.'), datasets: [ds('Capital', c, '#0F766E', 3), ds('Prudent', lo, '#F59E0B', 1.5, [3, 3]), ds('Dynamique', hi, '#10B981', 1.5, [3, 3]),
    { label: 'Total versé', data: c.rows.map(x => Math.round(x.cv + dep)), borderColor: '#94A3B8', backgroundColor: '#94A3B8', borderDash: [6, 4], pointRadius: 0, borderWidth: 2 }] }, options: chartOpts() });
}

/* ---------- HISTORIQUE ---------- */
function hRows() {
  const nk = nowK();
  let ks = Object.keys(S.months).sort().filter(k => k <= nk && !(k < nk && isDraft(S.months[k])));
  if (UI.hp > 0) ks = ks.slice(-UI.hp);
  if (UI.hp < 0) ks = ks.filter(k => +k.slice(0, 4) === UI.hy);
  return ks.map(k => { const m = S.months[k], c = calc(m, k);
    return { k, m, inc: c.incAll, out: c.outMine, sav: c.saving, net: c.incAll - c.outMine, tx: c.incAll > 0 ? (c.incAll - c.outMine) / c.incAll * 100 : null, start: c.init, end: c.est, cur: k === nk }; });
}
function vHistorique() {
  const V = $('v-historique'), R = hRows();
  const P = [[3, '3 mois'], [6, '6 mois'], [12, '12 mois'], [0, 'Tout'], [-1, 'Année']];
  const head = `<div class="ch" style="margin:0"><div class="chips">${P.map(([v, l]) => `<button class="chip${UI.hp === v ? ' on' : ''}" data-a="hp" data-v="${v}">${l}</button>`).join('')}
    ${UI.hp < 0 ? `<span style="display:flex;align-items:center;gap:4px;margin-left:8px"><button class="ib sm" data-a="hy" data-v="-1" aria-label="Année précédente">${svg('left', 16)}</button><b style="font-size:16px">${UI.hy}</b><button class="ib sm" data-a="hy" data-v="1" aria-label="Année suivante">${svg('right', 16)}</button></span>` : ''}</div>
    <div class="chips"><button class="btn sm" data-a="csv">Exporter (CSV)</button><button class="btn sm" data-a="pdf">Imprimer / PDF</button></div></div>`;
  if (!R.length) { V.innerHTML = head + '<section class="card"><p class="empty">Aucun mois à afficher pour cette période.</p></section>'; return; }
  const n = R.length, I = sum(R, r => r.inc), O = sum(R, r => r.out), worst = R.reduce((a, r) => r.out > a.out ? r : a), L = R[n - 1];
  const tx = I > 0 ? (I - O) / I * 100 : 0;
  let cmp = '';
  if (UI.hp < 0) {
    const last = Math.max(...R.map(r => +r.k.slice(5)));
    const prev = Object.keys(S.months).filter(k => +k.slice(0, 4) === UI.hy - 1 && +k.slice(5) <= last && !isDraft(S.months[k]));
    if (prev.length) { const pO = sum(prev, k => calc(S.months[k], k).outMine), d = pct(O - pO, pO); cmp = `${d > 0 ? '+' : ''}${Math.round(d)} % vs ${UI.hy - 1} (mêmes mois)`; }
  }
  const ag = {}; R.forEach(r => Object.entries(catTotals(r.m)).forEach(([c, v]) => ag[c] = (ag[c] || 0) + v));
  const T = Object.values(ag).reduce((s, v) => s + v, 0) || 1, cl = Object.entries(ag).sort((a, b) => b[1] - a[1]).slice(0, 8);
  V.innerHTML = head + `
  <div class="tiles">
    <div class="kp"><span>Recettes moyennes</span><b>${eur0(I / n)}</b><small>par mois · ${eur0(I)} au total</small></div>
    <div class="kp"><span>Dépenses moyennes</span><b>${eur0(O / n)}</b><small>${cmp || 'par mois · ' + eur0(O) + ' au total'}</small></div>
    <div class="kp"><span>Taux d'épargne ${tip("taux d'épargne", "Taux d'épargne", "Part des recettes qui n'a pas été dépensée sur la période." + eq([['Recettes', eur0(I)], ['− Dépenses', eur0(O)]], ['= Non dépensé', eur0(I - O)], `${eur0(I - O)} ÷ ${eur0(I)} = ${tx.toFixed(1).replace('.', ',')} %`))}</span><b style="color:${tx >= 0 ? 'var(--ok)' : 'var(--bad)'}">${tx.toFixed(1).replace('.', ',')} %</b><small>sur ${n} mois</small></div>
    <div class="kp"><span>Mois le plus lourd</span><b>${MN[+worst.k.slice(5) - 1]}</b><small class="num">${eur0(worst.out)} dépensés</small></div>
    <div class="kp"><span>Solde fin de mois ${tip('solde fin', 'Solde fin de mois', `Fin de mois estimée de ${mlab(L.k)}, calculée comme sur l'accueil : solde au 1er + recettes − dépenses − épargne prévue.`, 'lf')}</span><b>${eur0(L.end)}</b><small>${mlab(L.k)}</small></div>
  </div>
  <section class="card"><div class="ch"><h2>Recettes et dépenses</h2></div><div class="cvh"><canvas id="c-hist"></canvas></div></section>
  <div class="grid2">
    <section class="card big" style="padding:12px 14px"><div class="tw"><table><thead><tr><th>Mois</th><th>Recettes</th><th>Dépenses</th><th>Épargné</th><th>Solde fin</th></tr></thead><tbody>
      ${R.slice().reverse().map(r => `<tr class="go" data-a="gom" data-v="${r.k}" tabindex="0"><td><b>${mlab(r.k)}</b>${r.cur ? ' <small class="note">en cours</small>' : ''}</td><td style="color:var(--ok)">${eur0(r.inc)}</td><td>${eur0(r.out)}</td><td>${r.tx == null ? '—' : Math.round(r.tx) + ' %'}</td><td>${eur0(r.end)}</td></tr>`).join('')}
    </tbody></table></div><p class="note" style="padding:8px 12px">Clique sur un mois pour l'ouvrir.</p></section>
    <section class="card small" style="display:flex;flex-direction:column;gap:12px"><h2>Où part l'argent</h2>
      ${cl.map(([c, v]) => `<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(c)}</span><span class="num"><b>${eur0(v)}</b> <span class="note">· ${eur0(v / n)}/mois</span></span></div><div class="bar"><i style="width:${v / T * 100}%;--c:${catInfo(c).col}"></i></div></div>`).join('') || '<p class="empty">Aucune dépense.</p>'}
    </section>
  </div>`;
  chart('c-hist', { type: 'bar', data: { labels: R.map(r => mshort(r.k)), datasets: [
    { type: 'line', label: 'Solde fin de mois', data: R.map(r => Math.round(r.end)), borderColor: '#4338CA', backgroundColor: '#4338CA', tension: .3, borderWidth: 2.5, pointRadius: 3, order: 0 },
    { label: 'Recettes', data: R.map(r => r.inc), backgroundColor: '#10B981', borderRadius: 6, order: 1 },
    { label: 'Dépenses', data: R.map(r => r.out), backgroundColor: '#818CF8', borderRadius: 6, order: 1 }] },
    options: chartOpts({ onClick: (e, els) => { if (els.length) goMonth(R[els[0].index].k); } }) });
}
function goMonth(k) { cur = keyDate(k); go('mouvements'); }
function exportCSV() {
  const R = hRows(), f = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const L = [['Mois','Recettes','Dépenses','Flux net',"Taux d'épargne %",'Épargne prévue','Solde début','Solde fin'], ...R.map(r => [r.k, f(r.inc), f(r.out), f(r.net), r.tx == null ? '' : f(r.tx), f(r.sav), f(r.start), f(r.end)])];
  download('historique_budget_' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + L.map(x => x.join(';')).join('\n'), 'text/csv;charset=utf-8');
  toast('CSV exporté (' + R.length + ' mois)');
}
function download(name, content, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- PARAMÈTRES ---------- */
function vParametres() {
  if (SIMPLE() && !UI.allSet) return vSimpleParametres();
  const V = $('v-parametres'), T = S.templates, k = ck();
  const del = '<button class="x" data-a="tdel" title="Supprimer" aria-label="Supprimer">' + svg('trash', 17) + '</button>';
  const catSel = (sel) => { const c = S.categories.includes(sel) || !sel ? S.categories : [sel, ...S.categories]; return c.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join(''); };
  const PT = [['compte', 'Ce compte'], ['fixes', 'Charges fixes & budgets'], ['alertes', 'Alertes'], ['profil', 'Profil & app'], ['donnees', 'Sauvegardes']];
  const pt = PT.some(x => x[0] === UI.pt) ? UI.pt : 'compte';
  const blocks = {
    compte: () => `<div class="grid2">
    ${accountSettingsHTML()}
  <section class="card" style="flex:1 1 300px;align-self:flex-start;display:flex;flex-direction:column;gap:12px"><h2>Catégories</h2>
    <div class="chips">${S.categories.map((c, i) => `<span class="chip cat on" style="--c:${catInfo(c).col}"><i></i>${esc(c)}<button class="x" style="width:24px;height:24px" data-a="delcat" data-i="${i}" aria-label="Supprimer ${esc(c)}">${svg('x', 14)}</button></span>`).join('')}</div>
    <div style="display:flex;gap:8px;max-width:420px"><input class="in" id="newcat" placeholder="Nouvelle catégorie…" aria-label="Nouvelle catégorie"><button class="btn p" data-a="addcat">Ajouter</button></div>
  </section>
  </div>`,
    fixes: () => `  <p class="note">Les éléments récurrents ci-dessous sont recopiés chaque mois. Une modification s'applique à ${mlab(k)} et aux mois suivants déjà ouverts ; ce qui est déjà payé ou reçu ne change pas.</p>
  <section class="card"><div class="ch"><h2>Recettes fixes</h2><button class="btn sm" data-a="tadd" data-t="incomes">${svg('plus', 16)} Recette fixe</button></div>
    <div class="tw"><table class="tpl"><thead><tr><th>Jour</th><th style="width:55%">Libellé</th><th>Montant</th><th></th></tr></thead><tbody>
    ${T.incomes.map(t => `<tr data-tpl="incomes" data-id="${t.tmplId}"><td><input class="d" data-f="date" inputmode="numeric" placeholder="JJ" value="${esc(t.date)}" aria-label="Jour"></td><td><input data-f="name" value="${esc(t.name)}" aria-label="Libellé">${t.xfer?.kind === 'acc' ? `<span class="xtag">${svg('swap', 12)} Virement auto ${(ACC[t.xfer.acc]?.name || t.xfer.accName) ? (T.incomes.includes(t) ? 'depuis' : 'vers') + ' « ' + esc(ACC[t.xfer.acc]?.name || t.xfer.accName) + ' »' : ''}</span>` : ''}</td><td><input type="number" step="0.01" min="0" data-f="amount" value="${num(t.amount)}" aria-label="Montant"></td><td>${del}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucune recette fixe (salaire, aides…).</td></tr>'}
    </tbody></table></div></section>
  <section class="card"><div class="ch"><h2>Charges fixes</h2><button class="btn sm" data-a="tadd" data-t="expenses">${svg('plus', 16)} Charge fixe</button></div>
    <div class="tw"><table class="tpl" style="min-width:760px"><thead><tr><th>Jour</th><th></th><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Partage</th><th>Site web (logo)</th><th></th></tr></thead><tbody>
    ${T.expenses.map(t => `<tr data-tpl="expenses" data-id="${t.tmplId}"><td><input class="d" data-f="date" inputmode="numeric" placeholder="JJ" value="${esc(t.date)}" aria-label="Jour"></td><td>${ico(t, 'expenses', 'sm')}</td><td><input data-f="name" value="${esc(t.name)}" aria-label="Libellé">${t.xfer?.kind === 'acc' ? `<span class="xtag">${svg('swap', 12)} Virement auto ${(ACC[t.xfer.acc]?.name || t.xfer.accName) ? (T.incomes.includes(t) ? 'depuis' : 'vers') + ' « ' + esc(ACC[t.xfer.acc]?.name || t.xfer.accName) + ' »' : ''}</span>` : ''}${shfixTag(t.tmplId)}</td><td><select data-f="cat" aria-label="Catégorie">${catSel(t.cat)}</select></td><td><input type="number" step="0.01" min="0" data-f="amount" value="${num(t.amount)}" aria-label="Montant"></td><td><button class="half ${t.isDivided ? 'on' : ''}" data-a="thalf" title="Ne compter que ma moitié" aria-pressed="${!!t.isDivided}">½</button>${isSavAcc() ? '' : `<button class="half" data-a="tshare" title="Partager avec une personne connectée" aria-label="Partager ${esc(t.name)} avec une personne">👥</button>`}</td><td><input data-f="site" value="${esc(t.site || '')}" placeholder="ex. monfournisseur.fr" aria-label="Site web pour le logo"></td><td>${del}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucune charge fixe.</td></tr>'}
    </tbody></table></div></section>
  <section class="card"><div class="ch"><h2>Budgets mensuels</h2><button class="btn sm" data-a="tadd" data-t="budgets">${svg('plus', 16)} Budget</button></div>
    <div class="tw"><table class="tpl"><thead><tr><th>Catégorie</th><th>Montant</th><th></th></tr></thead><tbody>
    ${T.budgets.map(t => `<tr data-tpl="budgets" data-id="${t.tmplId}"><td><select data-f="cat" aria-label="Catégorie">${catSel(t.cat)}</select></td><td><input type="number" step="0.01" min="0" data-f="amount" value="${num(t.amount)}" aria-label="Montant"></td><td>${del}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Aucun budget.</td></tr>'}
    </tbody></table></div></section>
`,
    alertes: () => `  <section class="card" style="display:flex;flex-direction:column;gap:10px"><div class="ch"><h2>Alertes</h2><button class="btn sm" data-a="al-new">${svg('plus', 16)} Nouvelle alerte</button></div>
    ${AL().custom.map(a => `<div class="row" style="padding:6px 4px"><button class="rowb" data-a="al-edit" data-id="${a.id}"><span class="ico" style="--c:${a.on === false ? '#94A3B8' : '#F97316'}">${svg(ALT[a.t]?.ic || 'bell')}</span><span class="rt"><span class="rn"${a.on === false ? ' style="color:var(--mute);text-decoration:line-through"' : ''}>${esc(altLabel(a))}</span><span class="rs">${esc(ALT[a.t]?.l || '')}</span></span></button><label class="chk" style="margin-left:8px" title="Activer / couper"><input type="checkbox" data-alon="${a.id}" ${a.on === false ? '' : 'checked'}></label></div>`).join('') || '<p class="note">Crée tes propres alertes : limite par catégorie, solde trop bas, grosse dépense, salaire pas arrivé, rappel à une date…</p>'}
    <p class="note" style="font-size:12px">Elles s'affichent sur l'accueil, dans la cloche et en notification du navigateur (si activée). Elles valent pour ce compte${isShared() ? ' et ses autres membres' : ''}.</p>
    <label class="fl" style="flex-direction:row;align-items:center;gap:10px;font-size:14px;color:var(--ink2)">M'alerter si la fin de mois estimée passe sous <input class="in" type="number" data-al="thr" value="${num(AL().thr)}" style="width:110px;text-align:right"> €</label>
    <label class="fl" style="flex-direction:row;align-items:center;gap:10px;font-size:14px;color:var(--ink2)">M'alerter si une catégorie dépasse sa moyenne de <input class="in" type="number" data-al="pct" value="${num(AL().pct)}" style="width:90px;text-align:right"> %</label>
  </section>`,
    profil: () => `<div class="grid2">
    <section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:10px"><h2>Mon profil</h2>
      <p class="note">${esc(currentUser?.email || '')} · ${currentUser?.emailVerified ? '<span style="color:var(--ok);font-weight:700">email confirmé</span>' : '<span style="color:var(--warn);font-weight:700">email non confirmé</span>'}</p>
      ${currentUser?.emailVerified ? '' : '<button class="btn" data-a="verify-send">Recevoir l\'email de confirmation</button>'}
      <label class="fl">Compte de réception des virements<select class="in" data-recv="1">${accIds.filter(id => ACC[id]).map(id => `<option value="${id}" ${recvAccount() === id ? 'selected' : ''}>${esc(ACC[id].name)}</option>`).join('')}</select><small>Quand la personne ne choisit pas, le virement arrive ici.</small></label>
      <div class="fl">Comptes proposés à ceux qui te font un virement<div class="chips">${accIds.filter(id => ACC[id]).map(id => `<label class="chip${(U.recvHide || []).includes(id) ? '' : ' on'}" style="cursor:pointer"><input type="checkbox" data-rvis="${id}" ${(U.recvHide || []).includes(id) ? '' : 'checked'} style="display:none">${esc(ACC[id].name)}</label>`).join('')}</div><small>Ils voient seulement le nom et la banque de ces comptes, jamais les soldes ni les mouvements.</small></div>
      <button class="btn" data-a="pwd">Changer de mot de passe</button>
      <button class="btn" data-a="logout">${svg('out', 18)} Se déconnecter</button>
      <button class="btn danger" data-a="delacc">Supprimer mon profil</button>
    </section>
    ${pushCardHTML()}
    ${installHTML()}
    ${linksCardHTML()}
  </div>`,
    donnees: () => `    <section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>Données & sauvegardes</h2>
      <p class="note">Une copie automatique chaque jour à la connexion, et avant chaque import, réinitialisation ou restauration (40 dernières gardées).</p>
      <div class="chips"><button class="btn sm" data-a="bk-now">Sauvegarder maintenant</button><button class="btn sm" data-a="bk-list">Voir / restaurer</button></div>
      <div id="bk-list"></div>
      <div class="chips"><button class="btn sm" data-a="export">Exporter (JSON)</button><button class="btn sm" data-a="import">Importer un JSON</button><button class="btn sm danger" data-a="reset">Tout réinitialiser</button></div>
    </section>
`
  };
  V.innerHTML = `<div class="ptabs" role="tablist">${PT.map(([v, l]) => `<button class="chip${v === pt ? ' on' : ''}" role="tab" aria-selected="${v === pt}" data-a="ptab" data-v="${v}">${l}</button>`).join('')}</div>
  ${blocks[pt]()}`;
}
function listBackups() {
  const box = $('bk-list'); if (!box) return; box.innerHTML = '<p class="note">Chargement…</p>';
  // sauvegardes de ce compte + anciennes sauvegardes (avant les comptes multiples), restaurables ici
  Promise.all([bkCol().orderBy('createdAt', 'desc').limit(BK_MAX).get(), userDoc().collection('backups').orderBy('createdAt', 'desc').limit(BK_MAX).get().catch(() => ({ docs: [] }))]).then(([q1, q2]) => {
    bkCache = {};
    const docs = q1.docs.concat(q2.docs.map(d => Object.assign(d, { old: true })));
    box.innerHTML = docs.map(d => {
      const v = d.data(), bid = (d.old ? 'old_' : '') + d.id; bkCache[bid] = v.budgetData; if (d.old) v.kind = (v.kind || '') + ' · ancienne version';
      let info = ''; try { const j = JSON.parse(v.budgetData); info = Object.keys(j.months || {}).length + ' mois · ' + (j.templates?.expenses || []).length + ' charges fixes'; } catch (e) { info = 'illisible'; }
      const dt = new Date(v.createdAt).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<div class="row" style="padding:6px 4px"><span class="rt"><span class="rn">${esc(dt)} <span class="pill" style="min-height:0;padding:2px 8px">${esc(v.kind || '')}</span></span><span class="rs">${esc(info)}</span></span>
        <button class="x" data-a="bk-dl" data-id="${esc(bid)}" title="Télécharger" aria-label="Télécharger">⬇</button><button class="btn sm" data-a="bk-res" data-id="${esc(bid)}">Restaurer</button></div>`;
    }).join('') || '<p class="note">Aucune sauvegarde pour l\'instant.</p>';
  }).catch(e => { box.innerHTML = '<p class="note" style="color:var(--bad)">Impossible de lister les sauvegardes (' + esc(e.code || '') + '). Vérifie les règles Firestore.</p>'; });
}
function restoreBackup(id) {
  const data = bkCache[id]; if (!data) return;
  if (!confirm("Remplacer tes données actuelles par cette sauvegarde ?\nL'état actuel sera sauvegardé avant, au cas où.")) return;
  backupNow('avant restauration');
  try { S = normalize(JSON.parse(data)); } catch (e) { return toast('Sauvegarde illisible'); }
  undoSnap = null; allowDeletes = true; save(); flush(); render(); toast('✅ Sauvegarde restaurée'); listBackups();
}

/* ============================== 9. FICHE D'ÉDITION & DIALOGUES ============================== */
let P = null;   // brouillon du mouvement en cours d'édition
function openPanel(type, id, opt = {}) {
  const m = month(), k = ck(), x = id ? m[type].find(e => e.id === id) : null;
  if (id && !x) return;
  const isCur = k === nowK();
  P = { type, id, isNew: !x, repeat: opt.repeat || !!(x && x.isFixed), future: true, addCat: false,
    d: x ? JSON.parse(JSON.stringify(x)) : { name: '', amount: '', cat: opt.cat || S.categories[0] || 'Autre', date: opt.day != null ? String(opt.day) : isCur ? String(today()) : '',
      status: opt.repeat ? (type === 'incomes' ? 'En attente' : 'Prévu') : (type === 'incomes' ? 'Reçu' : 'Payé'), isDivided: false } };
  P.icon = P.d.img ? 'img' : P.d.site ? 'site' : 'cat'; P.comp = x?.cpdebt || null; P.cm = cmMode(x); P.cmT = false; if (!x) cmApplyDef();
  if (x && x.share != null) { const pt = Math.round((num(x.amount) - num(x.share)) * 100) / 100; if (Math.abs(pt - num(x.amount) / 2) > 0.006) P.d.cmPart = fmtIn(pt); }
  if (x?.newdebt) { const nd = findDebt(x.newdebt) || (PDEBTS.find(z => z.id === x.newdebt) && { d: PDEBTS.find(z => z.id === x.newdebt) }); if (nd) { P.d.cmWho = sideKey(borrowerOf(nd.d)); if (nd.d.borrower?.kind === 'text') P.d.cmName = nd.d.borrower.who; } }
  if (!x && SIMPLE() && type === 'expenses' && S.categories.includes('Autre')) P.d.cat = 'Autre';
  if (!x && isSavAcc() && !opt.keepType) { P.type = type = 'incomes'; P.d.status = opt.repeat ? 'En attente' : 'Reçu'; }
  let lc = 'EUR'; try { lc = localStorage.getItem('lastCur') || 'EUR'; } catch (e) {}
  P.cur = x ? (x.fx?.cur || 'EUR') : (isSavAcc() ? 'EUR' : lc); if (x?.fx) P.d.amount = x.fx.amt;
  P.d.amount = fmtIn(P.d.amount);
  paintPanel(); if (P.cur !== 'EUR' || !FX) fxLoad().then(fxPaint);
  $('scrim').classList.add('on'); $('panel').classList.add('on'); $('panel').setAttribute('aria-hidden', 'false');
  setTimeout(() => { if (P) (P.isNew ? $('pn-a') : $('pn-n'))?.focus(); }, 230);
}
function closePanel(silent) {
  P = null; $('scrim').classList.remove('on'); $('panel').classList.remove('on'); $('panel').setAttribute('aria-hidden', 'true');
  if (!silent) setTimeout(() => { if (!P) $('panel').innerHTML = ''; }, 250);
}
function paintPanel() {
  if (!P) return;
  if (P.type === 'xfer') return paintXfer();
  if (SIMPLE() && !P.full && !P.d.xfer) return paintSimplePanel();
  const sav = isSavAcc(), d = P.d, ex = P.type === 'expenses' && !sav, fixed = !P.isNew && P.id && month()[P.type].find(e => e.id === P.id)?.isFixed;
  const names = [...new Set(Object.values(S.months).flatMap(m => m[P.type].map(e => e.name)).filter(Boolean))].slice(-80);
  const paid = isPaid(d, P.type);
  $('panel').innerHTML = `
  <div class="pbody">
    <div class="dh"><h2 id="pn-title">${P.isNew ? 'Nouveau mouvement' : 'Modifier'}</h2><button class="ib sm" data-p="close" aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    ${P.isNew ? typeSeg() : ''}
    ${d.xfer ? `<div class="fixinfo" style="background:color-mix(in srgb,#0EA5E9 14%,var(--card));color:var(--ink)"><b>${svg('swap', 16)} ${esc(xferLabel(d, P.type))}</b><span style="font-size:12px">${d.xfer.kind === 'acc' && d.xfer.id ? 'Montant, date et suppression sont répercutés sur l\'autre compte.' : d.xfer.kind === 'person' && P.type === 'expenses' ? (xfStatus(d.xfer.id) === 'received' ? 'Déjà reçu : une modification ne change que ton côté.' : 'Pas encore reçu : tes modifications lui seront transmises.') : d.xfer.kind === 'person' ? 'Reçu de ' + esc(d.xfer.from || '') : ''}</span>${d.xfer.kind === 'person' && P.type === 'incomes' && !P.isNew && accIds.filter(id => id !== active && ACC[id]).length ? `<span style="font-size:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px">Déplacer vers ${accIds.filter(id => id !== active && ACC[id]).map(id => `<button class="chip" data-p="xmove" data-v="${id}">${accBadge(ACC[id], 14)} ${esc(ACC[id].name)}</button>`).join('')}</span>` : ''}</div>` : ''}
    <label class="amt"><input id="pn-a" inputmode="decimal" placeholder="0,00" aria-label="Montant" value="${esc(d.amount)}" data-pf="amount"><span>${P.cur && P.cur !== 'EUR' ? esc(P.cur) : '€'}</span></label>
    ${fxSelectHTML()}
    ${ex && (d.isDivided || (!P.isNew && !d.xfer)) ? `<div style="display:flex;justify-content:center;gap:8px;margin-top:-8px">${d.isDivided ? `<button class="tog half on" data-p="half" aria-pressed="true" title="Ancien réglage : la moitié seulement compte dans le solde">½ Partagé (ancien) · ma part ${eur(parseAmt(d.amount) / 2)}</button>` : ''}${!P.isNew && !d.xfer ? `<button class="tog" data-p="split">${d.split && grpParts(d.split).length ? '👥 Partagée · voir' : '👥 À plusieurs personnes'}</button>` : ''}</div>` : ''}
    ${ex && !d.xfer ? compPanelHTML() : ''}
    <label class="fl">Libellé<input class="in" id="pn-n" list="pn-dl" autocomplete="off" value="${esc(d.name)}" data-pf="name" placeholder="${ex ? 'ex. Courses' : 'ex. Salaire'}"><datalist id="pn-dl">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
    ${ex ? `<div class="fl">Catégorie<div class="chips">${(d.xfer ? ['Virement', ...S.categories.filter(c => c !== 'Virement')] : S.categories).map(c => `<button class="chip cat${c === d.cat ? ' on' : ''}" style="--c:${catInfo(c).col}" data-p="cat" data-v="${esc(c)}"><i></i>${esc(c)}</button>`).join('')}<button class="chip" data-p="addcat">+ Nouvelle</button></div>
      ${P.addCat ? `<span style="display:flex;gap:8px"><input class="in" id="pn-nc" placeholder="Nom de la catégorie"><button class="btn" data-p="addcat-ok">Ajouter</button></span>` : ''}</div>` : ''}
    ${sav ? '' : `<div class="fl">Icône
      <div class="seg" role="group" aria-label="Icône"><button class="${P.icon === 'cat' ? 'on' : ''}" data-p="icon" data-v="cat">${ex ? 'Catégorie' : 'Par défaut'}</button><button class="${P.icon === 'site' ? 'on' : ''}" data-p="icon" data-v="site">Logo du site</button><button class="${P.icon === 'img' ? 'on' : ''}" data-p="icon" data-v="img">Mon image</button></div>
      ${P.icon === 'site' ? `<span style="display:flex;gap:10px;align-items:center">${ico({ cat: d.cat, site: cleanSite(d.site) }, P.type)}<input class="in" id="pn-site" value="${esc(d.site || '')}" data-pf="site" placeholder="Site web, ex. monfournisseur.fr" style="font-weight:500"></span><small>L'icône est fournie par le site lui-même (service d'icônes de Google).</small>` : ''}
      ${P.icon === 'img' ? `<span style="display:flex;gap:10px;align-items:center">${ico({ cat: d.cat, img: d.img }, P.type)}<button class="btn sm" data-p="pickimg">${d.img ? 'Changer l\'image' : 'Choisir une image'}</button></span>` : ''}
    </div>`}
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <label class="fl">Jour du mois<input class="in" id="pn-d" type="number" min="1" max="31" inputmode="numeric" value="${esc(d.date)}" data-pf="date" placeholder="sans date"></label>
      <div class="fl">Statut<button class="tog${paid ? ' ok' : ''}" data-p="status">${paid ? '✓ ' + (ex ? 'Payé' : 'Reçu') : (ex ? '○ À payer' : '○ En attente')}</button></div>
    </div>
    ${fixed ? `<div class="fixinfo"><b>Élément récurrent (chaque mois)</b>
        <label class="chk" style="min-height:0;color:inherit"><input type="checkbox" data-p="future" ${P.future ? 'checked' : ''}>Appliquer aussi aux mois suivants</label>
        <button class="lnk" data-p="stop" style="align-self:flex-start;color:inherit;text-decoration:underline">Arrêter la récurrence à partir du mois prochain</button>${ex && !isSavAcc() && d.tmplId && S.templates.expenses.some(t => t.tmplId === d.tmplId) ? `<button class="lnk" data-p="shfix" style="align-self:flex-start;color:inherit;text-decoration:underline">👥 Partager cette charge fixe avec une personne${shfixOf(active, d.tmplId).length ? ' (' + shfixOf(active, d.tmplId).map(s => shortName(s.toEmail) + (s.status === 'accepted' ? ' ✓' : ' ⏳')).join(', ') + ')' : ''}</button>` : ''}</div>`
      : `<label class="chk"><input type="checkbox" data-p="repeat" ${P.repeat ? 'checked' : ''}>Répéter chaque mois (${sav ? (P.type === 'incomes' ? 'versement automatique' : 'retrait automatique') : ex ? 'charge fixe' : 'recette fixe'})</label>`}
  </div>
  <div class="pfoot">
    <button class="btn p" style="flex:1" data-p="save">Enregistrer</button>
    ${!P.isNew ? `<button class="ib sm" style="width:44px;height:44px" data-p="dup" aria-label="Dupliquer" title="Dupliquer">${svg('copy', 18)}</button><button class="ib sm" style="width:44px;height:44px;color:var(--bad)" data-p="del" aria-label="Supprimer" title="Supprimer${fixed ? ' (ce mois-ci seulement)' : ''}">${svg('trash', 18)}</button>` : ''}
  </div>`;
}
function panelClick(b) {
  const a = b.dataset.p, d = P.d;
  switch (a) {
    case 'close': return closePanel();
    case 'shfix': { const tid = d.tmplId; closePanel(); return shfixDialog(tid); }
    case 'type': if (b.dataset.v === 'xfer') { P.type = 'xfer'; P.xk = P.xk || 'acc'; d.cat = 'Virement'; P.icon = d.site ? 'site' : d.img ? 'img' : 'cat'; break; } P.type = b.dataset.v; d.status = P.type === 'incomes' ? (d.status === 'Payé' ? 'Reçu' : 'En attente') : (d.status === 'Reçu' ? 'Payé' : 'Prévu'); break;
    case 'half': d.isDivided = !d.isDivided; if (d.isDivided) { P.comp = null; P.cm = 'none'; } break;
    case 'comp': P.cmT = true; P.comp = b.dataset.v; d.isDivided = false; break;
    case 'cmforget': cmRemember(d.cat, { mode: 'none' }); P.cmDefOn = false; toast('Plus de choix habituel pour ' + d.cat); break;
    case 'cm': P.cmT = true; P.cmDefOn = false; P.cm = b.dataset.v; if (P.cm === 'debt' && !P.comp) { const C = compCands(); if (C.length === 1) P.comp = C[0].e.d.id; } if (P.cm !== 'none') d.isDivided = false; break;
    case 'split': { const g = d.split && grpParts(d.split).length ? d.split : null, pre = { name: d.name, amount: parseAmt(d.amount), expId: P.id, k: ck(), acc: active }; closePanel(); return setTimeout(() => g ? groupView(g) : splitDialog(pre), 260); }
    case 'cat': d.cat = b.dataset.v; cmApplyDef(); break;
    case 'addcat': P.addCat = !P.addCat; paintPanel(); return $('pn-nc')?.focus();
    case 'addcat-ok': { const v = $('pn-nc').value.trim(); if (!v) return; if (!S.categories.includes(v)) S.categories.push(v); d.cat = v; P.addCat = false; break; }
    case 'icon': P.icon = b.dataset.v; break;
    case 'pickimg': return $('imgfile').click();
    case 'status': d.status = P.type === 'incomes' ? (d.status === 'Reçu' ? 'En attente' : 'Reçu') : (d.status === 'Payé' ? 'Prévu' : 'Payé'); break;
    case 'repeat': P.repeat = b.checked; return;
    case 'future': P.future = b.checked; return;
    case 'save': return P.type === 'xfer' ? saveXfer() : savePanel();
    case 'spaid': d.status = b.dataset.v === '1' ? (P.type === 'incomes' ? 'Reçu' : 'Payé') : (P.type === 'incomes' ? 'En attente' : 'Prévu'); break;
    case 'full': P.full = true; break;
    case 'xk': P.xk = b.dataset.v; if (P.xk === 'person') Object.keys(DIR_T).forEach(e => delete DIR_T[e]); break;
    case 'dest': P.dest = b.dataset.v; break;
    case 'sugg': d.email = b.dataset.v; P.toAccPicked = false; xfLookup(d.email); break;
    case 'linkreq': linkRequest(d.email).then(() => paintDest()); return;
    case 'tacc': P.toAcc = b.dataset.v; P.toAccPicked = true; break;
    case 'xmove': return xferMove(b.dataset.v);
    case 'dup': { const t = P.type, src = month()[t].find(e => e.id === P.id); mutate(() => { const c = JSON.parse(JSON.stringify(src)); Object.assign(c, { id: uid(), isFixed: false, status: t === 'incomes' ? 'En attente' : 'Prévu' }); delete c.tmplId; const arr = month()[t]; arr.splice(arr.indexOf(src) + 1, 0, c); }, 'Dupliqué'); return closePanel(); }
    case 'del': { const t = P.type, id = P.id, xf = month()[t].find(e => e.id === id)?.xfer, x0 = month()[t].find(e => e.id === id), k0 = ck();
      if (x0?.cpdebt || x0?.newdebt) setTimeout(() => { if (x0.cpdebt) detachComp(id, k0, x0.cpdebt, x0.cpid); if (x0.newdebt) detachNew(id, k0, x0.newdebt); }, 0); mutate(() => { const m = month(); m[t] = m[t].filter(e => e.id !== id); }, 'Supprimé'); xferPropagate(xf, null); if (xf?.kind === 'person' && xf.id) { (U.xfHide = U.xfHide || []).push(xf.id); saveUser(); } return closePanel(); }
    case 'stop': { const t = P.type, id = P.id, x0 = month()[t].find(e => e.id === id), tp0 = x0 && S.templates[t].find(z => z.tmplId === x0.tmplId), cp = tp0 && JSON.parse(JSON.stringify(tp0));
      if (cp?.xfer) setTimeout(() => xferTplSync(t, cp, 'stop'), 0);
      mutate(() => { const x = month()[t].find(e => e.id === id); tplDel(t, x.tmplId, shiftK(ck(), 1)); x.isFixed = false; delete x.tmplId; }, 'Récurrence arrêtée'); return closePanel(); }
  }
  paintPanel();
}
function savePanel() {
  const d = P.d, t = P.type, cur = P.cur || 'EUR', raw = parseAmt(d.amount);
  if (!(raw > 0)) { $('pn-a').focus(); return toast('Saisis un montant'); }
  const fr = fxRate(cur); if (!fr) return toast('Taux de change indisponible : vérifie ta connexion');
  if (P.isNew && !isSavAcc()) try { localStorage.setItem('lastCur', cur); } catch (e) {}
  const amt = cur === 'EUR' ? raw : Math.round(raw / fr * 100) / 100, fx = cur === 'EUR' ? null : { cur, amt: Math.round(raw * 100) / 100, rate: Math.round(1 / fr * 1e6) / 1e6, date: FX.date };
  const k = ck(), isNew = P.isNew, id = P.id, repeat = P.repeat, future = P.future, icon = P.icon, xf = d.xfer, cmo = t === 'expenses' && !isSavAcc() && !d.xfer ? { mode: P.cm || 'none', comp: P.comp, part: d.cmPart, who: d.cmWho, name: d.cmName } : null; let saved = null;
  if (xf && !isNew) setTimeout(() => xferPropagate(xf, { amount: Math.round(amt * 100) / 100, date: day(d.date), label: d.name.trim(), paid: isPaid(d, t) }), 0);
  const x0 = !isNew && month(k)[t].find(e => e.id === id), tp0 = x0?.isFixed && future && x0.xfer && S.templates[t].find(z => z.tmplId === x0.tmplId), old = tp0 && { name: tp0.name, amount: tp0.amount };
  if (tp0) setTimeout(() => xferTplSync(t, tp0, 'upd', old), 0);
  mutate(() => {
    const m = month(k);
    const clean = { name: d.name.trim() || (t === 'incomes' ? 'Recette' : d.cat), amount: Math.round(amt * 100) / 100, date: day(d.date), status: d.status };
    if (t === 'expenses') Object.assign(clean, isSavAcc() ? { cat: 'Autre', isDivided: false } : { cat: d.cat, isDivided: !!d.isDivided });
    const setIcon = x => { delete x.site; delete x.img; if (icon === 'site' && cleanSite(d.site)) x.site = cleanSite(d.site); if (icon === 'img' && d.img) x.img = d.img; };
    if (fx) clean.fx = fx;
    let x;
    if (isNew) { x = { id: uid(), ...clean, isFixed: false }; if (isShared()) x.by = currentUser.email; setIcon(x); m[t].unshift(x); }
    else {
      x = m[t].find(e => e.id === id); Object.assign(x, clean); if (!fx) delete x.fx; setIcon(x);
      if (x.isFixed && future) {
        const tp = S.templates[t].find(z => z.tmplId === x.tmplId);
        if (tp) { const F = tplFields(t); F.forEach(f => { if (x[f] === undefined || x[f] === '') delete tp[f]; else tp[f] = x[f]; }); syncTpl(t, tp, F, shiftK(k, 1)); }
      }
    }
    if (!x.isFixed && repeat) { const tp = tplFrom(t, x); x.isFixed = true; x.tmplId = tp.tmplId; tplAdd(t, tp, shiftK(k, 1)); }
    if (cmo && cmo.mode !== 'none') x.isDivided = false; saved = x;
  }, (isNew ? (isSavAcc() ? (t === 'incomes' ? 'Versement : ' : 'Retrait : ') : t === 'incomes' ? 'Recette ajoutée : ' : 'Dépense ajoutée : ') : 'Modifié : ') + (d.name.trim() || (t === 'incomes' ? 'Recette' : d.cat)) + ' · ' + eur(t === 'expenses' && d.isDivided ? amt / 2 : amt));
  if (saved && cmo && isNew && (P.cmT || cmo.mode !== 'none')) cmRemember(saved.cat, cmo);
  if (saved && cmo && (cmo.mode !== 'none' || saved.cpdebt || saved.newdebt || saved.share != null)) { const sv = { id: saved.id, prev: { cpdebt: saved.cpdebt, cpid: saved.cpid, newdebt: saved.newdebt } }; setTimeout(() => compPanelSave(sv.id, k, cmo, sv.prev), 0); }
  closePanel();
}
// Image perso → redimensionnée en 96 px (stockée avec les données)
function readImage(f) {
  if (!f || !P) return;
  const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => {
    const s = 96, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d'), z = Math.min(im.width, im.height);
    g.drawImage(im, (im.width - z) / 2, (im.height - z) / 2, z, z, 0, 0, s, s);
    P.d.img = cv.toDataURL('image/png'); P.icon = 'img'; paintPanel();
  }; im.src = r.result; };
  r.readAsDataURL(f); $('imgfile').value = '';
}

/* ---------- Dialogue générique ---------- */
function formDialog({ title, intro, fields, ok = 'Enregistrer', onSave, onDelete, delLabel = 'Supprimer' }) {
  const d = $('dlg'); d.onclick = null;
  const fh = f => f.type === 'select'
    ? `<label class="fl">${f.label}<select class="in" id="f_${f.id}">${f.options.map(o => `<option ${o === f.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${f.hint ? `<small>${f.hint}</small>` : ''}</label>`
    : `<label class="fl">${f.label}<input class="in" id="f_${f.id}" ${f.type === 'num' ? 'inputmode="decimal"' : ''} value="${esc(f.type === 'num' ? fmtIn(f.value) : f.value ?? '')}" placeholder="${esc(f.ph || '')}">${f.hint ? `<small>${f.hint}</small>` : ''}</label>`;
  d.innerHTML = `<form class="dw"><div class="dh"><h2>${title}</h2><button type="button" class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    ${intro ? `<p class="note">${intro}</p>` : ''}${fields.map(fh).join('')}
    <div class="dact">${onDelete ? `<button type="button" class="btn danger" data-del>${delLabel}</button>` : ''}<button class="btn p">${ok}</button></div></form>`;
  d.querySelector('[data-x]').onclick = () => d.close();
  if (onDelete) d.querySelector('[data-del]').onclick = () => { d.close(); onDelete(); };
  d.querySelector('form').onsubmit = e => {
    e.preventDefault(); const v = {};
    fields.forEach(f => { const el = $('f_' + f.id); v[f.id] = f.type === 'num' ? (el.value.trim() === '' ? null : parseAmt(el.value)) : el.value.trim(); });
    if (onSave(v) !== false) d.close();
  };
  d.showModal(); d.querySelector('input,select')?.focus();
}
function bankDialog() {
  const k = ck(), m = month(k), c = calc(m, k);
  if (SIMPLE() && k === nowK()) return formDialog({ title: 'Combien as-tu sur ton compte ?', intro: 'Regarde le solde affiché par ta banque aujourd\'hui et recopie-le ici. L\'application se recale dessus.',
    fields: [{ id: 'b', label: 'Solde aujourd\'hui', type: 'num', value: Math.round(c.current * 100) / 100, ph: '0,00' }],
    onSave: v => { if (v.b == null) { toast('Indique un montant'); return false; } mutate(() => { month(k).bankBalance = Math.round((v.b - (c.incIn - c.outPaid)) * 100) / 100; }, 'Solde mis à jour : ' + eur(v.b)); } });
  formDialog({ title: 'Solde au 1er ' + MN[cur.getMonth()].toLowerCase(), intro: 'Le solde de ton compte bancaire au 1er du mois. Laisse vide pour reprendre le calcul automatique à partir du mois précédent' + (c.bankSet ? '' : ` (actuellement ${eur(c.init)})`) + '.',
    fields: [{ id: 'b', label: 'Solde réel', type: 'num', value: m.bankBalance, ph: eur(chainBalanceAuto(k)) }],
    onSave: v => mutate(() => { month(k).bankBalance = v.b; }, v.b == null ? 'Solde calculé automatiquement' : 'Solde du 1er enregistré') });
}
function chainBalanceAuto(k) { const m = month(k), s = m.bankBalance; m.bankBalance = null; const r = chainBalance(k); m.bankBalance = s; return r; }
function savingDialog() {
  const k = ck(), m = month(k);
  formDialog({ title: 'Épargne prévue · ' + mlab(k), intro: 'Montant que tu mets de côté ce mois-ci. Il est retiré du reste à vivre et de la fin de mois estimée.',
    fields: [{ id: 's', label: 'Montant', type: 'num', value: m.savingGoal, ph: '0,00' }],
    onSave: v => mutate(() => { month(k).savingGoal = v.s; }, 'Épargne prévue mise à jour') });
}
function budgetDialog(id, cat) {
  const k = ck(), m = month(k), b = id ? m.budgets.find(x => x.id === id) : null;
  formDialog({ title: b ? 'Budget ' + b.cat : 'Nouveau budget',
    fields: [{ id: 'cat', label: 'Catégorie', type: 'select', options: S.categories, value: b ? b.cat : cat || S.categories[0] }, { id: 'amount', label: 'Montant par mois', type: 'num', value: b ? b.amount : '' },
      { id: 'all', label: 'Appliquer', type: 'select', options: ['Ce mois et les suivants', 'Ce mois seulement'], value: 'Ce mois et les suivants' }],
    onSave: v => {
      if (!(v.amount > 0)) { toast('Saisis un montant'); return false; }
      mutate(() => {
        const mm = month(k), all = v.all.startsWith('Ce mois et');
        if (b) { const x = mm.budgets.find(y => y.id === id); x.cat = v.cat; x.amount = v.amount;
          const tp = S.templates.budgets.find(t => t.tmplId === x.tmplId);
          if (all && tp) { tp.cat = v.cat; tp.amount = v.amount; syncTpl('budgets', tp, ['cat','amount'], shiftK(k, 1)); }
          else if (all && !tp) { const t = tplFrom('budgets', x); x.tmplId = t.tmplId; tplAdd('budgets', t, shiftK(k, 1)); } }
        else { const x = { id: uid(), cat: v.cat, amount: v.amount }; if (all) { const t = tplFrom('budgets', x); x.tmplId = t.tmplId; mm.budgets.push(x); tplAdd('budgets', t, shiftK(k, 1)); } else mm.budgets.push(x); }
      }, b ? 'Budget modifié' : 'Budget créé');
    },
    onDelete: b ? () => mutate(() => { const mm = month(k), x = mm.budgets.find(y => y.id === id);
      if (x.tmplId && S.templates.budgets.some(t => t.tmplId === x.tmplId) && confirm('Supprimer aussi ce budget des mois suivants ?')) tplDel('budgets', x.tmplId, k);
      else mm.budgets = mm.budgets.filter(y => y.id !== id); }, 'Budget supprimé') : null });
}
function accountDialog(id) {
  const a = id ? accs().find(x => x.id === id) : null;
  formDialog({ title: a ? a.name : 'Nouveau compte d\'épargne',
    fields: [{ id: 'name', label: 'Nom', value: a ? a.name : '', ph: 'ex. Livret A' }, { id: 'type', label: 'Type', type: 'select', options: Object.keys(AT), value: a ? a.type : 'Livret A' },
      { id: 'bal', label: 'Solde actuel', type: 'num', value: a ? aBal(a) : '' }, { id: 'rate', label: 'Taux annuel (%)', type: 'num', value: a ? a.rate : '', hint: 'Sert à estimer les intérêts et le rendement moyen.' }],
    onSave: v => userMut(() => {
      const x = a ? accs().find(y => y.id === id) : (accs().push({ id: uid(), hist: {} }), accs()[accs().length - 1]);
      x.name = v.name || v.type; x.type = v.type; x.rate = num(v.rate); x.hist = x.hist || {}; x.hist[nowK()] = num(v.bal);
    }, a ? 'Compte mis à jour' : 'Compte ajouté'),
    onDelete: a ? () => { if (confirm('Supprimer ce compte et son historique ?')) userMut(() => { U.savAcc = accs().filter(x => x.id !== id); }, 'Compte supprimé'); } : null });
}
function balancesDialog() {
  const A = accs();
  formDialog({ title: 'Mes soldes · ' + mlab(nowK()), intro: 'Saisis le solde actuel de chaque compte. L\'historique mois par mois est conservé.',
    fields: A.map(a => ({ id: a.id, label: esc(a.name), type: 'num', value: aBal(a) })),
    onSave: v => userMut(() => { accs().forEach(a => { if (v[a.id] != null) { a.hist = a.hist || {}; a.hist[nowK()] = v[a.id]; } }); }, 'Soldes mis à jour') });
}
function userMut(fn, msg) { fn(); saveUser(); render(); if (msg) toast(msg);
}
function alertsDialog() {
  const L = alerts(nowK()), d = $('dlg');
  d.innerHTML = `<div class="dw"><div class="dh"><h2>Alertes · ${mlab(nowK())}</h2><button class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    ${L.map((a, i) => `<button class="alert ${a.lvl === 'bad' ? 'bad' : ''}" data-al-i="${i}" style="border:0;text-align:left;cursor:pointer">${svg('warn')}<span>${esc(a.text)}</span></button>`).join('') || '<p class="empty">Tout est sous contrôle ce mois-ci.</p>'}
    <p class="note">Seuils réglables dans Paramètres › Alertes.</p></div>`;
  d.querySelector('[data-x]').onclick = () => d.close();
  d.onclick = e => { const b = e.target.closest('[data-al-i]'); if (!b) return; const a = L[+b.dataset.alI]; d.close(); cur = keyDate(nowK()); go(a.go, { flt: a.flt || 'all', q: a.q || '' }); };
  d.showModal();
}

/* ---------- Alertes personnalisées ---------- */
function alertNewDialog() {
  const d = $('dlg');
  d.innerHTML = `<div class="dw"><div class="dh"><h2>Nouvelle alerte</h2><button class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    <p class="note">Je veux être prévenu quand…</p>
    ${Object.entries(ALT).map(([t, a]) => `<button class="row rowb" data-alt="${t}" style="border:1px solid var(--line)"><span class="ico" style="--c:#F97316">${svg(a.ic)}</span><span class="rt"><span class="rn">${esc(a.l)}</span></span></button>`).join('')}</div>`;
  d.onclick = e => { if (e.target.closest('[data-x]')) return d.close(); const b = e.target.closest('[data-alt]'); if (b) { d.close(); alertDialog(b.dataset.alt); } };
  d.showModal();
}
function alertDialog(t, id) {
  const ex = id ? AL().custom.find(a => a.id === id) : null; if (ex) t = ex.t;
  const v = ex || {}, F = {
    cat: [{ id: 'cat', label: 'Catégorie', type: 'select', options: S.categories, value: v.cat }, { id: 'amt', label: 'Montant maximum dans le mois', type: 'num', value: v.amt, ph: 'ex. 300' }],
    bal: [{ id: 'amt', label: 'Seuil du solde actuel', type: 'num', value: v.amt, ph: 'ex. 200' }],
    big: [{ id: 'amt', label: 'Montant d\'une seule dépense', type: 'num', value: v.amt, ph: 'ex. 100' }],
    inc: [{ id: 'name', label: 'Nom de la recette (ou une partie)', value: v.name, ph: 'ex. Salaire' }, { id: 'day', label: 'Attendue au plus tard le (jour du mois)', value: v.day, ph: 'ex. 5' }],
    rem: [{ id: 'text', label: 'Message', value: v.text, ph: 'ex. Payer la cantine' }, { id: 'day', label: 'Jour du mois', value: v.day, ph: 'ex. 10' }]
  }[t];
  formDialog({ title: ALT[t].l, intro: t === 'rem' ? 'Le rappel s\'affiche ce jour-là et les 2 jours suivants, chaque mois.' : t === 'inc' ? 'Si rien de ce nom n\'est marqué « Reçu » à cette date, tu es prévenu.' : '',
    fields: F, ok: ex ? 'Enregistrer' : 'Créer l\'alerte',
    onDelete: ex ? () => mutate(() => { AL().custom = AL().custom.filter(a => a.id !== id); }, 'Alerte supprimée') : null,
    onSave: r => {
      if ('amt' in r && !(r.amt > 0)) { toast('Indique un montant'); return false; }
      if ('day' in r) { const dd = parseInt(r.day); if (!(dd >= 1 && dd <= 31)) { toast('Jour entre 1 et 31'); return false; } r.day = dd; }
      if (('name' in r && !r.name) || ('text' in r && !r.text)) { toast('Complète le texte'); return false; }
      mutate(() => { const L = AL().custom; if (ex) Object.assign(L.find(a => a.id === id), r); else L.push(Object.assign({ id: uid(), t, on: true }, r)); }, ex ? 'Alerte modifiée' : 'Alerte créée');
    } });
}
// Notification du navigateur pour une nouvelle alerte personnalisée (une seule fois par alerte et par mois)
function notifyAlerts() {
  if (!active || !S) return; let done = {}; const key = 'aln_' + active + '_' + nowK();
  try { done = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
  const L = customAlerts(month(nowK()), nowK(), calc(month(nowK()), nowK())).concat(debtAlerts()).filter(a => !done[a.id]); if (!L.length) return;
  L.forEach(a => { done[a.id] = 1; browserNotify('Alerte · ' + accName(), a.text); });
  try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) {}
}
