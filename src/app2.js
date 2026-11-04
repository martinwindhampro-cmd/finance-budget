
/* ============================== 7. INTERFACE : BRIQUES COMMUNES ============================== */
const UI = { view: 'accueil', flt: 'all', q: '', hp: 6, hy: new Date().getFullYear(), calDay: null, showPaid: false, svMore: false };
const charts = {};
let undoSnap = null;

// Icônes (traits) — un seul style pour toute l'app
const IP = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M7 7h13M7 12h13M7 17h13M3.5 7h.01M3.5 12h.01M3.5 17h.01"/>',
  pie: '<path d="M12 3v9l7 4"/><circle cx="12" cy="12" r="9"/>',
  leaf: '<path d="M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4-3 7-7 10z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/>',
  warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check: '<path d="M5 12l5 5L20 7"/>', up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  out: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  down: '<path d="M6 9l6 6 6-6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  // catégories
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20.5" r="1"/><circle cx="17" cy="20.5" r="1"/>',
  bus: '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M8 21l1.5-4M16 21l-1.5-4"/>',
  health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  ticket: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 5v5M16 5v5"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  bank: '<path d="M4 10h16v10H4zM2 10l10-6 10 6M8 14v2M12 14v2M16 14v2"/>',
  sprout: '<path d="M12 22V12M12 12c0-5 4-8 8-8 0 5-3 8-8 8zM12 15c0-4-3-6-7-6 0 4 3 6 7 6z"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a3 3 0 1 0 0 5M8 11h5M8 13h5"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'
};
const svg = (n, s = 20, w = 2) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${IP[n] || n}</svg>`;

// Couleur + icône par catégorie
const CATS = { 'Logement': ['#6366F1','home'], 'Énergie': ['#F59E0B','bolt'], 'Assurance': ['#0EA5E9','shield'], 'Abonnement': ['#EC4899','phone'],
  'Banque': ['#64748B','card'], 'Alimentation': ['#10B981','cart'], 'Transport': ['#8B5CF6','bus'], 'Santé': ['#14B8A6','health'],
  'Loisirs': ['#F97316','ticket'], 'Autre': ['#94A3B8','tag'], 'Virement': ['#0EA5E9','swap'] };
const XPAL = ['#06B6D4','#84CC16','#E11D48','#A855F7','#EAB308','#0891B2','#D946EF','#65A30D'];
function catInfo(c) {
  if (CATS[c]) return { col: CATS[c][0], ic: CATS[c][1] };
  let h = 0; for (const ch of String(c)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { col: XPAL[h % XPAL.length], ic: 'tag' };
}
// Logo lié au NOM : dès qu'un libellé a un site ou une image (charge fixe ou mouvement), tous les mouvements du même nom l'affichent
let logoMap = null;
function logoFor(name) {
  const n = String(name || '').trim().toLowerCase(); if (!n) return null;
  if (!logoMap) {
    logoMap = {};
    const add = x => { const k = String(x.name || '').trim().toLowerCase(); if (!k || !(x.site || x.img)) return; logoMap[k] = x.img ? { img: x.img } : { site: x.site }; };
    Object.keys(S.months).sort().forEach(k => { const m = S.months[k]; m.expenses.concat(m.incomes).forEach(add); });
    S.templates.expenses.concat(S.templates.incomes).forEach(add);      // les charges fixes ont le dernier mot
  }
  return logoMap[n] || null;
}
// Icône du site : Google, puis DuckDuckGo si Google ne renvoie que l'icône générique ; sinon icône de catégorie
const ddg = s => 'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(s) + '.ico';
function logoOk(im) { if (im.naturalWidth && im.naturalWidth < 24 && !im.dataset.alt) { im.dataset.alt = 1; im.src = ddg(im.dataset.site); } }
function logoKo(im) { if (!im.dataset.alt) { im.dataset.alt = 1; im.src = ddg(im.dataset.site); } else im.remove(); }
// Icône d'un mouvement : image perso > icône du site web > icône de catégorie
function ico(x, type, cls = '') {
  const ci = x.xfer && (type === 'incomes' || !x.cat || x.cat === 'Virement') ? { col: '#0EA5E9', ic: 'swap' } : type === 'incomes' ? { col: '#10B981', ic: 'up' } : catInfo(x.cat);
  const lg = (x.img || x.site) ? x : (logoFor(x.name) || {});
  const over = lg.img ? `<img src="${esc(lg.img)}" alt="">`
    : lg.site ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(lg.site)}&amp;sz=64" data-site="${esc(lg.site)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="logoOk(this)" onerror="logoKo(this)">` : '';
  return `<span class="ico ${cls}" style="--c:${ci.col}">${svg(ci.ic, cls ? 17 : 20)}${over}</span>`;
}

// Infobulles de calcul
function tip(label, title, body, cls = '') {
  return `<span class="tip ${cls}"><button type="button" aria-label="Comment est calculé : ${esc(label)}">${svg('info', 15, 2.2)}</button><span class="bub" role="tooltip"><b class="bt">${title}</b>${body}</span></span>`;
}
function eq(rows, tot, note) {
  const r = rows.filter(Boolean).map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
  return `<span class="eq">${r}<span class="tot">${tot[0]}</span><span class="tot">${tot[1]}</span></span>${note ? `<small>${note}</small>` : ''}`;
}

// Notification en bas d'écran (avec « Annuler » après une modification)
function toast(msg, opt = {}) {
  const e = $('toast'); e.innerHTML = '<span>' + esc(msg) + '</span>';
  if (opt.undo && undoSnap) { const b = document.createElement('button'); b.textContent = 'Annuler'; b.onclick = undo; e.append(b); }
  e.classList.add('on'); e.classList.toggle('act', !!e.querySelector('button'));
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on', 'act'), e.querySelector('button') ? 5000 : 2400);
}
// Toute modification passe par ici : sauvegarde + affichage + possibilité d'annuler
function mutate(fn, msg) {
  if (!loaded) return;
  const before = snapshot();
  fn();
  if (snapshot() === before) return render();
  undoSnap = before; save(); render();
  if (msg !== false) { toast(msg || 'Enregistré', { undo: true }); logActivity(msg || 'Modification'); }
}
function undo() {
  if (!undoSnap) return;
  const s = undoSnap; undoSnap = null;
  S = normalize(JSON.parse(s)); save(); render(); toast('Annulé'); logActivity('A annulé sa dernière modification');
}

// Re-dessin en gardant le champ actif (navigation clavier)
function keepFocus(fn) {
  const a = document.activeElement, tr = a && a.closest && a.closest('[data-id]');
  const sel = tr && a.dataset && a.dataset.f ? `[data-id="${tr.dataset.id}"] [data-f="${a.dataset.f}"]` : null;
  fn();
  if (sel) { const n = document.querySelector(sel); if (n && n !== a) n.focus(); }
}

function chart(id, cfg) {
  if (typeof Chart === 'undefined' || !$(id)) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), cfg);
}
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function chartOpts(extra = {}) {
  const tc = cssv('--mute'), gc = cssv('--line');
  return Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: tc, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3, font: { family: cssv('--font'), weight: '600' } } },
      tooltip: { callbacks: { label: x => ' ' + x.dataset.label + ' : ' + eur(x.raw) } } },
    scales: { x: { ticks: { color: tc, font: { family: cssv('--font') } }, grid: { display: false } },
      y: { ticks: { color: tc, callback: v => Math.round(v).toLocaleString('fr-FR') + ' €' }, grid: { color: gc }, border: { display: false } } } }, extra);
}

/* ---------- Ligne de mouvement ---------- */
function rowHTML(x, type, k, opt = {}) {
  const inc = type === 'incomes', st = dueState(x, type, k);
  const name = x.name || (inc ? 'Recette' : x.cat);
  const sav = isSavAcc(), by = x.by && isShared() ? 'par ' + esc(x.by === currentUser?.email ? 'moi' : x.by.split('@')[0]) : '';
  const meta = [x.fx ? '<b>' + esc(fxFmt(x.fx.amt, x.fx.cur)) + '</b>' : '', x.xfer ? (type === 'expenses' && x.cat && x.cat !== 'Virement' ? esc(x.cat) + ' · ' : '') + esc(xferLabel(x, type)) : sav ? (inc ? 'Versement' : 'Retrait') : inc ? 'Recette' : esc(x.cat), x.isFixed ? (sav ? 'chaque mois' : 'fixe') : '', x.isDivided ? '<b class="half">½ ma part</b>' : '', x.nc ? '<b class="half">↔ déduite d\'une avance</b>' : '', x.share != null ? '<b class="half">↔ ma part ' + eur(num(x.share)) + '</b>' : '', by, opt.sub || ''].filter(Boolean).join(' · ');
  const amount = inc ? '+' + eur(num(x.amount)) : minus(x.share != null ? num(x.amount) : eff(x));   // dépense commune : le montant réellement payé
  let pill = '';
  if (opt.pill !== false && (st !== 'ok' || x.isFixed)) {
    const [cls, txt] = st === 'ok' ? ['ok', inc ? 'Reçu' : 'Payé'] : st === 'late' || st === 'due' ? ['warn', inc ? 'En attente' : 'À payer'] : ['', inc ? 'En attente' : SIMPLE() ? 'À payer' : 'Prévu'];
    pill = `<button class="pill ${cls}" data-a="tst" data-t="${type}" data-id="${x.id}" title="Cliquer pour changer le statut">${txt}</button>`;
  }
  return `<div class="row"><button class="rowb" data-a="open" data-t="${type}" data-id="${x.id}">${ico(x, type)}<span class="rt"><span class="rn">${esc(name)}</span><span class="rs">${meta}</span></span><span class="ra num${inc ? ' pos' : ''}">${amount}</span></button>${pill}</div>`;
}

/* ============================== 8. ÉCRANS ============================== */
const VIEWS = [['accueil','Accueil','home'],['mouvements','Mouvements','list'],['budgets','Budgets','pie'],['epargne','Épargne','leaf'],['historique','Historique','chart'],['parametres','Paramètres','gear']];
const MONTH_VIEWS = ['accueil','mouvements','budgets'];
const EXTRA_VIEWS = [['messages','Messagerie'],['comptes','Tous mes comptes'],['releves','Relevés bancaires']];

function go(v, opt = {}) {
  UI.view = v;
  if (opt.flt) UI.flt = opt.flt;
  if (opt.q !== undefined) UI.q = opt.q;
  try { localStorage.setItem('bt', v); } catch (e) {}
  render(); scrollTo({ top: 0 });
}
function render() {
  if (!loaded) return;
  logoMap = null;
  keepFocus(() => {
    renderChrome();
    if (SIMPLE() && !SIMPLE_VIEWS.includes(UI.view)) UI.view = 'accueil';
  VIEWS.concat(EXTRA_VIEWS).forEach(([v]) => $('v-' + v).hidden = v !== UI.view);
    ({ accueil: vAccueil, mouvements: vMouvements, budgets: vBudgets, epargne: vEpargne, historique: vHistorique, parametres: vParametres, messages: vMessages, comptes: vComptes, releves: vReleves })[UI.view]();
  });
}
function renderChrome() {
  if (SIMPLE() && !SIMPLE_VIEWS.includes(UI.view)) UI.view = 'accueil';
  askModeOnce();
  $('navlist').innerHTML = VIEWS.filter(([v]) => !(v === 'budgets' && isSavAcc()) && (!SIMPLE() || SIMPLE_VIEWS.includes(v))).map(([v, l, i]) => [v, SIMPLE() && v === 'parametres' ? 'Réglages' : l, i]).map(([v, l, i]) => `<button class="nav${UI.view === v ? ' on' : ''}" data-view="${v}"${UI.view === v ? ' aria-current="page"' : ''}>${svg(i)}<span>${l}</span></button>`).join('');
  const mv = MONTH_VIEWS.includes(UI.view), k = ck(), mn = MN[cur.getMonth()];
  $$('[data-a=prev],[data-a=next]').forEach(b => b.hidden = !mv);
  $$('[data-a=prev]')[0].innerHTML = svg('left', 18, 2.2); $$('[data-a=next]')[0].innerHTML = svg('right', 18, 2.2);
  $('btn-today').hidden = !mv || k === nowK();
  $('title').textContent = SIMPLE() && UI.view === 'parametres' ? 'Réglages' : UI.view === 'accueil' ? mlab(k) : mv ? `${VIEWS.find(v => v[0] === UI.view)[1]} · ${mn}` : VIEWS.concat(EXTRA_VIEWS).find(v => v[0] === UI.view)[1];
  const n = alerts(nowK()).length + unreadCount();
  $('bell').innerHTML = svg('bell') + (n ? `<span class="dot-badge">${n > 9 ? '9+' : n}</span>` : '');
  $('bell').setAttribute('aria-label', n ? `Messagerie (${n} nouveau${n > 1 ? 'x' : ''})` : 'Messagerie');
  $('bell').classList.toggle('on', UI.view === 'messages');
  $$('.accsw-slot').forEach(s => s.innerHTML = accSwitcherHTML());
  $$('[data-a=new]')[0].innerHTML = svg('plus', 18, 2.4) + '<span>Ajouter</span>';
  setTimeout(notifyAlerts, 0); setTimeout(autoRun, 1500); compSyncSoon();
  $('todayd').innerHTML = `<span class="tdl">${todayLabel()}</span><span class="tds">${todayLabel({ weekday: 'short', day: 'numeric', month: 'short' })}</span>`;
}

/* ---------- ACCUEIL ---------- */
// Fourchette de la fin de mois (± un écart type de tes dépenses habituelles)
function finRange(c) {
  const sd = c.vr?.n ? c.vr.sd : 0, base = Math.max(Math.abs(c.vr?.h?.mean || 0), 1);
  return { lo: c.est - sd, hi: c.est + sd, p: Math.min(99, Math.round(sd / base * 100)) };
}
const todayLabel = (o = { weekday: 'long', day: 'numeric', month: 'long' }) => { const s = new Date().toLocaleDateString('fr-FR', o); return s.charAt(0).toUpperCase() + s.slice(1); };
function vAccueil() {
  if (isSavAcc()) return vSavAccueil();
  if (SIMPLE()) return vSimpleAccueil();
  const k = ck(), m = month(k), c = calc(m, k), V = $('v-accueil');
  const empty = !S.templates.expenses.length && !S.templates.incomes.length && !m.expenses.length && !m.incomes.length;
  const ravTip = tip('reste à vivre', 'Reste à vivre', c.past ? 'Mois terminé : ce qui restait sur le compte en fin de mois.' + eq([['Fin de mois', eur(c.est)]], ['= Reste à vivre', eur(c.rav)]) : "Ce qu'il te restera en fin de mois si tu ne dépenses plus rien. Tes budgets (courses, loisirs…) se dépensent là-dedans." + eq([
      ['Solde actuel', eur(c.current)], c.incWait > 0 && ['+ Recettes à venir', eur(c.incWait)], ['− Dépenses à payer', eur(c.outPlan)], ['− Épargne prévue', eur(c.saving)]],
      ['= Reste à vivre', eur(c.rav)], c.perDay != null ? `Par jour : ${eur(Math.max(0, c.rav))} ÷ ${c.left} jour${c.left > 1 ? 's' : ''} restant${c.left > 1 ? 's' : ''} = ${eur(c.perDay)}.` : ''), 'dn rt');
  const depTip = tip('dépensé', 'Dépensé ce mois', eq([['Charges fixes payées', eur(c.fixPaid)], ['+ Dépenses variables', eur(c.varAll)]], ['= Dépensé', eur(c.spent)],
      `Prévu = charges fixes (${eur(c.fixOut)}) + budgets (${eur(c.budPlan)})${c.varOut > 0 ? ` + hors budget (${eur(c.varOut)})` : ''} = ${eur(c.planned)}.`), 'lf');
  const solTip = tip('solde actuel', 'Solde actuel', eq([[`Solde au 1er ${MN[cur.getMonth()].toLowerCase()}`, eur(c.init)], ['+ Recettes reçues', eur(c.incIn)], ['− Dépenses payées', eur(c.outPaid)]],
      ['= Solde actuel', eur(c.current)], c.bankSet ? 'Solde du 1er saisi par toi.' : 'Solde du 1er calculé depuis le mois précédent. Si ta banque affiche autre chose, clique sur « Solde au 1er » pour recaler.'), 'rt');
  const unpaid = m.expenses.filter(e => e.status !== 'Payé');
  const rapTip = tip('reste à payer', 'Reste à payer', 'Tout ce qui est encore « À payer » ou « Prévu » ce mois-ci.' + eq(
      unpaid.slice(0, 6).map(e => [esc(e.name || e.cat) + (e.date ? ` (${e.date})` : ''), eur(eff(e))]).concat(unpaid.length > 6 ? [[`+ ${unpaid.length - 6} autres`, eur(sum(unpaid.slice(6), eff))]] : []),
      ['= Reste à payer', eur(c.outPlan)]));
  const vr = c.vr, isNow = k === nowK(), fin = finRange(c);
  const finTip = tip('fin de mois estimée', 'Fin de mois estimée', c.past
      ? 'Ce mois est terminé : calcul sur ce qui a réellement été reçu et payé.' + eq([['Solde au 1er', eur(c.init)], ['+ Recettes reçues', eur(c.incIn)], ['− Dépenses payées', eur(c.outPaid)], ['− Épargne', eur(c.saving)]], ['= Fin de mois', eur(c.est)])
      : !vr.n ? "Pas encore assez d'historique : c'est ce qu'il restera si tu ne dépenses plus rien en dehors de ce qui est prévu. L'estimation s'affinera dès le mois prochain." + eq([['Reste à vivre', eur(c.rav)]], ['= Fin de mois', eur(c.est)])
      : `D'après tes ${vr.n} dernier${vr.n > 1 ? 's' : ''} mois : ${isNow ? `après le ${vr.from}, tu dépenses en général encore` : 'sur un mois entier, tu dépenses en général'} <b>${eur(vr.h.mean)}</b> au quotidien (courses, sorties… hors charges fixes).`
        + eq([['Reste à vivre', eur(c.rav)], vr.ahead > 0 && ['(dont déjà prévu : ' + eur(vr.ahead) + ')', ''], ['− Dépenses habituelles à venir', eur(vr.v)]].filter(Boolean), ['≈ Fin de mois', eur(c.est)],
          `Fourchette probable : <b>${eur0(fin.lo)} à ${eur0(fin.hi)}</b> (± ${fin.p} %). Plus tu as de mois d'historique, plus c'est précis.`), 'lf');

  // Prochains prélèvements
  const isCur = k === nowK();
  const fixedUnpaid = m.expenses.filter(e => e.isFixed && e.status !== 'Payé').sort((a, b) => (parseInt(a.date) || 99) - (parseInt(b.date) || 99));
  const next = (isCur ? fixedUnpaid.filter(e => !parseInt(e.date) || parseInt(e.date) >= today()) : fixedUnpaid).slice(0, 4);
  const nextHTML = next.map(e => {
    const d = parseInt(e.date);
    const when = d ? shortDay(k, d) + (isCur ? (d === today() ? " · aujourd'hui" : ` · dans ${d - today()} j`) : '') : 'sans date';
    return `<div class="row"><button class="rowb" data-a="open" data-t="expenses" data-id="${e.id}">${ico(e, 'expenses')}<span class="rt"><span class="rn">${esc(e.name || e.cat)}</span><span class="rs">${when}</span></span><span class="ra num">${minus(eff(e))}</span></button></div>`;
  }).join('') || `<p class="empty">${S.templates.expenses.length ? 'Toutes les charges fixes sont réglées.' : 'Aucune charge fixe. Ajoute-les avec « + Ajouter » et « Répéter chaque mois ».'}</p>`;

  // Derniers mouvements
  const recent = []; groups(m, k, 'all', '').filter(g => g.key !== 'next').forEach(g => g.items.forEach(it => recent.push([g, it])));
  let lastG = null;
  const recentHTML = recent.slice(0, 6).map(([g, [x, t]]) => { const h = g !== lastG ? `<div class="lbl">${g.label}</div>` : ''; lastG = g; return h + rowHTML(x, t, k, { pill: false }); }).join('')
    || '<p class="empty">Aucun mouvement ce mois-ci.</p>';

  // Budgets (3 premiers)
  const budHTML = m.budgets.slice(0, 4).map(b => {
    const s = vspent(m, b.cat), a = num(b.amount), p = pct(s, a), ci = catInfo(b.cat), col = p > 100 ? 'var(--bad)' : p > 85 ? '#F97316' : ci.col;
    return `<div style="display:flex;flex-direction:column;gap:7px"><div style="display:flex;justify-content:space-between;font-size:14px"><b style="font-weight:600">${esc(b.cat)}</b><span class="num" style="color:var(--ink2)"><b style="color:var(--ink)">${eur(s)}</b> / ${eur0(a)}</span></div>
      <div class="bar"><i style="width:${Math.min(100, p)}%;--c:${col}"></i></div>
      <span style="font-size:12px;${p > 85 ? 'color:var(--warn);font-weight:600' : 'color:var(--mute)'}">${a - s >= 0 ? 'Reste ' + eur(a - s) : 'Dépassé de ' + eur(s - a)}${p > 85 && p <= 100 ? ' · ' + Math.round(p) + ' %' : ''}</span></div>`;
  }).join('') || '<p class="empty">Aucun budget. Crée une enveloppe (courses, loisirs…) dans Budgets.</p>';

  // Répartition
  const ct = Object.entries(catTotals(m)).sort((a, b) => b[1] - a[1]), tot = ct.reduce((s, x) => s + x[1], 0);
  const top = ct.slice(0, 6), rest = ct.slice(6).reduce((s, x) => s + x[1], 0);
  const parts = top.map(([n, v]) => [n, v, catInfo(n).col]).concat(rest > 0 ? [['Autres', rest, '#94A3B8']] : []);
  const repHTML = tot > 0 ? `<div class="stack">${parts.map(([, v, col]) => `<i style="flex:${v};--c:${col}"></i>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px;font-size:13px">${parts.map(([n, v, col]) => `<span style="display:flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:${col}"></i>${esc(n)} <b class="num" style="margin-left:auto">${Math.round(v / tot * 100)} %</b></span>`).join('')}</div>`
    : '<p class="empty">Rien de dépensé pour l\'instant.</p>';

  const al = alerts(k);
  const alertHTML = al.length ? `<div class="alert ${al[0].lvl === 'bad' ? 'bad' : ''}" role="status">${svg('warn')}<span>${esc(al[0].text)}${al.length > 1 ? ` <small>(+${al.length - 1} autre${al.length > 2 ? 's' : ''})</small>` : ''}</span><button class="lnk" data-a="${al.length > 1 ? 'alerts' : 'alertgo'}">Voir</button></div>` : '';

  const onboard = empty ? `<section class="card" style="display:flex;flex-direction:column;gap:14px">
      <h2>Bienvenue ! On démarre en 3 étapes</h2>
      <div class="chips"><button class="btn" data-a="ob-inc">1. Ajouter mon salaire</button><button class="btn" data-a="ob-fix">2. Ajouter une charge fixe</button><button class="btn" data-a="bank">3. Saisir mon solde bancaire</button></div>
      <p class="note">Salaire et charges fixes sont recopiés automatiquement chaque mois. Tu pourras tout modifier ensuite.</p></section>` : '';

  V.innerHTML = `${onboard}
  <div class="grid2">
    <section class="hero" aria-label="Reste à vivre" style="background:color-mix(in srgb,${ACC[active]?.color || '#4338CA'} 42%,#0B0A24)">
      <div class="deco"><i style="right:-60px;top:-80px;width:260px;height:260px;background:var(--hero-2);opacity:.55"></i><i style="right:70px;top:90px;width:120px;height:120px;background:var(--hero-3);opacity:.35"></i></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span class="t">Reste à vivre ${c.past ? 'en ' + MN[cur.getMonth()].toLowerCase() : `jusqu'au ${dim(k)} ${MN[cur.getMonth()].toLowerCase()}`} ${ravTip}</span>
        <span class="v num${c.rav < 0 ? ' neg' : ''}">${eur(c.rav)}</span>
        <span class="s">${c.perDay != null ? `soit <b class="num">${eur(c.perDay)} / jour</b> pendant ${c.left} jour${c.left > 1 ? 's' : ''}` : c.past ? 'Mois terminé' : ''}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--hero-t)"><span style="display:flex;align-items:center;gap:4px">Dépensé ce mois ${depTip}</span><span class="num"><b style="color:#fff">${eur(c.spent)}</b> sur ${eur(c.planned)} prévus</span></div>
        <div class="hb"><i style="width:${Math.min(100, pct(c.spent, c.planned))}%"></i></div>
      </div>
      <div class="stats">
        <div><span>Solde actuel ${solTip}</span><b>${eur(c.current)}</b></div>
        <div><span>Reste à payer ${rapTip}</span><b>${eur(c.outPlan)}</b></div>
        <div><span>Fin de mois estimée ${finTip}</span><b>${c.vr?.n ? '≈ ' : ''}${eur(c.est)}</b>${c.vr?.n ? `<small class="num" style="font-size:11px;color:var(--hero-t)">${finRange(c).p >= 1 ? '± ' + finRange(c).p + ' % · ' : ''}d'après ${c.vr.n} mois</small>` : ''}</div>
      </div>
      <button class="bk" data-a="bank">Solde au 1er : ${eur(c.init)} ${c.bankSet ? '(saisi)' : '(calculé)'} · modifier</button>
    </section>
    <section class="card small" aria-label="Prochains prélèvements" style="display:flex;flex-direction:column;gap:2px">
      <div class="ch"><h2>Prochains prélèvements</h2><button class="lnk" data-view="budgets">Échéancier</button></div>
      ${nextHTML}
    </section>
  </div>
  ${alertHTML}
  <div class="grid2">
    <section class="card big" aria-label="Derniers mouvements" style="display:flex;flex-direction:column;gap:2px">
      <div class="ch"><h2>Derniers mouvements</h2><button class="lnk" data-view="mouvements">Tout voir</button></div>
      ${recentHTML}
    </section>
    <div class="small" style="display:flex;flex-direction:column;gap:20px">
      <section class="card" aria-label="Budgets" style="display:flex;flex-direction:column;gap:16px"><div class="ch" style="margin:0"><h2>Budgets</h2><button class="lnk" data-view="budgets">Gérer</button></div>${budHTML}</section>
      <section class="card" aria-label="Répartition" style="display:flex;flex-direction:column;gap:14px"><h2>Où part l'argent</h2>${repHTML}</section>
    </div>
  </div>`;
}

/* ---------- MOUVEMENTS ---------- */
// Regroupe les mouvements par jour (« À venir » en tête pour le mois en cours)
function groups(m, k, flt, q) {
  const isCur = k === nowK(), td = today();
  let items = [...m.expenses.map(x => [x, 'expenses']), ...m.incomes.map(x => [x, 'incomes'])];
  items = items.filter(([x, t]) => {
    if (flt === 'todo' && !(t === 'expenses' && x.status !== 'Payé')) return false;
    if (flt === 'fixed' && !x.isFixed) return false;
    if (flt === 'var' && (x.isFixed || t !== 'expenses')) return false;
    if (flt === 'inc' && t !== 'incomes') return false;
    if (q && !((x.name || '') + ' ' + (x.cat || '')).toLowerCase().includes(q)) return false;
    return true;
  });
  const G = new Map(), add = (key, label, ord, it) => { if (!G.has(key)) G.set(key, { key, label, ord, items: [] }); G.get(key).items.push(it); };
  items.forEach(it => {
    const [x, t] = it, d = parseInt(x.date) || 0;
    if (isCur && !isPaid(x, t) && (d > td || !d)) add('next', 'À venir', -1, it);
    else if (d) add('d' + d, dayLabel(k, d), k > nowK() ? d : 100 - d, it);
    else add('nd', 'Sans date', 999, it);
  });
  const out = [...G.values()].sort((a, b) => a.ord - b.ord);
  const nx = out.find(g => g.key === 'next'); if (nx) nx.items.sort((a, b) => (parseInt(a[0].date) || 99) - (parseInt(b[0].date) || 99));
  return out;
}
function vMouvements() {
  const k = ck(), m = month(k), c = calc(m, k), V = $('v-mouvements');
  const cnt = f => groups(m, k, f, '').reduce((s, g) => s + g.items.length, 0);
  const simple = SIMPLE();
  const F = simple ? (isSavAcc() ? [['all', 'Tout'], ['inc', 'Versements'], ['var', 'Retraits']] : [['all', 'Tout'], ['todo', 'À payer'], ['inc', 'Rentrées d\'argent']]) : isSavAcc() ? [['all', 'Tout'], ['inc', 'Versements'], ['var', 'Retraits'], ['fixed', 'Automatiques']] : [['all', 'Tout'], ['todo', 'À payer'], ['fixed', 'Fixes'], ['var', 'Variables'], ['inc', 'Recettes']];
  const gs = groups(m, k, UI.flt, UI.q.trim().toLowerCase());
  const list = gs.map(g => `<div class="lbl">${g.label}</div>` + g.items.map(([x, t]) => rowHTML(x, t, k)).join('')).join('')
    || `<p class="empty">${UI.q ? 'Aucun résultat pour « ' + esc(UI.q) + ' ».' : 'Aucun mouvement ici. Clique sur « + Ajouter ».'}</p>`;
  const searchFocused = document.activeElement && document.activeElement.id === 'q';
  V.innerHTML = `
  <div class="mvgrid">
  ${simple ? `<div class="sbtns mvside"><button class="sbtn out" data-a="s-new" data-t="expenses"><b>−</b>${isSavAcc() ? 'Retrait' : 'Dépense'}</button><button class="sbtn in" data-a="s-new" data-t="incomes"><b>+</b>${isSavAcc() ? 'Versement' : 'Rentrée d\'argent'}</button>${bkNoteHTML()}</div>` : `<div class="mvside">
    <div class="kp"><span>${isSavAcc() ? 'Versements' : 'Recettes'}</span><b style="color:var(--ok)">+${eur(c.incAll)}</b><small>${eur(c.incIn)} reçues</small></div>
    <div class="kp"><span>Dépenses ${tip('dépenses', 'Dépenses du mois', eq([['Charges fixes', eur(c.fixAll)], ['+ Dépenses variables', eur(c.varAll)]], ['= Total', eur(c.outAll)], 'Montants « ½ » comptés pour ta part seulement.'))}</span><b>${minus(c.outAll)}</b><small>${eur(c.outPaid)} payées</small></div>
    <div class="kp"><span>Reste à payer ${tip('reste à payer', 'Reste à payer', 'Dépenses de ce mois pas encore marquées « Payé », charges fixes comprises. Clique sur l\'étiquette d\'une ligne pour changer son statut.', 'lf')}</span><b style="color:var(--warn)">${eur(c.outPlan)}</b><small>${m.expenses.filter(e => e.status !== 'Payé').length} élément(s)</small></div>
    ${bkNoteHTML()}${halfOldHTML()}
  </div>`}
  <section class="card" aria-label="Liste des mouvements" style="display:flex;flex-direction:column;gap:2px">
    <div class="ch">
      <div class="chips" role="group" aria-label="Filtrer">${F.map(([f, l]) => `<button class="chip${UI.flt === f ? ' on' : ''}" data-a="flt" data-v="${f}" aria-pressed="${UI.flt === f}">${l} · ${cnt(f)}</button>`).join('')}</div>
      <label class="search">${svg('search', 16, 2.2)}<input type="search" id="q" placeholder="Rechercher" aria-label="Rechercher un mouvement" value="${esc(UI.q)}"></label>
    </div>
    ${list}
  </section>
  </div>`;
  if (searchFocused) { const q = $('q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

/* ---------- BUDGETS & ÉCHÉANCIER ---------- */
function vBudgets() {
  const k = ck(), m = month(k), c = calc(m, k), V = $('v-budgets'), isCur = k === nowK();
  const base = Math.max(c.incAll, c.fixOut + c.budEff + c.varOut + c.xferOut + c.saving) || 1;
  const seg = [['Charges fixes', c.fixOut, '#6366F1'], ['Budgets', c.budEff, '#10B981'], ['Hors budget', c.varOut, '#F97316'], ['Virements', c.xferOut, '#0EA5E9'], ['Épargne', c.saving, '#14B8A6'], ['Libre', Math.max(0, c.free), 'color-mix(in srgb,var(--mute) 35%,var(--soft))']].filter(s => s[1] > 0);
  const cards = m.budgets.map(b => {
    const s = vspent(m, b.cat), a = num(b.amount), p = pct(s, a), ci = catInfo(b.cat), r = a - s;
    const col = p > 100 ? 'var(--bad)' : p > 85 ? '#F97316' : ci.col;
    const pd = r > 0 && c.left > 0 ? r / c.left : null;
    return `<button class="card" data-a="bud" data-id="${b.id}" style="display:flex;flex-direction:column;gap:12px;padding:20px;border:0;text-align:left;${p > 85 ? 'box-shadow:inset 0 0 0 2px ' + (p > 100 ? 'var(--bad)' : '#FDBA74') : ''}">
      <span style="display:flex;align-items:center;gap:12px">${ico({ cat: b.cat }, 'expenses')}<b style="font-weight:700">${esc(b.cat)}</b></span>
      <span class="num" style="font-size:24px;font-weight:800">${eur(Math.abs(r))} <span style="font-size:13px;font-weight:600;color:var(--mute)">${r >= 0 ? 'restants' : 'de dépassement'}</span></span>
      <span class="bar" style="display:block"><i style="width:${Math.min(100, p)}%;--c:${col}"></i></span>
      <span class="num" style="font-size:12px;${p > 85 ? 'color:var(--warn);font-weight:600' : 'color:var(--mute)'}">${eur(s)} sur ${eur0(a)}${pd != null ? ' · ' + eur(pd) + ' / jour' : ''}</span>
      ${vfixed(m, b.cat) > 0 ? `<span class="note" style="font-size:12px">dont ${eur(vfixed(m, b.cat))} fixes (${esc(m.expenses.filter(e => e.isFixed && e.cat === b.cat && !xferPlain(e)).map(e => e.name).slice(0, 2).join(', '))})${vfixed(m, b.cat) >= a ? ' · <b style="color:var(--warn)">le budget ne couvre pas les fixes</b>' : ''}</span>` : ''}
    </button>`;
  }).join('');
  const bcats = new Set(m.budgets.map(b => b.cat));
  const outCats = [...new Set(m.expenses.filter(e => !e.isFixed && !bcats.has(e.cat)).map(e => e.cat))];

  // Échéancier
  const fixed = m.expenses.filter(e => e.isFixed);
  const byDay = {}; fixed.forEach(e => { const d = Math.min(parseInt(e.date) || 0, dim(k)); if (d) (byDay[d] = byDay[d] || []).push(e); });
  const first = (keyDate(k).getDay() + 6) % 7;
  let cal = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'].map(w => `<span class="wk">${w}</span>`).join('') + '<span></span>'.repeat(first);
  for (let d = 1; d <= dim(k); d++) {
    const its = byDay[d] || [], st = its.map(e => dueState(e, 'expenses', k));
    const late = st.includes('late') || st.includes('due'), plan = st.includes('plan'), dotc = late ? '#F59E0B' : plan ? 'var(--acc)' : '#10B981';
    const cls = ['d', its.length ? 'has' : '', late ? 'late' : '', isCur && d === today() ? 'today' : '', UI.calDay === d ? 'sel' : ''].filter(Boolean).join(' ');
    cal += its.length ? `<button class="${cls}" data-a="calday" data-v="${d}" aria-label="${d} : ${its.length} prélèvement(s)">${d}<i style="--c:${dotc}"></i></button>` : `<span class="${cls}">${d}</span>`;
  }
  const sorted = fixed.slice().sort((a, b) => (parseInt(a.date) || 99) - (parseInt(b.date) || 99));
  const sel = UI.calDay ? sorted.filter(e => parseInt(e.date) === UI.calDay) : null;
  const todo = (sel || sorted).filter(e => e.status !== 'Payé'), done = (sel || sorted).filter(e => e.status === 'Payé');
  const line = e => rowHTML(e, 'expenses', k, { sub: e.date ? shortDay(k, parseInt(e.date)) : 'sans date' });
  const paidTot = sum(fixed.filter(e => e.status === 'Payé'), eff), todoTot = sum(fixed.filter(e => e.status !== 'Payé'), eff);

  V.innerHTML = `
  <section class="card" aria-label="Répartition des recettes" style="display:flex;flex-direction:column;gap:14px">
    <div class="ch" style="margin:0"><h2>Répartition de tes recettes ${tip('répartition', 'Répartition des recettes', 'Comment tes recettes du mois sont réparties entre ce qui est prévu (charges fixes, budgets, épargne) et ce qui reste libre.' + eq([['Recettes', eur(c.incAll)], ['− Charges fixes', eur(c.fixOut)], ['− Budgets', eur(c.budEff)], c.varOut > 0 && ['− Hors budget', eur(c.varOut)], ['− Épargne', eur(c.saving)]], ['= Libre', eur(c.free)]), 'rt')}</h2><button class="btn sm" data-a="saving">Épargne prévue : ${eur(c.saving)} · modifier</button></div>
    <div class="stack" style="height:26px;border-radius:8px">${seg.map(([, v, col]) => `<i style="flex:${v / base};--c:${col}"></i>`).join('')}</div>
    <div class="legend">${seg.map(([l, v, col]) => `<span><i style="--c:${col}"></i>${l} <b class="num">${eur(v)}</b></span>`).join('')}<span style="margin-left:auto">sur <b class="num">${eur(c.incAll)}</b> de recettes</span></div>
    ${c.free < 0 ? `<div class="alert bad">${svg('warn')}<span>Ce mois-ci, le prévu dépasse les recettes de <b>${eur(-c.free)}</b>.</span></div>` : ''}
    ${outCats.length ? `<p class="note">Dépenses sans budget : ${outCats.map(esc).join(', ')} (${eur(c.varOut)}). <button class="lnk" data-a="bud-new" data-v="${esc(outCats[0])}">Créer un budget ${esc(outCats[0])}</button></p>` : ''}
  </section>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px">
    ${cards}
    <button class="card budnew" data-a="bud-new" style="border:2px dashed var(--line);box-shadow:none;background:none;display:flex;align-items:center;justify-content:center;gap:8px;min-height:150px;color:var(--mute);font-weight:700">${svg('plus')} Nouveau budget</button>
  </div>
  <section class="card" aria-label="Échéancier des charges fixes" style="display:flex;flex-wrap:wrap;gap:28px">
    <div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:10px">
      <div class="ch" style="margin:0"><h2>Échéancier · charges fixes</h2><span class="note">${mlab(k)}</span></div>
      <div class="cal">${cal}</div>
      <div class="legend" style="font-size:12px"><span><i style="--c:#10B981;border-radius:50%"></i>Payé</span><span><i style="--c:#F59E0B;border-radius:50%"></i>À payer</span><span><i style="--c:var(--acc);border-radius:50%"></i>À venir</span></div>
    </div>
    <div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:4px">
      <div class="mini" style="margin-bottom:8px">
        <div style="background:var(--ok-s);color:var(--ok)"><span>Payé</span><b>${eur(paidTot)}</b></div>
        <div style="background:var(--acc-s);color:var(--acc-d)"><span>À venir ${tip('à venir', 'À venir', 'Charges fixes du mois pas encore payées, y compris celles sans date (abonnements prélevés à un jour variable).', 'lf')}</span><b>${eur(todoTot)}</b></div>
      </div>
      ${sel ? `<div class="ch" style="margin:0"><b>Le ${UI.calDay}</b><button class="lnk" data-a="calday" data-v="${UI.calDay}">Tout afficher</button></div>` : ''}
      ${todo.map(line).join('')}
      ${done.length ? (sel || UI.showPaid ? done.map(line).join('') : `<button class="row rowb" data-a="showpaid" style="color:var(--mute)"><span class="ico" style="--c:#10B981">${svg('check')}</span><span class="rt"><span class="rn">${done.length} charge${done.length > 1 ? 's' : ''} payée${done.length > 1 ? 's' : ''}</span><span class="rs">Afficher le détail</span></span><span class="ra num" style="color:var(--ok)">✓ ${eur(paidTot)}</span></button>`) : ''}
      ${!fixed.length ? '<p class="empty">Aucune charge fixe ce mois-ci.</p>' : ''}
    </div>
  </section>
  ${debtsHTML()}
  ${loansHTML()}`;
}
