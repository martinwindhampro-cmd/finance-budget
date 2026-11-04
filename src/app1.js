'use strict';
/* =====================================================================
   BUDGET — application de suivi des dépenses
   Organisation du code :
     1. Firebase            5. Synchro & sauvegardes
     2. Outils              6. Connexion & compte
     3. Données             7. Interface : briques communes
     4. Calculs             8. Écrans · 9. Fiche d'édition · 10. Événements
   ===================================================================== */

/* ============================== 1. FIREBASE ============================== */
const firebaseConfig = {
  apiKey: "AIzaSyAVfKgI_h4TpjmrSFIsbRRrTulOy672ywI",
  authDomain: "finance-budget-2026.firebaseapp.com",
  projectId: "finance-budget-2026",
  storageBucket: "finance-budget-2026.firebasestorage.app",
  messagingSenderId: "731092994652",
  appId: "1:731092994652:web:39de5d2fe7d8593abdb499"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
auth.languageCode = 'fr';
const db = firebase.firestore();
// Cache hors-ligne : l'app marche sans réseau et renvoie les modifications au retour de la connexion
db.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('Persistance hors-ligne indisponible :', e.code));
let currentUser = null;

/* ============================== 2. OUTILS ============================== */
const $ = id => document.getElementById(id);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v) || 0;
const eur = v => num(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const eur0 = v => num(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + eur(Math.abs(v));
const minus = v => '−' + eur(Math.abs(v));
// eff  = ce que la dépense me coûte (budgets, catégories) : ma part si dépense commune, ½ si « ½ Partagé »
// cash = ce qui sort vraiment du compte (solde) : rien pour une part « compensée » (déduite d'une avance), tout ce que j'ai payé sinon
const eff = e => e.share != null ? num(e.share) : e.isDivided ? Math.round(num(e.amount) * 50) / 100 : num(e.amount);   // au centime (10,99 → 5,50)
const cash = e => e.nc ? 0 : e.share != null ? num(e.amount) : eff(e);
const sum = (a, f = x => num(x.amount)) => a.reduce((s, x) => s + f(x), 0);
const day = v => { const n = parseInt(v); return n >= 1 && n <= 31 ? String(n) : ''; };
const parseAmt = v => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const fmtIn = v => (v === '' || v == null) ? '' : String(Math.round(num(v) * 100) / 100).replace('.', ',');
const pct = (a, b) => b > 0 ? a / b * 100 : 0;
const MN = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const mkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const nowK = () => mkey(new Date());
const keyDate = k => { const [y, m] = k.split('-'); return new Date(+y, +m - 1, 1); };
const shiftK = (k, n) => { const d = keyDate(k); d.setMonth(d.getMonth() + n); return mkey(d); };
const mlab = k => { const d = keyDate(k); return MN[d.getMonth()] + ' ' + d.getFullYear(); };
const mshort = k => { const d = keyDate(k); return MS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2); };
const dim = k => { const d = keyDate(k); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
const today = () => new Date().getDate();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function daysLeft(k) { const n = nowK(); return k === n ? dim(k) - today() + 1 : k > n ? dim(k) : 0; }
function dayDate(k, d) { const x = keyDate(k); x.setDate(Math.min(d, dim(k))); return x; }
function shortDay(k, d) { return dayDate(k, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); }
function dayLabel(k, d) {
  if (k === nowK()) { if (d === today()) return "Aujourd'hui"; if (d === today() - 1) return 'Hier'; }
  return cap(dayDate(k, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
}
const cleanSite = s => String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');

/* ============================== 3. DONNÉES ==============================
   S = { categories, templates:{expenses,incomes,budgets}, months:{'AAAA-MM':{bankBalance,savingGoal,expenses,incomes,budgets}},
         savings (simulateur), savAcc (comptes d'épargne), alerts (seuils) }
   Un « modèle » (template) est une charge/recette/budget récurrent, recopié dans chaque nouveau mois.      */
const LS = 'budget_app_state';
const DC = ['Logement','Énergie','Assurance','Abonnement','Banque','Alimentation','Transport','Santé','Loisirs','Autre'];
const fresh = () => ({ categories: [...DC], templates: { expenses: [], incomes: [], budgets: [] }, months: {} });

function normalize(s) {
  s.categories = s.categories?.length ? s.categories : [...DC];
  s.templates = s.templates || {};
  ['expenses','incomes','budgets'].forEach(k => s.templates[k] = s.templates[k] || []);
  const fix = e => {
    const had = / \(Divisé par 2\)/.test(e.name || '');                  // ancien format
    if (e.isDivided && had) e.amount = e.originalAmount != null ? num(e.originalAmount) : num(e.amount) * 2;
    if (e.name !== undefined || e.cat === undefined) e.name = (e.name || '').replace(' (Divisé par 2)', '');
    e.isDivided = !!e.isDivided; e.date = day(e.date); e.amount = num(e.amount);
    if (!e.site) delete e.site; if (!e.img) delete e.img;
    delete e.originalAmount; delete e.hasReceipt;
  };
  Object.values(s.templates).forEach(a => a.forEach(t => { t.tmplId = t.tmplId || uid(); fix(t); }));
  s.months = s.months || {};
  Object.values(s.months).forEach(m => {
    const nz = v => (v === '' || v == null) ? null : num(v);
    m.bankBalance = nz(m.bankBalance); m.savingGoal = nz(m.savingGoal);
    m.expenses = m.expenses || []; m.incomes = m.incomes || [];
    m.budgets = m.budgets || JSON.parse(JSON.stringify(s.templates.budgets));
    [...m.expenses, ...m.incomes, ...m.budgets].forEach(x => { x.id = x.id || uid(); fix(x); });
    m.budgets.forEach(b => { delete b.name; delete b.date; delete b.isDivided; });
    [...m.expenses, ...m.incomes].forEach(x => {
      x.isFixed = !!x.isFixed;
      if (x.isFixed && !x.tmplId) { const t = s.templates[m.expenses.includes(x) ? 'expenses' : 'incomes'].find(t => t.name === x.name); x.tmplId = t ? t.tmplId : uid(); }
      // virement automatique créé avant la v10 : la ligne du mois de création n'était pas reliée à son modèle
      if (x.xfer?.kind === 'acc' && !x.isFixed) { const t = s.templates[m.expenses.includes(x) ? 'expenses' : 'incomes'].find(t => t.xfer?.kind === 'acc' && t.xfer.auto && t.xfer.acc === x.xfer.acc && t.name === x.name && num(t.amount) === num(x.amount));
        if (t) { x.isFixed = true; x.tmplId = t.tmplId; } }
    });
  });
  s.templates.budgets.forEach(b => { delete b.name; delete b.date; delete b.isDivided; });
  return s;
}

let S = normalize(fresh());
let cur = new Date(); cur.setDate(1); cur.setHours(0, 0, 0, 0);
const ck = () => mkey(cur);

// Copie d'un modèle dans un mois
const inRange = (t, k) => (!t.from || k >= t.from) && (!t.until || k <= t.until);     // modèle limité dans le temps (ex. crédit)
const instance = (type, t) => ({ ...JSON.parse(JSON.stringify(t, (key, v) => key === 'from' || key === 'until' ? undefined : v)), id: uid(),
  ...(type === 'expenses' ? { status: 'Prévu', isFixed: true } : type === 'incomes' ? { status: 'En attente', isFixed: true } : {}) });

// Mois affiché. Créé à la volée à partir des modèles ; tant qu'il n'est pas modifié, c'est un « brouillon » non sauvegardé.
function month(k = ck()) {
  if (!S.months[k]) {
    const m = { bankBalance: null, savingGoal: null,
      expenses: S.templates.expenses.filter(t => inRange(t, k)).map(t => instance('expenses', t)),
      incomes: S.templates.incomes.filter(t => inRange(t, k)).map(t => instance('incomes', t)),
      budgets: S.templates.budgets.map(t => instance('budgets', t)) };
    Object.defineProperty(m, '_snap', { value: JSON.stringify(m), writable: true, configurable: true, enumerable: false });
    S.months[k] = m;
  }
  return S.months[k];
}
const isDraft = m => !!m && m._snap !== undefined && JSON.stringify(m) === m._snap;
const monthsFrom = k => Object.keys(S.months).filter(x => x >= k);

// Recopie des champs d'un modèle vers les mois ≥ fromKey (sauf éléments déjà payés / reçus)
function syncTpl(type, t, fields, fromKey = ck()) {
  monthsFrom(fromKey).forEach(k => {
    const l = S.months[k][type].find(x => x.tmplId === t.tmplId); if (!l) return;
    if (type !== 'budgets' && (l.status === 'Payé' || l.status === 'Reçu')) return;
    fields.forEach(f => { if (t[f] === undefined || t[f] === '') delete l[f]; else l[f] = t[f]; });
  });
}
function tplAdd(type, t, fromKey = ck()) {
  S.templates[type].push(t);
  monthsFrom(fromKey).filter(k => inRange(t, k)).forEach(k => S.months[k][type].push(instance(type, t)));
}
function tplDel(type, tmplId, fromKey = ck()) {
  S.templates[type] = S.templates[type].filter(t => t.tmplId !== tmplId);
  monthsFrom(fromKey).forEach(k => {
    const mm = S.months[k];
    mm[type] = mm[type].filter(y => {
      if (y.tmplId !== tmplId) return true;
      if (type !== 'budgets' && (y.status === 'Payé' || y.status === 'Reçu')) { y.isFixed = false; delete y.tmplId; return true; }
      return false;
    });
  });
}
const tplFields = type => type === 'expenses' ? ['name','amount','date','cat','isDivided','site','img'] : type === 'incomes' ? ['name','amount','date','site','img'] : ['cat','amount'];
function tplFrom(type, x) {
  const t = { tmplId: uid() };
  tplFields(type).forEach(f => { if (x[f] !== undefined && x[f] !== '') t[f] = x[f]; });
  return t;
}

// Catégorie déduite d'un libellé déjà utilisé
function autoCat(name) {
  const q = String(name || '').trim().toLowerCase(); if (q.length < 2) return null;
  for (const k of Object.keys(S.months).sort().reverse()) {
    const ex = S.months[k].expenses;
    for (let i = ex.length - 1; i >= 0; i--) if ((ex[i].name || '').trim().toLowerCase() === q && ex[i].cat) return ex[i].cat;
  }
  const t = S.templates.expenses.find(t => (t.name || '').trim().toLowerCase() === q);
  return t ? t.cat : null;
}
const isPaid = (x, type) => type === 'incomes' ? x.status === 'Reçu' : x.status === 'Payé';

/* ============================== 4. CALCULS ============================== */
// Virement entre mes comptes sans catégorie (simple transfert d'argent, pas une dépense)
const xferPlain = e => e.xfer?.kind === 'acc' && (!e.cat || e.cat === 'Virement');
// Dépensé dans une catégorie : dépenses du mois, charges fixes comprises (ex. virement courses de 150 € classé Alimentation)
const vspent = (m, c) => sum(m.expenses.filter(e => e.cat === c && !xferPlain(e)), eff);
const vfixed = (m, c) => sum(m.expenses.filter(e => e.isFixed && e.cat === c && !xferPlain(e)), eff);

// Variation du compte sur un mois : réelle pour les mois passés, projetée pour le mois en cours et les suivants
function monthFlow(m, key) {
  if (key < nowK())
    return sum(m.incomes.filter(i => i.status === 'Reçu')) - sum(m.expenses.filter(e => e.status === 'Payé'), cash) - num(m.savingGoal);
  return sum(m.incomes) - sum(m.expenses, cash) - num(m.savingGoal) - varRest(m, key).v;
}
// Dépenses du quotidien (hors charges fixes et virements entre mes comptes)
const isDaily = e => !e.isFixed && !xferPlain(e);
// Ce que tu dépenses d'habitude APRÈS le jour « from » (6 derniers mois terminés) → moyenne, écart, nombre de mois
let histCache = { sig: '', r: {} };
function histVar(from) {
  const ks = Object.keys(S.months).filter(x => x < nowK() && !isDraft(S.months[x]) && S.months[x].expenses.some(isDaily)).sort().slice(-6);
  const sig = ks.map(x => x + ':' + S.months[x].expenses.length + ':' + sum(S.months[x].expenses, cash)).join('|');
  if (histCache.sig !== sig) histCache = { sig, r: {} };
  if (histCache.r[from]) return histCache.r[from];
  const vals = ks.map(x => { const D = dim(x); return sum(S.months[x].expenses.filter(isDaily), e => { const d = parseInt(e.date); return cash(e) * (d ? (d > from ? 1 : 0) : Math.max(0, (D - from) / D)); }); });
  const n = vals.length, mean = n ? vals.reduce((s, v) => s + v, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : mean * .3;
  return histCache.r[from] = { mean, sd, n };
}
// Dépenses du quotidien encore à prévoir ce mois-ci, d'après l'historique (déduction faite de celles déjà saisies pour plus tard)
function varRest(m, key) {
  const cur = key === nowK(), from = cur ? today() : 0, h = histVar(from);
  if (!h.n) return { v: 0, sd: 0, n: 0, h, from };
  const ahead = sum(m.expenses.filter(e => isDaily(e) && (!cur || (e.status !== 'Payé' && parseInt(e.date) > from))), cash);
  return { v: Math.max(0, h.mean - ahead), sd: h.sd, n: h.n, h, from, ahead };
}
// Solde au 1er du mois : dernier solde réel saisi (ce mois-ci ou avant) + variations des mois intermédiaires
function chainBalance(targetKey) {
  let bal = 0;
  for (const key of Object.keys(S.months).sort()) {
    if (key > targetKey) break;
    const m = S.months[key];
    if (m.bankBalance != null) bal = num(m.bankBalance);
    if (key === targetKey) return bal;
    bal += monthFlow(m, key);
  }
  return bal;
}
function calc(m, key) {
  const ex = m.expenses, inc = m.incomes, fx = ex.filter(e => e.isFixed), vr = ex.filter(e => !e.isFixed);
  const bcats = new Set(m.budgets.map(b => b.cat));
  const r = {
    incAll: sum(inc), incIn: sum(inc.filter(i => i.status === 'Reçu')),
    outAll: sum(ex, cash), outPaid: sum(ex.filter(e => e.status === 'Payé'), cash), outPlan: sum(ex.filter(e => e.status !== 'Payé'), cash),
    fixAll: sum(fx, cash), fixPaid: sum(fx.filter(e => e.status === 'Payé'), cash),
    varAll: sum(vr, cash), outMine: sum(ex, eff),          // outMine : ce que les dépenses m'ont coûté (stats)
    budAll: sum(m.budgets),
    budLeft: sum(m.budgets, b => Math.max(0, num(b.amount) - vspent(m, b.cat))),
    budEff: sum(m.budgets, b => Math.max(num(b.amount), vspent(m, b.cat))),   // budget, ou dépensé s'il est dépassé
    varOut: sum(vr.filter(e => !bcats.has(e.cat) && !xferPlain(e)), eff),   // dépenses variables hors budget
    xferOut: sum(vr.filter(xferPlain), eff),                   // virements vers mes autres comptes
    saving: num(m.savingGoal)
  };
  // charges fixes rangées dans une catégorie qui a un budget : elles comptent dans le budget, pas en « charges fixes »
  r.fixInBud = sum(fx.filter(e => bcats.has(e.cat) && !xferPlain(e)), cash); r.fixOut = r.fixAll - r.fixInBud;
  r.budPlan = sum(m.budgets, b => Math.max(num(b.amount), vfixed(m, b.cat)));
  r.fixLeft = r.fixAll - r.fixPaid;
  r.spent = r.fixPaid + r.varAll;
  r.planned = r.fixOut + r.budPlan + r.varOut + r.xferOut;
  r.free = r.incAll - r.fixOut - r.budEff - r.varOut - r.xferOut - r.saving;              // part des recettes non affectée (écran Budgets)
  r.init = chainBalance(key);
  r.bankSet = m.bankBalance != null;
  r.current = r.init + r.incIn - r.outPaid;
  r.flow = monthFlow(m, key);
  r.est = r.init + r.flow;
  r.past = key < nowK();
  r.vr = r.past ? null : varRest(m, key);                                         // dépenses habituelles encore à venir
  r.incWait = r.incAll - r.incIn;
  // Reste à vivre = solde actuel + recettes à venir − dépenses à payer − épargne prévue
  // (= ce qu'il restera fin de mois si tu ne dépenses plus rien ; les budgets se dépensent dedans)
  r.rav = r.past ? r.est : r.current + r.incWait - r.outPlan - r.saving;
  r.left = daysLeft(key);
  r.perDay = r.left > 0 ? Math.max(0, r.rav) / r.left : null;
  return r;
}
// Dépenses réellement engagées par catégorie (charges fixes payées + variables)
function catTotals(m) {
  const o = {};
  m.expenses.forEach(e => { const v = eff(e); if (v <= 0 || (e.isFixed && e.status !== 'Payé') || xferPlain(e)) return; o[e.cat] = (o[e.cat] || 0) + v; });
  return o;
}
// État d'une échéance : ok (réglée) / late (date passée) / plan (à venir)
function dueState(x, type, k) {
  if (isPaid(x, type)) return 'ok';
  const d = parseInt(x.date), n = nowK();
  if (k < n) return 'late';
  if (k === n && d && d < today()) return 'late';
  if (k === n && d && d === today()) return 'due';
  return 'plan';
}

/* ---------- Alertes ---------- */
const AL = () => { const A = S.alerts = S.alerts || {}; if (A.thr === undefined) A.thr = 0; if (A.pct === undefined) A.pct = 20; if (!Array.isArray(S.alerts.custom)) S.alerts.custom = []; return S.alerts; };
// Alertes personnalisées : catégorie, solde, grosse dépense, recette attendue, rappel
const ALT = {
  cat: { l: 'Une catégorie dépasse un montant', ic: 'pie' },
  bal: { l: 'Le solde passe sous un montant', ic: 'wallet' },
  big: { l: 'Une dépense dépasse un montant', ic: 'warn' },
  inc: { l: 'Une recette n\'est pas arrivée à une date', ic: 'trend' },
  rem: { l: 'Un rappel à une date du mois', ic: 'bell' }
};
function altLabel(a) {
  return a.t === 'cat' ? `${a.cat} dépasse ${eur0(a.amt)} dans le mois` : a.t === 'bal' ? `Solde actuel sous ${eur0(a.amt)}` : a.t === 'big' ? `Une dépense de plus de ${eur0(a.amt)}`
    : a.t === 'inc' ? `« ${a.name} » pas reçu le ${a.day}` : a.t === 'rem' ? `Le ${a.day} : ${a.text}` : '';
}
function customAlerts(m, k, c) {
  const o = [], cur = k === nowK(), td = today(), ct = catTotals(m);
  AL().custom.filter(a => a.on !== false).forEach(a => {
    const id = a.id;
    if (a.t === 'cat') { const v = ct[a.cat] || 0, q = num(a.amt); if (q > 0 && v > q) o.push({ id, lvl: 'bad', text: `${a.cat} : ${eur(v)} ce mois (ta limite : ${eur0(q)})`, go: 'mouvements', q: a.cat }); else if (q > 0 && v > q * .9) o.push({ id: id + '_90', lvl: 'warn', text: `${a.cat} : ${eur(v)}, bientôt ta limite de ${eur0(q)}`, go: 'mouvements', q: a.cat }); }
    if (a.t === 'bal' && cur && c.current < num(a.amt)) o.push({ id, lvl: 'bad', text: `Solde actuel ${eur(c.current)} : sous ton seuil de ${eur0(a.amt)}`, go: 'accueil' });
    if (a.t === 'big') m.expenses.filter(e => !e.isFixed && eff(e) > num(a.amt)).forEach(e => o.push({ id: id + '_' + e.id, lvl: 'warn', text: `Grosse dépense : ${e.name || e.cat} · ${eur(eff(e))}`, go: 'mouvements', q: e.name || e.cat }));
    if (a.t === 'inc' && (k < nowK() || (cur && td >= +a.day))) { const q = String(a.name || '').toLowerCase(); if (q && !m.incomes.some(i => i.status === 'Reçu' && String(i.name || '').toLowerCase().includes(q))) o.push({ id, lvl: 'bad', text: `« ${a.name} » toujours pas reçu (attendu le ${a.day})`, go: 'mouvements', q: a.name }); }
    if (a.t === 'rem' && cur && td >= +a.day && td <= +a.day + 2) o.push({ id: id + '_' + k, lvl: 'warn', text: '🔔 ' + a.text, go: 'accueil' });
  });
  return o;
}
function alerts(k = ck()) {
  const m = S.months[k], o = []; if (!m) return o;
  const c = calc(m, k), A = AL();
  if (k === nowK()) {
    const late = m.expenses.filter(e => e.isFixed && dueState(e, 'expenses', k) === 'late');
    if (late.length) o.push({ lvl: 'bad', text: `${late.length} charge${late.length > 1 ? 's' : ''} fixe${late.length > 1 ? 's' : ''} en retard · ${eur(sum(late, eff))}`, go: 'mouvements', flt: 'todo' });
  }
  o.push(...customAlerts(m, k, c));
  if (k === nowK() && typeof debtAlerts === 'function') o.push(...debtAlerts());
  if (k === nowK() && typeof stmAlerts === 'function') o.push(...stmAlerts());
  if (!c.past && c.est < num(A.thr)) o.push({ lvl: 'bad', text: `Fin de mois estimée : ${eur(c.est)} (seuil ${eur(A.thr)})`, go: 'accueil' });
  if (!c.past && c.rav < 0) o.push({ lvl: 'bad', text: `Reste à vivre négatif : ${eur(c.rav)}`, go: 'accueil' });
  m.budgets.forEach(b => {
    const s = vspent(m, b.cat), q = num(b.amount);
    if (q > 0 && s > q) o.push({ lvl: 'bad', text: `Budget ${b.cat} dépassé de ${eur(s - q)}`, go: 'budgets' });
    else if (q > 0 && s > q * .85) o.push({ lvl: 'warn', text: `Budget ${b.cat} presque atteint : ${eur(s)} sur ${eur(q)}`, go: 'budgets' });
  });
  const pv = Object.keys(S.months).sort().filter(x => x < k && !isDraft(S.months[x])).slice(-3);
  if (pv.length) {
    const n = catTotals(m), ps = pv.map(x => catTotals(S.months[x]));
    Object.entries(n).forEach(([cat, v]) => {
      const av = ps.reduce((s, q) => s + (q[cat] || 0), 0) / pv.length;
      if (av > 20 && v > av * (1 + num(A.pct) / 100))
        o.push({ lvl: 'warn', text: `${cat} : ${eur(v)}, soit +${Math.round((v / av - 1) * 100)} % par rapport à la moyenne`, go: 'mouvements', q: cat });
    });
  }
  return o.sort((a, b) => (a.lvl === 'bad' ? 0 : 1) - (b.lvl === 'bad' ? 0 : 1));
}

/* ============================== 5. COMPTES, SYNCHRO & SAUVEGARDES ==============================
   Firestore :
     users/{uid}                    profil : email, liste des comptes, dernières lectures (messagerie)
     accounts/{id}                  un compte bancaire : nom, banque, membres, réglages (meta), résumé
     accounts/{id}/months/{AAAA-MM} un document par mois (mouvements, budgets, solde du 1er…)
     accounts/{id}/activity/…       journal des modifications (comptes partagés)
     accounts/{id}/backups/…        sauvegardes automatiques
     invites/{compte}_{email}       invitations à rejoindre un compte
   Chaque modification n'envoie que les mois changés. Si quelqu'un d'autre a modifié le même mois
   entre-temps, les deux versions sont fusionnées élément par élément (rien n'est écrasé).            */
const FV = firebase.firestore.FieldValue;
const accDoc = id => db.collection('accounts').doc(id);
const monthCol = id => accDoc(id).collection('months');
const userDoc = (u = currentUser.uid) => db.collection('users').doc(u);
const legacyDoc = (u = currentUser.uid) => userDoc(u).collection('data').doc('budget');
const myEmail = () => String(currentUser?.email || '').toLowerCase();

let loaded = false;                 // compte actif chargé
let ACC = {};                       // comptes connus : id -> document (nom, banque, membres, résumé…)
let accIds = [];                    // comptes de l'utilisateur, dans l'ordre
let active = null;                  // compte affiché
let USER = null;                    // document users/{uid}
let subs = [], accSubs = [], listSubs = {}, actSubs = {};
let base = {}, sent = {};           // par clé ('meta' ou 'AAAA-MM') : dernière version serveur intégrée / dernière envoyée
let saveTimer = null, synced = false, migrating = false, startedAt = 0;
let INV = { in: [], out: [] }, ACT = {}, XF = { in: [], out: [] };
// Épargne personnelle (comptes d'épargne simples, simulateur, choix d'inclusion) : rattachée à l'utilisateur, pas à un compte
let U = { savAcc: [], savings: null, savIncl: {} }, userSaveTimer = null;
function loadU(d) { if (userSaveTimer) return; U = { savAcc: (d && d.savAcc) || [], savings: (d && d.savings) || null, savIncl: (d && d.savIncl) || {}, contacts: (d && d.contacts) || [], recvAcc: (d && d.recvAcc) || null, recvHide: (d && d.recvHide) || [], xfHide: (d && d.xfHide) || [], xfAcc: (d && d.xfAcc) || {}, goals: (d && d.goals) || [] }; publishDir(); }
function saveUser() {
  if (!currentUser) return; clearTimeout(userSaveTimer);
  userSaveTimer = setTimeout(() => { userSaveTimer = null; userDoc().set({ savAcc: U.savAcc, savings: U.savings, savIncl: U.savIncl, contacts: U.contacts || [], recvAcc: U.recvAcc || null, recvHide: U.recvHide || [], xfHide: (U.xfHide || []).slice(-300), xfAcc: U.xfAcc || {}, goals: U.goals || [] }, { merge: true }).catch(e => toast('⚠ Épargne non enregistrée (' + (e.code || 'erreur') + ')')); }, 600);
}
const isSavAcc = (id = active) => ACC[id]?.kind === 'epargne';
// La session affichée est-elle toujours celle de l'utilisateur connecté ? (autre onglet connecté avec un autre compte)
const sameUser = () => !!currentUser && !!auth.currentUser && auth.currentUser.uid === currentUser.uid;
const isShared = (id = active) => (ACC[id]?.members || []).length > 1;
const accName = (id = active) => ACC[id]?.name || 'Compte';

/* ---------- Découpage des données : réglages + un bloc par mois ---------- */
// Texte canonique (clés triées) : deux versions identiques donnent toujours le même texte, sur tous les appareils
const sortKeys = o => Array.isArray(o) ? o.map(sortKeys) : (o && typeof o === 'object') ? Object.keys(o).sort().reduce((r, k) => (r[k] = sortKeys(o[k]), r), {}) : o;
const canon = o => JSON.stringify(sortKeys(o));
function metaOf(s) { const o = {}; Object.keys(s).forEach(k => { if (k !== 'months') o[k] = s[k]; }); return canon(o); }
function parts() {
  const p = { meta: metaOf(S) };
  for (const [k, m] of Object.entries(S.months)) {
    if (m._snap !== undefined) { if (JSON.stringify(m) === m._snap) continue; delete m._snap; }   // mois seulement consulté
    p[k] = canon(m);
  }
  return p;
}
function snapshot() {
  const p = parts(), o = JSON.parse(p.meta); o.months = {};
  Object.keys(p).sort().forEach(k => { if (k !== 'meta') o.months[k] = JSON.parse(p[k]); });
  return JSON.stringify(o);
}

/* ---------- Fusion de deux versions (base commune, la mienne, la distante) ---------- */
const J = s => s ? JSON.parse(s) : null;
const js = x => JSON.stringify(x);
function mergeList(b = [], l = [], r = [], key = 'id') {
  const bm = new Map(b.map(x => [x[key], js(x)])), lm = new Map(l.map(x => [x[key], x])), rm = new Map(r.map(x => [x[key], x]));
  const out = [];
  r.forEach(x => {
    const id = x[key], bx = bm.get(id), lx = lm.get(id), rs = js(x);
    if (!lx) { if (bx !== undefined && bx === rs) return; out.push(x); return; }        // supprimé chez moi
    out.push(js(lx) !== bx && rs === bx ? lx : x);                                       // modifié seulement chez moi
  });
  l.forEach((x, i) => { const id = x[key]; if (rm.has(id) || bm.has(id)) return; i === 0 ? out.unshift(x) : out.push(x); });  // ajouts
  return out;
}
const pick = (b, l, r) => js(l) !== js(b) ? l : r;
function mergeMonth(b, l, r) {
  b = b || {}; const o = Object.assign({}, r);
  ['expenses','incomes','budgets'].forEach(f => o[f] = mergeList(b[f], l[f], r[f]));
  ['bankBalance','savingGoal'].forEach(f => o[f] = pick(b[f], l[f], r[f]));
  return o;
}
function mergeMeta(b, l, r) {
  b = b || {}; const o = Object.assign({}, r);
  const bc = new Set(b.categories || []), lc = l.categories || [];
  o.categories = (r.categories || []).filter(c => !(bc.has(c) && !lc.includes(c))).concat(lc.filter(c => !bc.has(c) && !(r.categories || []).includes(c)));
  o.templates = {}; ['expenses','incomes','budgets'].forEach(t => o.templates[t] = mergeList(b.templates?.[t], l.templates?.[t], r.templates?.[t], 'tmplId'));
  o.savAcc = mergeList(b.savAcc, l.savAcc, r.savAcc);
  if (b.loans || l.loans || r.loans) o.loans = mergeList(b.loans, l.loans, r.loans);
  if (b.debts || l.debts || r.debts) o.debts = mergeList(b.debts, l.debts, r.debts);
  ['savings','alerts','goal','sav','cmDef'].forEach(f => { const v = pick(b[f], l[f], r[f]); if (v === undefined) delete o[f]; else o[f] = v; });
  return o;
}

/* ---------- Envoi ---------- */
function save() {
  if (!currentUser || !loaded || !active) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(pushCloud, 800);                     // regroupe les modifications rapprochées
}
function summaryOf() {
  const k = nowK(), c = calc(month(k), k);
  return { k, current: Math.round(c.current * 100) / 100, est: Math.round(c.est * 100) / 100, rav: Math.round(c.rav * 100) / 100 };
}
let allowDeletes = false;   // vrai seulement juste après une réinitialisation, une restauration ou un import
function pushCloud() {
  saveTimer = null;
  if (!currentUser || !loaded || !active || !sameUser()) return Promise.resolve();
  const id = active, p = parts(), batch = db.batch(), now = Date.now(), me = currentUser.uid;
  let n = 0, waiting = false;
  for (const [k, v] of Object.entries(p)) {
    if (sent[k] === v) continue;
    if (k === 'meta') { n++; continue; }                       // réglages : envoyés avec le document du compte
    if (k !== 'meta' && base[k] === undefined && !synced) { waiting = true; continue; }   // mois pas encore reçu du serveur : on attend
    sent[k] = v; n++;
    batch.set(monthCol(id).doc(k), { data: v, updatedAt: now, updatedBy: me });
  }
  if (allowDeletes) Object.keys(sent).filter(k => k !== 'meta' && !(k in p)).forEach(k => { batch.delete(monthCol(id).doc(k)); delete sent[k]; delete base[k]; n++; });
  allowDeletes = false;
  if (!n) { if (waiting) saveTimer = setTimeout(pushCloud, 1500); return Promise.resolve(); }
  const upd = { summary: summaryOf(), updatedAt: now, updatedBy: me };
  if (sent.meta !== p.meta) { upd.meta = p.meta; sent.meta = p.meta; }
  batch.update(accDoc(id), upd);
  if (waiting) saveTimer = setTimeout(pushCloud, 1500);
  return batch.commit().catch(e => { console.error(e); toast('⚠ Synchro refusée (' + (e.code || 'erreur') + ') — vérifie ta connexion'); });
}
function flush() { if (!saveTimer) return Promise.resolve(); clearTimeout(saveTimer); return pushCloud(); }
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', () => flush());

/* ---------- Réception ---------- */
// Intègre une version distante d'une clé ; renvoie true si l'affichage doit changer
function onRemote(key, R) {
  if (R == null) return false;
  if (R === sent[key]) { base[key] = R; return false; }        // écho de notre propre envoi
  const curStr = key === 'meta' ? metaOf(S) : (S.months[key] && !isDraft(S.months[key]) ? canon(S.months[key]) : null);
  let next = R;
  if (curStr != null && curStr !== base[key] && curStr !== R)
    next = canon(key === 'meta' ? mergeMeta(J(base[key]), J(curStr), J(R)) : mergeMonth(J(base[key]), J(curStr), J(R)));
  if (key === 'meta') { const o = JSON.parse(next); o.months = S.months; S = normalize(o); }
  else { S.months[key] = JSON.parse(next); S = normalize(S); }
  const norm = key === 'meta' ? metaOf(S) : canon(S.months[key]);
  if (next === R) { base[key] = sent[key] = norm; }
  else { base[key] = R; sent[key] = undefined; save(); }        // version fusionnée à renvoyer
  return true;
}

function stopAccount() {
  accSubs.forEach(u => u()); accSubs = [];
  clearTimeout(saveTimer); saveTimer = null;
  loaded = false; base = {}; sent = {}; synced = false;
}
function stopAll() {
  stopAccount();
  subs.forEach(u => u()); subs = [];
  Object.values(listSubs).forEach(u => u()); listSubs = {};
  Object.values(actSubs).forEach(u => u()); actSubs = {};
  ACC = {}; accIds = []; active = null; USER = null; INV = { in: [], out: [] }; ACT = {}; XF = { in: [], out: [] }; LINKS = []; PDEBTS = [];
  clearTimeout(userSaveTimer); userSaveTimer = null; U = { savAcc: [], savings: null, savIncl: {} };
}
function showScreen(w) {
  $('auth-screen').hidden = w !== 'auth';
  $('loading').hidden = w !== 'loading';
  $('app').hidden = w !== 'app';
}

// Ouvre un compte : réglages + tous ses mois, puis écoute les modifications
function openAccount(id) {
  if (!id) return;
  if (active && active !== id) flush();
  stopAccount(); closePanel(true);
  active = id; undoSnap = null; UI.calDay = null;
  try { localStorage.setItem('acc_' + currentUser.uid, id); } catch (e) {}
  if ($('app').hidden) showScreen('loading');
  let meta = null, gotMeta = false, gotMonths = false, months = {};
  const start = () => {
    if (loaded || !gotMeta || !gotMonths || active !== id) return;
    const o = meta ? JSON.parse(meta) : fresh(); o.months = {};
    Object.entries(months).forEach(([k, v]) => { o.months[k] = JSON.parse(v); });
    S = normalize(o);
    Object.keys(months).forEach(k => { base[k] = sent[k] = canon(S.months[k]); });   // versions normalisées : pas de réécriture inutile
    if (meta) base.meta = sent.meta = metaOf(S);
    loaded = true;
    // Ancienne épargne stockée dans le compte → déplacée vers l'utilisateur (une seule fois)
    if ((S.savAcc || []).length || S.savings) {
      const have = new Set(U.savAcc.map(a => a.id)); (S.savAcc || []).forEach(a => { if (!have.has(a.id)) U.savAcc.push(a); });
      if (S.savings && !U.savings) U.savings = S.savings;
      delete S.savAcc; delete S.savings; saveUser(); save();
    }
    if (UI.view === 'budgets' && isSavAcc(id)) UI.view = 'accueil';
    showScreen('app'); render();
    if (!meta) save();
    setTimeout(() => { if (active === id && loaded) { dailyBackup(); const s = summaryOf(); if (js(s) !== js(ACC[id]?.summary)) accDoc(id).update({ summary: s }).catch(() => {}); } }, 1500);
  };
  accSubs.push(accDoc(id).onSnapshot({ includeMetadataChanges: true }, d => {
    if (!d.exists) { if (!d.metadata.fromCache) accountGone(id); return; }
    ACC[id] = d.data();
    if (d.metadata.hasPendingWrites) return;
    if (!loaded) { meta = d.data().meta || null; gotMeta = true; return start(); }
    if (onRemote('meta', d.data().meta || null)) remoteToast(d.data().updatedBy); else renderChrome();
  }, err => { console.error(err); accountGone(id); }));
  accSubs.push(monthCol(id).onSnapshot({ includeMetadataChanges: true }, q => {
    if (!q.metadata.fromCache && !synced) { synced = true; }
    if (!loaded) { q.docs.forEach(d => months[d.id] = d.data().data); gotMonths = true; return start(); }
    let ch = false, by = null;
    q.docChanges().forEach(c => {
      if (c.doc.metadata.hasPendingWrites) return;
      if (c.type === 'removed' && q.metadata.fromCache) return;
      const k = c.doc.id;
      if (c.type === 'removed') { if (sent[k] !== undefined) { delete S.months[k]; delete sent[k]; delete base[k]; ch = true; } return; }
      if (onRemote(k, c.doc.data().data)) { ch = true; by = c.doc.data().updatedBy; }
    });
    if (ch) remoteToast(by);
  }, err => console.error(err)));
}
function remoteToast(by) {
  render();
  if (by && by !== currentUser.uid) toast('🔄 Modifié par ' + (ACC[active]?.memberEmails?.[by] || 'un autre membre'));
}
// Compte illisible (supprimé, partage retiré ou session changée) : masqué ici, JAMAIS retiré automatiquement de la liste
function accountGone(id) {
  if (!sameUser()) return;
  delete ACC[id]; accIds = accIds.filter(x => x !== id);
  if (active === id) { stopAccount(); active = null; const nx = accIds.find(x => x !== id); if (nx) openAccount(nx); }
  toast('Un compte n\'est plus accessible (supprimé ou partage retiré).');
}

/* ---------- Liste des comptes de l'utilisateur ---------- */
function syncAccountList(ids) {
  accIds = ids.slice();
  Object.keys(listSubs).filter(id => !ids.includes(id)).forEach(id => { listSubs[id](); delete listSubs[id]; delete ACC[id]; });
  ids.filter(id => !listSubs[id]).forEach(id => {
    listSubs[id] = accDoc(id).onSnapshot(d => {
      if (!d.exists) return;
      ACC[id] = d.data(); syncActivity(); if (XF.in.length) processTransfers(); publishDir();
      if (loaded) { renderChrome(); if (UI.view === 'comptes' || UI.view === 'messages' || (UI.view === 'parametres' && id === active) || (UI.view === 'budgets' && id !== active)) render(); }
    }, () => { if (USER && (USER.accounts || []).includes(id)) accountGone(id); });
  });
  if (!active || !ids.includes(active)) {
    let want = null; try { want = localStorage.getItem('acc_' + currentUser.uid); } catch (e) {}
    openAccount(ids.includes(want) ? want : ids[0]);
  }
  processTransfers();
}

// Première connexion avec cette version : l'ancien bloc de données devient le premier compte
async function migrateOrCreate() {
  if (migrating) return; migrating = true;
  try {
    // Sécurité : liste vérifiée sur le serveur + comptes dont je suis membre, avant de créer quoi que ce soit
    const ud = await userDoc().get({ source: 'server' });
    if (ud.exists && (ud.data().accounts || []).length) return;
    if (await repairAccounts()) return;
    let legacy = null;
    try { const d = await legacyDoc().get({ source: 'server' }); if (d.exists) legacy = d.data().budgetData || null; } catch (e) {}
    const o = legacy ? normalize(JSON.parse(legacy)) : normalize(fresh());
    const id = db.collection('accounts').doc().id, now = Date.now(), me = currentUser.uid, batch = db.batch();
    batch.set(accDoc(id), { name: 'Compte principal', bank: '', color: '#4338CA', owner: me, members: [me], memberEmails: { [me]: currentUser.email }, meta: metaOf(o), createdAt: now, updatedAt: now, updatedBy: me });
    batch.set(userDoc(), { email: currentUser.email, emailLower: myEmail(), accounts: FV.arrayUnion(id), migratedFromV1: !!legacy, createdAt: now }, { merge: true });
    await batch.commit();
    const ks = Object.keys(o.months);                               // les mois après la création du compte (règles de sécurité)
    for (let i = 0; i < ks.length; i += 400) {
      const b2 = db.batch(); ks.slice(i, i + 400).forEach(k => b2.set(monthCol(id).doc(k), { data: canon(o.months[k]), updatedAt: now, updatedBy: me })); await b2.commit();
    }
    if (legacy) toast('✅ Tes données sont maintenant dans « Compte principal ». Renomme-le dans Paramètres.');
  } catch (e) {
    console.error(e);
    $('loading').innerHTML = '⚠ Impossible de préparer tes comptes (' + esc(e.code || e.message) + ').<br>Vérifie les règles Firestore puis <button class="btn p" onclick="location.reload()">Réessayer</button>';
  } finally { migrating = false; }
}

/* ---------- Créer, renommer, partager, quitter, supprimer un compte ---------- */
// Retrouve les comptes dont je suis membre et les remet dans ma liste s'ils en ont disparu
async function repairAccounts() {
  try {
    const q = await db.collection('accounts').where('members', 'array-contains', currentUser.uid).get();
    const have = new Set((USER && USER.accounts) || []), miss = q.docs.map(d => d.id).filter(id => !have.has(id));
    if (!miss.length || !sameUser()) return q.docs.length > 0;
    await userDoc().set({ accounts: FV.arrayUnion(...miss) }, { merge: true });
    toast('🔧 ' + miss.length + ' compte' + (miss.length > 1 ? 's' : '') + ' retrouvé' + (miss.length > 1 ? 's' : '') + ' et remis dans ta liste');
    return true;
  } catch (e) { console.warn('Réparation', e.code); return false; }
}
async function createAccount({ name, bank, color, site, kind }) {
  const id = db.collection('accounts').doc().id, now = Date.now(), me = currentUser.uid, batch = db.batch();
  batch.set(accDoc(id), { name: name || 'Nouveau compte', bank: bank || '', site: site || '', kind: kind === 'epargne' ? 'epargne' : 'courant', color: color || '#4338CA', owner: me, members: [me], memberEmails: { [me]: currentUser.email }, meta: metaOf(normalize(fresh())), createdAt: now, updatedAt: now, updatedBy: me });
  batch.update(userDoc(), { accounts: FV.arrayUnion(id) });
  await batch.commit();
  return id;
}
async function inviteMember(email, id = active, name = accName(id)) {
  const to = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Adresse email invalide.');
  if (to === myEmail()) throw new Error('Tu ne peux pas t\'inviter toi-même.');
  if (Object.values(ACC[id]?.memberEmails || {}).some(e => String(e).toLowerCase() === to)) throw new Error('Cette personne est déjà membre.');
  await db.collection('invites').doc(id + '_' + to).set({ acc: id, accName: name, from: currentUser.uid, fromEmail: currentUser.email, to, status: 'pending', at: Date.now() });
}
async function acceptInvite(inv) {
  const me = currentUser.uid, batch = db.batch();
  batch.update(accDoc(inv.acc), { members: FV.arrayUnion(me), ['memberEmails.' + me]: currentUser.email });
  batch.update(db.collection('invites').doc(inv.id), { status: 'accepted', answeredAt: Date.now() });
  batch.set(userDoc(), { accounts: FV.arrayUnion(inv.acc) }, { merge: true });
  await batch.commit();
  try { localStorage.setItem('acc_' + me, inv.acc); } catch (e) {}
}
async function leaveAccount(id) {
  const a = ACC[id], me = currentUser.uid, others = (a.members || []).filter(x => x !== me);
  const upd = { members: FV.arrayRemove(me), ['memberEmails.' + me]: FV.delete() };
  if (a.owner === me) { if (!others.length) throw new Error('Tu es le seul membre : supprime le compte plutôt.'); upd.owner = others[0]; }
  const batch = db.batch();
  batch.update(accDoc(id), upd);
  batch.update(userDoc(), { accounts: FV.arrayRemove(id) });
  await batch.commit();
}
async function removeMember(id, uid) {
  await accDoc(id).update({ members: FV.arrayRemove(uid), ['memberEmails.' + uid]: FV.delete() });
}
async function deleteCol(ref) {
  const q = await ref.get();
  for (let i = 0; i < q.docs.length; i += 400) { const b = db.batch(); q.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
}
async function deleteAccountData(id) {
  if (id === active) stopAccount();
  for (const c of ['months', 'activity', 'backups']) await deleteCol(accDoc(id).collection(c));
  const inv = await db.collection('invites').where('acc', '==', id).where('from', '==', currentUser.uid).get().catch(() => ({ docs: [] }));
  await Promise.all(inv.docs.map(d => d.ref.delete()));
  await accDoc(id).delete();
  await userDoc().update({ accounts: FV.arrayRemove(id) });
}

/* ---------- Activité des comptes partagés (messagerie + notifications) ---------- */
function logActivity(text) {
  if (!text || !active || !isShared()) return;
  accDoc(active).collection('activity').add({ by: currentUser.uid, byEmail: currentUser.email, text: String(text).slice(0, 200), at: Date.now(), month: ck() }).catch(() => {});
}
function syncActivity() {
  const shared = accIds.filter(id => isShared(id));
  Object.keys(actSubs).filter(id => !shared.includes(id)).forEach(id => { actSubs[id](); delete actSubs[id]; delete ACT[id]; });
  shared.filter(id => !actSubs[id]).forEach(id => {
    actSubs[id] = accDoc(id).collection('activity').orderBy('at', 'desc').limit(30).onSnapshot(q => {
      ACT[id] = q.docs.map(d => ({ id: d.id, acc: id, ...d.data() }));
      q.docChanges().forEach(c => {
        const a = c.doc.data();
        if (c.type === 'added' && a.by !== currentUser.uid && a.at > startedAt) browserNotify((a.byEmail || 'Quelqu\'un') + ' · ' + (ACC[id]?.name || 'Compte joint'), a.text);
      });
      if (loaded) { renderChrome(); if (UI.view === 'messages') render(); }
    }, () => {});
  });
}
function unreadCount() {
  const seen = USER?.seen || {}, me = currentUser?.uid;
  const act = Object.entries(ACT).reduce((s, [id, l]) => s + l.filter(a => a.by !== me && a.at > (seen[id] || 0)).length, 0);
  return act + INV.in.filter(i => i.status === 'pending').length + linkPending().length + pendingForMe().length + invitesForMe().length + declinedForMe().length + XF.in.filter(t => t.status === 'received' && (t.receivedAt || 0) > (seen.xfer || 0) && !(U.xfHide || []).includes(t.id)).length;
}
function markSeen() {
  const upd = {}; Object.keys(ACT).forEach(id => { if ((ACT[id][0]?.at || 0) > (USER?.seen?.[id] || 0)) upd['seen.' + id] = Date.now(); });
  if (XF.in.some(t => (t.receivedAt || 0) > (USER?.seen?.xfer || 0))) upd['seen.xfer'] = Date.now();
  if (Object.keys(upd).length) userDoc().update(upd).catch(() => {});
}
function browserNotify(title, body) {
  try {
    if (!window.Notification || Notification.permission !== 'granted' || document.visibilityState !== 'hidden') return;
    const o = { body, icon: 'icon-192.png', badge: 'icon-192.png' };
    // iPhone (app installée) et Android n'acceptent les notifications que via le service worker
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, o)).catch(() => {});
    else new Notification(title, o);
  } catch (e) {}
}

/* ---------- Sauvegardes automatiques (par compte) ---------- */
const BK_MAX = 40;
let bkCache = {};
const bkCol = (id = active) => accDoc(id).collection('backups');
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hasContent = str => { try { const d = JSON.parse(str); return Object.keys(d.months || {}).length > 0 || ['expenses','incomes','budgets'].some(k => (d.templates?.[k] || []).length); } catch (e) { return false; } };
function backupNow(kind, data = snapshot()) {                  // la donnée est figée au moment de l'appel
  if (!currentUser || !loaded || !active || !hasContent(data)) return Promise.resolve(false);
  const id = kind === 'quotidienne' ? dayKey() : dayKey() + '_' + Date.now();
  return bkCol().doc(id).set({ budgetData: data, kind, by: currentUser.email, createdAt: Date.now() })
    .then(() => { pruneBackups(); return true; })
    .catch(e => { console.error('Sauvegarde', e); return false; });
}
function dailyBackup() {
  const id = active, data = snapshot();
  bkCol(id).doc(dayKey()).get({ source: 'server' })
    .then(d => { if (!d.exists && active === id) return backupNow('quotidienne', data); }).catch(() => {});
}
function pruneBackups() {
  bkCol().orderBy('createdAt', 'desc').get({ source: 'server' })
    .then(q => q.docs.slice(BK_MAX).forEach(d => d.ref.delete())).catch(() => {});
}

/* ---------- Connexion ---------- */
let lastUid = null;
auth.onAuthStateChanged(user => {
  if (lastUid && user && user.uid !== lastUid) { stopAll(); return location.reload(); }   // un autre onglet a changé d'utilisateur
  lastUid = user ? user.uid : lastUid;
  stopAll(); closePanel(true);
  if (!user) { currentUser = null; S = normalize(fresh()); showScreen('auth'); return; }
  currentUser = user; startedAt = Date.now();
  $('who').textContent = user.email;
  showScreen('loading');
  subs.push(userDoc().onSnapshot({ includeMetadataChanges: true }, d => {
    if (d.metadata.hasPendingWrites) return;
    const ids = d.exists ? (d.data().accounts || []) : [];
    if (!ids.length) { if (!d.metadata.fromCache) migrateOrCreate(); return; }
    USER = d.data(); loadU(USER);
    if (!repairAccounts.done) { repairAccounts.done = true; repairAccounts(); }
    if (!USER.emailLower) userDoc().set({ email: user.email, emailLower: myEmail() }, { merge: true }).catch(() => {});
    syncAccountList(ids);
    if (loaded) renderChrome();
  }, err => {
    console.error(err);
    $('loading').innerHTML = '⚠ Impossible de charger ton profil (' + esc(err.code) + '). Vérifie les règles Firestore.<br><button class="btn p" onclick="location.reload()">Réessayer</button>';
  }));
  const inv = (field, val, key) => db.collection('invites').where(field, '==', val).onSnapshot(q => {
    INV[key] = q.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at);
    if (key === 'in') q.docChanges().forEach(c => { if (c.type === 'added' && c.doc.data().status === 'pending' && c.doc.data().at > startedAt) browserNotify('Invitation à un compte partagé', (c.doc.data().fromEmail || '') + ' t\'invite sur « ' + (c.doc.data().accName || '') + ' »'); });
    if (loaded) { renderChrome(); if (UI.view === 'messages') render(); }
  }, err => console.warn('Invitations', err.code));
  subs.push(inv('to', myEmail(), 'in'), inv('from', user.uid, 'out'));
  subs.push(xfListen('to', myEmail(), 'in'), xfListen('from', user.uid, 'out'), linkListen(), pdebtListen());
});

/* ============================== 6. CONNEXION & COMPTE ============================== */
let isSignUp = false;
const authErr = (t, ok) => { const e = $('auth-error'); e.textContent = t; e.style.color = ok ? 'var(--ok)' : 'var(--bad)'; };
$('btn-toggle-auth').onclick = () => {
  isSignUp = !isSignUp;
  $('auth-title').textContent = isSignUp ? 'Créer un compte' : 'Connexion';
  $('btn-login').textContent = isSignUp ? "S'inscrire" : 'Se connecter';
  $('btn-toggle-auth').textContent = isSignUp ? 'Déjà un compte ? Se connecter' : 'Nouvel utilisateur ? Créer un compte';
  $('auth-pass-confirm').hidden = !isSignUp; $('btn-forgot').hidden = isSignUp;
  authErr('');
};
$('btn-login').onclick = () => {
  const email = $('auth-email').value.trim(), pass = $('auth-pass').value, conf = $('auth-pass-confirm').value;
  authErr('');
  if (!email || !pass) return authErr('Remplis l\'email et le mot de passe.');
  if (isSignUp && pass !== conf) return authErr('Les mots de passe ne correspondent pas.');
  (isSignUp ? auth.createUserWithEmailAndPassword(email, pass) : auth.signInWithEmailAndPassword(email, pass)).catch(error => {
    const M = { 'auth/email-already-in-use': 'Cet email est déjà utilisé.', 'auth/wrong-password': 'Email ou mot de passe incorrect.',
      'auth/user-not-found': 'Email ou mot de passe incorrect.', 'auth/invalid-credential': 'Email ou mot de passe incorrect.',
      'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.', 'auth/network-request-failed': 'Pas de connexion internet.',
      'auth/invalid-email': 'Adresse email invalide.' };
    authErr(M[error.code] || 'Erreur technique : ' + error.code);
  });
};
['auth-email','auth-pass','auth-pass-confirm'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-login').click(); }));
$('btn-forgot').onclick = () => {
  const email = $('auth-email').value.trim();
  if (!email) return authErr("Saisis d'abord ton adresse email.");
  auth.sendPasswordResetEmail(email)
    .then(() => authErr('📧 Si ce compte existe, un email de réinitialisation a été envoyé.', true))
    .catch(e => authErr(e.code === 'auth/invalid-email' ? 'Adresse email invalide.' : 'Erreur : ' + e.code));
};

// Demande le mot de passe actuel (ré-authentification), puis exécute l'action
function pwdDialog({ title, msg, needNew, okLabel, danger, action }) {
  const d = $('pwd-dlg');
  $('pwd-title').textContent = title; $('pwd-msg').textContent = msg || '';
  $('pwd-cur').value = ''; $('pwd-new').value = ''; $('pwd-err').textContent = '';
  $('pwd-new').hidden = !needNew;
  const ok = $('pwd-ok'); ok.textContent = okLabel;
  ok.style.background = danger ? 'var(--bad)' : ''; ok.style.borderColor = danger ? 'var(--bad)' : '';
  $('pwd-x').onclick = () => d.close();
  ok.onclick = async () => {
    const curP = $('pwd-cur').value, nw = $('pwd-new').value;
    if (!curP) return $('pwd-err').textContent = 'Mot de passe actuel requis.';
    if (needNew && nw.length < 6) return $('pwd-err').textContent = 'Le nouveau mot de passe doit faire au moins 6 caractères.';
    ok.disabled = true; $('pwd-err').textContent = '';
    try {
      await currentUser.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(currentUser.email, curP));
      await action(nw); d.close();
    } catch (e) {
      $('pwd-err').textContent = (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') ? 'Mot de passe incorrect.'
        : e.code === 'auth/network-request-failed' ? 'Pas de connexion internet.' : 'Erreur : ' + (e.code || e.message);
    } finally { ok.disabled = false; }
  };
  d.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } };
  d.showModal(); $('pwd-cur').focus();
}
const changePassword = () => pwdDialog({ title: 'Changer de mot de passe', needNew: true, okLabel: 'Mettre à jour',
  action: nw => currentUser.updatePassword(nw).then(() => toast('✅ Mot de passe mis à jour')) });
const deleteAccount = () => pwdDialog({ title: 'Supprimer mon profil', danger: true, okLabel: 'Supprimer définitivement',
  msg: "Action irréversible : tes comptes personnels, leurs données et sauvegardes seront supprimés. Tu quitteras les comptes partagés (les autres membres les gardent).",
  action: async () => {
    const u = currentUser.uid, ids = accIds.slice(), info = Object.assign({}, ACC);
    stopAccount();
    for (const id of ids) { const a = info[id]; if (!a) continue; if ((a.members || []).length > 1) await leaveAccount(id); else await deleteAccountData(id); }
    stopAll();
    await deleteCol(userDoc(u).collection('backups')).catch(() => {});
    await legacyDoc(u).delete().catch(() => {});
    await db.collection('directory').doc(myEmail()).delete().catch(() => {});
    await userDoc(u).delete().catch(() => {});
    await currentUser.delete();
    alert('Ton profil et tes données ont été définitivement supprimés.');
    location.reload();
  } });
function logout() {
  toast('Déconnexion…');
  Promise.race([flush(), new Promise(r => setTimeout(r, 1500))]).finally(() => { stopAll(); auth.signOut(); });
}
