
/* ============================== VÉRIFICATION AVEC LE RELEVÉ BANCAIRE ==============================
   On importe l'export de la banque (CSV, OFX ou QIF : Crédit Agricole, Boursorama, Revolut, la plupart des banques),
   puis on rapproche chaque opération de la banque d'une ligne de l'app (montant au centime, date proche, libellé).
   Ce qui reste explique l'écart : oublis, montants différents de quelques centimes, opérations qui s'annulent
   (ex. −22 € payés pour Marion puis +22 € remboursés : inutile de les saisir), « ½ Partagé » sans remboursement.
   Tout se fait dans le navigateur : le fichier n'est envoyé nulle part.                                            */
let BK = null;            // { lines:[{date,amt(centimes),label,h,i}], bal:{date,amt}|null, src, k }
const c2e = c => c / 100;
const cents = v => Math.round(num(v) * 100);
// Identifiant d'une opération : date | montant | début du libellé sans ponctuation (identique en CSV, Excel ou OFX)
const nk = s => nrm(s).replace(/[^a-z0-9]/g, '').slice(0, 24);
const bkHash = l => l.date + '|' + l.amt + '|' + nk(l.label);
const hkey = h => { const m = /^((?:[bxnug]:)?)(\d{4}-\d{2}-\d{2})\|(-?\d+)\|([^,]*)$/.exec(String(h)); return m ? m[1] + m[2] + '|' + m[3] + '|' + nk(m[4]) : h; };   // anciens identifiants
const nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = s => new Set(nrm(s).replace(/[^a-z ]/g, ' ').split(' ').filter(w => w.length >= 3 && !/^(sepa|prlv|prelevement|paiement|carte|vir|virement|achat|inst|recu|emis|faveur|vers|from|card|payment|transfer|europe|fr|france|sas|sarl)$/.test(w)));
function lsim(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach(w => { if ([...B].some(v => v.startsWith(w) || w.startsWith(v))) n++; }); return n / Math.min(A.size, B.size); }

/* ---------- Lecture du fichier ---------- */
function bkAmt(v) {
  let s = String(v ?? '').replace(/[\s  €$£]/g, '').replace(/EUR|USD|GBP/i, '');
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /-$/.test(s); s = s.replace(/[()]/g, '').replace(/-$/, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');          // 1.234,56
  else s = s.replace(/,/g, '');                                               // 1,234.56
  const n = parseFloat(s); if (!isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100);
}
function bkDate(v) {
  const s = String(v || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  return null;
}
function csvRows(txt) {
  const first = txt.split(/\r?\n/).slice(0, 30).join('\n'), cnt = c => (first.match(new RegExp('\\' + c, 'g')) || []).length;
  const sep = [';', ',', '\t'].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.map(r => r.map(x => x.replace(/\s+/g, ' ').trim()));
}
// Colonnes reconnues automatiquement d'après l'en-tête
function csvGuess(H) {
  const f = re => H.findIndex(h => re.test(nrm(h)));
  const g = { date: [/completed date/, /date (d.)?op/, /^dateop/, /^date$/, /date/].map(f).find(i => i >= 0) ?? -1,
    label: [/libelle/, /^label$/, /description/, /intitule/, /^nom|beneficiaire|tiers/, /memo|detail|operation/].map(f).find(i => i >= 0) ?? -1,
    amount: f(/^montant|^amount$|^somme|montant/), debit: f(/debit/), credit: f(/credit/), fee: f(/^fee$|^frais/), state: f(/^state$|^statut|^etat/), bal: f(/solde|balance/) };
  return g.date >= 0 && (g.amount >= 0 || g.debit >= 0 || g.credit >= 0) ? g : null;
}
function csvLines(rows, hi, g) {
  const out = [];
  rows.slice(hi + 1).forEach(r => {
    const date = bkDate(r[g.date]); if (!date) return;
    if (g.state >= 0 && /revert|declin|fail|annul|refus/i.test(r[g.state] || '')) return;
    let amt = null;
    if (g.amount >= 0) amt = bkAmt(r[g.amount]);
    if (amt == null && (g.debit >= 0 || g.credit >= 0)) { const d = bkAmt(r[g.debit]), c = bkAmt(r[g.credit]); if (d) amt = -Math.abs(d); else if (c) amt = Math.abs(c); }
    if (amt == null || amt === 0) return;
    if (g.fee >= 0) { const fe = bkAmt(r[g.fee]); if (fe) amt -= Math.abs(fe); }        // Revolut : frais en colonne à part
    out.push({ date, amt, label: (g.label >= 0 ? r[g.label] : '') || '', bal: g.bal >= 0 ? bkAmt(r[g.bal]) : null });
  });
  return out;
}
function bkParse(txt, name) {
  // OFX / QFX
  if (/<OFX>|<STMTTRN>/i.test(txt)) {
    const tag = (b, t) => (b.match(new RegExp('<' + t + '>([^<\\r\\n]*)', 'i')) || [])[1]?.trim() || '';
    const lines = (txt.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) || []).map(b => ({ date: bkDate(tag(b, 'DTPOSTED')), amt: bkAmt(tag(b, 'TRNAMT')), label: [tag(b, 'NAME'), tag(b, 'MEMO')].filter(Boolean).join(' ') })).filter(l => l.date && l.amt);
    const lb = txt.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)[\s\S]*?<DTASOF>([^<\r\n]+)/i);
    return { lines, bal: lb ? { amt: bkAmt(lb[1]), date: bkDate(lb[2]) } : null, src: 'OFX' };
  }
  // QIF
  if (/^!Type:/im.test(txt)) {
    const lines = txt.split(/^\^/m).map(b => ({ date: bkDate((b.match(/^D(.+)$/m) || [])[1]), amt: bkAmt((b.match(/^[TU](.+)$/m) || [])[1]), label: [(b.match(/^P(.+)$/m) || [])[1], (b.match(/^M(.+)$/m) || [])[1]].filter(Boolean).join(' ') })).filter(l => l.date && l.amt);
    return { lines, bal: null, src: 'QIF' };
  }
  // CSV : on cherche la ligne d'en-tête (le Crédit Agricole met des infos du compte au-dessus)
  const rows = csvRows(txt);
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const g = csvGuess(rows[i]); if (!g) continue;
    const lines = csvLines(rows, i, g); if (!lines.length) continue;
    const pre = rows.slice(0, i).map(r => r.join(' ')).join('\n'), sm = pre.match(/solde[^\n]*?(\d{1,2}\/\d{1,2}\/\d{2,4})[^\d\-\n]*(-?[\d\s .]*\d,\d{2})/i);
    let bal = sm ? { date: bkDate(sm[1]), amt: bkAmt(sm[2]) } : null;
    if (!bal && g.bal >= 0 && /balance/i.test(rows[i][g.bal]) && lines.some(l => l.bal != null)) bal = { running: true };      // Revolut : solde après chaque opération
    return { lines, bal, src: 'CSV', rows, hi: i, g };
  }
  return { lines: [], rows, need: true, src: 'CSV' };
}
async function bankImport(file) {
  $('bkfile').value = '';
  if (!file) return;
  const buf = await file.arrayBuffer();
  if (/\.xlsx?$/i.test(file.name) || new Uint8Array(buf.slice(0, 2)).join() === '80,75') {     // Excel (.xlsx commence par « PK »)
    try {
      if (!window.XLSX) { toast('Lecture du fichier Excel…'); await new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = ok; sc.onerror = ko; document.head.appendChild(sc); }); }
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';', blankrows: false });
      const r = bkParse(csv, file.name);
      if (r.need || !r.lines.length) return r.rows && r.rows.length > 1 ? bkMapDialog(r.rows, file.name) : toast('Fichier Excel non reconnu');
      return bkStore(r, file.name);
    } catch (e) { return toast('⚠ Fichier Excel illisible (connexion ?) : essaie l\'export CSV'); }
  }
  let txt = new TextDecoder('utf-8').decode(buf);
  if (txt.includes('�')) try { txt = new TextDecoder('windows-1252').decode(buf); } catch (e) {}   // vieux exports en ISO-8859-1
  const r = bkParse(txt.replace(/^﻿/, ''), file.name);
  if (r.need || !r.lines.length) return r.rows && r.rows.length > 1 ? bkMapDialog(r.rows, file.name) : toast('Fichier non reconnu : exporte le relevé en CSV, Excel, OFX ou QIF');
  bkStore(r, file.name);
}
// Garde le relevé dans l'historique, puis ouvre le pointage avec tous les relevés connus
async function bkStore(r, name) {
  const all = [...new Set(r.lines.map(l => l.date.slice(0, 7)))].sort(), tr = all.filter(k => S.months[k] && (S.months[k].expenses.length || S.months[k].incomes.length));
  const k = tr.includes(ck()) ? ck() : tr[tr.length - 1] || all[all.length - 1];
  try { const s = await stmSave(r, name); toast('📄 Relevé enregistré : du ' + dmy(s.from) + ' au ' + dmy(s.to)); if (UI.view === 'releves') render(); return stmOpen(k); }
  catch (e) { toast('⚠ Relevé non enregistré (' + (e.code || e.message) + ') : pointage sans sauvegarde'); bkLoad(r, k); }
}
// Colonnes à choisir à la main si le format n'est pas reconnu
function bkMapDialog(rows, name) {
  const hi = rows.findIndex(r => r.filter(Boolean).length >= 3), H = rows[hi] || [], O = H.map((h, i) => (h || 'Colonne ' + (i + 1)) + ' (ex. ' + (rows[hi + 1]?.[i] || '').slice(0, 18) + ')'), NONE = '—';
  formDialog({ title: 'Quelles colonnes ?', intro: 'Le format de « ' + esc(name) + ' » n\'est pas reconnu automatiquement. Indique les colonnes du fichier.',
    fields: [{ id: 'd', label: 'Date', type: 'select', options: O, value: O[0] }, { id: 'l', label: 'Libellé', type: 'select', options: O, value: O[1] },
      { id: 'a', label: 'Montant (avec le signe −)', type: 'select', options: [NONE, ...O], value: O[2] },
      { id: 'db', label: 'ou : colonne Débit', type: 'select', options: [NONE, ...O], value: NONE }, { id: 'cr', label: 'et colonne Crédit', type: 'select', options: [NONE, ...O], value: NONE }],
    onSave: v => {
      const ix = s => O.indexOf(s), g = { date: ix(v.d), label: ix(v.l), amount: ix(v.a), debit: ix(v.db), credit: ix(v.cr), fee: -1, state: -1, bal: -1 };
      const lines = csvLines(rows, hi, g); if (!lines.length) { toast('Aucune opération lue avec ces colonnes'); return false; }
      setTimeout(() => bkStore({ lines, bal: null, src: 'CSV' }, name), 50);
    } });
}
function bkLoad(r, want) {
  r.lines.forEach((l, i) => { l.i = i; l.h = bkHash(l); l.label = l.label || '(sans libellé)'; });
  const all = [...new Set(r.lines.map(l => l.date.slice(0, 7)))].sort(), tracked = all.filter(k => S.months[k] && (S.months[k].expenses.length || S.months[k].incomes.length)), months = tracked.length ? tracked : all;
  const k = want && months.includes(want) ? want : months.includes(ck()) ? ck() : months.reduce((a, b) => r.lines.filter(l => l.date.startsWith(b)).length > r.lines.filter(l => l.date.startsWith(a)).length ? b : a, months[0]);
  BK = Object.assign(r, { months, k, acc: active });
  bkView();
}

/* ---------- Rapprochement ---------- */
function bkMatch(k) {
  const m = month(k), ign = new Set((m.rec?.ign || []).map(hkey));
  const pk = kAdd(k, -1);
  const B = BK.lines.filter(l => l.date.startsWith(k)).map(l => { const b = Object.assign({}, l, { day: +l.date.slice(8, 10) });
    const cd = l.label.match(/\b(\d{2})\/(\d{2})\b(?!\/\d)/);                       // date de l'achat par carte (« 30/09 ») : débité 1 à 3 jours après
    if (cd && +cd[1] >= 1 && +cd[1] <= 31) { const mm = cd[2]; if (mm === k.slice(5) && +cd[1] <= b.day) b.op = +cd[1]; else if (mm === pk.slice(5) && b.day <= 5) b.prev = true; }
    return b; });
  const A = [...m.expenses.filter(x => !x.nc).map(x => ({ x, t: 'expenses', amt: -cents(x.amount) })), ...m.incomes.map(x => ({ x, t: 'incomes', amt: cents(x.amount) }))]
    .filter(a => a.amt).map(a => Object.assign(a, { day: parseInt(a.x.date) || null, paid: isPaid(a.x, a.t), label: a.x.name || a.x.cat || '' }));
  const R = { k, B, A, ok: [], near: [], net: [], half: [], pairs: [], bOnly: [], ign: [], aOnly: [] };
  const usedB = new Set(), usedA = new Set();
  // 0. regroupements déjà décidés (remboursement compté en net)
  R.grp = [];
  (m.rec?.grp || []).forEach(g => { const bs = g.h.map(h => B.find(b => b.h === hkey(h) && !usedB.has(b))), a = g.id ? A.find(x => x.x.id === g.id && !usedA.has(x)) : null;
    if (bs.every(Boolean) && (a || !g.id)) { bs.forEach(b => usedB.add(b)); if (a) usedA.add(a); R.grp.push({ a, bs, g }); } });
  const dd = (a, b) => a.day == null ? 12 : Math.min(Math.abs(a.day - b.day), b.op ? Math.abs(a.day - b.op) : 99);
  const take = (list, fn) => list.sort((p, q) => p.s - q.s).forEach(p => { if (usedA.has(p.a) || usedB.has(p.b)) return; usedA.add(p.a); usedB.add(p.b); fn(p); });
  // 1. même montant au centime (date la plus proche, libellé ressemblant)
  const P1 = []; A.forEach(a => B.forEach(b => { if (a.amt === b.amt) P1.push({ a, b, s: dd(a, b) - lsim(a.label, b.label) * 3 }); }));
  take(P1, p => R.ok.push(p));
  // 1b. le relevé contient la fin du mois précédent, que l'app ne suit pas : des lignes du début du mois dans l'app
  //     sont en fait passées en banque avant le 1er (ex. virement Super U du 30/09 noté le 1/10)
  const pm = S.months[pk], appPrev = pm && (pm.expenses.length || pm.incomes.length);
  R.prevInfo = !appPrev && BK.lines.some(l => l.date.startsWith(pk)); R.prevm = []; R.prevc = [];
  if (R.prevInfo) {
    const P = BK.lines.filter(l => l.date.startsWith(pk)).map(l => Object.assign({}, l, { day: +l.date.slice(8, 10) })), used = new Set(), PP = [];
    A.filter(a => !usedA.has(a) && (!a.day || a.day <= 7)).forEach(a => P.forEach(b => { if (a.amt === b.amt || (a.x.isDivided && a.t === 'expenses' && b.amt === -cents(cash(a.x)))) PP.push({ a, b, s: -b.day - lsim(a.label, b.label) * 3 }); }));
    PP.sort((p, q) => p.s - q.s).forEach(p => { if (usedA.has(p.a) || used.has(p.b)) return; usedA.add(p.a); used.add(p.b); R.prevm.push(p); });
  }
  // 2. « je n'ai noté que le net » : 1 ligne de l'app = 2 opérations de la banque (ex. −40 payé, +20 remboursé → −20)
  A.filter(a => !usedA.has(a)).forEach(a => {
    let best = null; const fb = B.filter(b => !usedB.has(b));
    fb.forEach(b1 => fb.forEach(b2 => { if (b1.i >= b2.i && Math.sign(b1.amt) === Math.sign(b2.amt) || b1 === b2 || b1.amt + b2.amt !== a.amt) return;
      const same = Math.sign(b1.amt) === Math.sign(b2.amt);
      if (same && (dd(a, b1) > 3 || dd(a, b2) > 3)) return;                     // payé en 2 fois : le même jour ou presque
      const s = Math.abs(b1.day - b2.day) + dd(a, b1) / 2; if (!best || s < best.s) best = { a, b: b1, b2, s, same }; }));
    if (best && best.s < 40) { usedA.add(a); usedB.add(best.b); usedB.add(best.b2); R.net.push(best); }
  });
  // 3. « ½ Partagé » : la banque a l'opération entière ; le remboursement de la moitié l'explique
  R.ok.filter(p => p.a.x.isDivided && p.a.t === 'expenses' && p.a.paid).forEach(p => {
    const h = Math.abs(p.a.amt) / 2, r = B.find(b => !usedB.has(b) && b.amt > 0 && Math.abs(b.amt - h) <= 1 && b.day >= p.b.day - 3);
    if (r) { usedB.add(r); R.half.push({ p, r }); } else R.half.push({ p, r: null, gap: Math.abs(p.a.amt) - cents(cash(p.a.x)) });
  });
  // 4. montant presque identique (quelques centimes / frais / taux de change)
  const P4 = []; A.filter(a => !usedA.has(a)).forEach(a => B.filter(b => !usedB.has(b)).forEach(b => {
    if (Math.sign(a.amt) !== Math.sign(b.amt)) return; const diff = Math.abs(a.amt - b.amt), ls = lsim(a.label, b.label);
    if (diff <= Math.max(100, Math.abs(b.amt) * 0.05) && (ls >= 0.5 || dd(a, b) <= 2)) P4.push({ a, b, s: diff / 100 + dd(a, b) - ls * 3 }); }));
  take(P4, p => R.near.push(p));
  // 5. opérations de la banque qui s'annulent entre elles (−22 / +22) : inutile de les saisir
  const rest = B.filter(b => !usedB.has(b) && !ign.has(b.h)), P5 = [];
  rest.forEach(b1 => rest.forEach(b2 => { if (b1.amt < 0 && b1.amt + b2.amt === 0) P5.push({ b: b1, b2, s: Math.abs(b1.day - b2.day) - lsim(b1.label, b2.label) * 3 }); }));
  P5.sort((p, q) => p.s - q.s).forEach(p => { if (usedB.has(p.b) || usedB.has(p.b2)) return; usedB.add(p.b); usedB.add(p.b2); R.pairs.push(p); });
  // 6. remboursement de dépenses : un virement reçu ≈ 1 à 3 paiements, dont au moins un pas noté dans l'app
  //    (ex. carte SNCF 15 € + billet 7,20 € payés pour quelqu'un, 22,50 € remboursés → 0,30 € de trop)
  R.approx = [];
  const okB = new Map(R.ok.map(p => [p.b, p.a]));
  const nog = new Set((m.rec?.nogrp || []).map(hkey));
  B.filter(b => !usedB.has(b) && !ign.has(b.h) && !nog.has(b.h) && b.amt > 0).sort((x, y) => y.amt - x.amt).forEach(c => {
    const cand = B.filter(b => b.amt < 0 && (!usedB.has(b) || okB.has(b)) && !ign.has(b.h) && (b.op || b.day) >= c.day - 7 && (b.op || b.day) <= c.day && !R.approx.some(g => g.D.includes(b)));
    const tol = 50; let best = null;
    const test = D => {
      const fr = D.filter(b => !usedB.has(b)); if (!fr.length) return;
      if (D.length > 1 && Math.max(...D.map(b => b.op || b.day)) - Math.min(...D.map(b => b.op || b.day)) > 2) return;
      const diff = c.amt + D.reduce((t, b) => t + b.amt, 0); if (Math.abs(diff) > tol) return;
      if (diff && c.amt % 50) return;                                         // montant approché : on rembourse un compte rond (22,50 €, 20 €…)
      // un paiement déjà noté dans l'app n'entre dans le groupe que s'il ressemble à un paiement non noté (même jour ou même commerce)
      if (D.some(b => usedB.has(b) && !fr.some(f => Math.abs(f.day - b.day) <= 2 || lsim(f.label, b.label) >= 0.5))) return;
      const ds = D.map(b => b.day), sc = Math.abs(diff) / 10 + D.length + (Math.max(...ds) - Math.min(...ds)) / 3 - (D.length > 1 ? lsim(D[0].label, D[1].label) * 2 : 0);
      if (!best || sc < best.sc) best = { c, D, diff, sc };
    };
    for (let i = 0; i < cand.length; i++) { test([cand[i]]); for (let j = i + 1; j < cand.length; j++) { test([cand[i], cand[j]]); for (let l = j + 1; l < cand.length; l++) test([cand[i], cand[j], cand[l]]); } }
    if (best) { usedB.add(c); best.free = best.D.filter(b => !usedB.has(b)); best.apps = best.D.map(b => okB.get(b)).filter(Boolean); best.D.forEach(b => usedB.add(b));
      // la différence est peut-être déjà notée à la main (ex. « +0,30 € surplus Marion »)
      if (best.diff) { const na = A.find(a => !usedA.has(a) && a.amt === best.diff && (!a.day || Math.abs(a.day - c.day) <= 5)); if (na) { usedA.add(na); best.netA = na; } }
      R.approx.push(best); }
  });
  B.filter(b => !usedB.has(b)).forEach(b => (R.prevInfo && b.prev ? R.prevc : ign.has(b.h) ? R.ign : R.bOnly).push(b));
  R.aOnly = A.filter(a => !usedA.has(a));
  R.unpaid = R.ok.filter(p => !p.a.paid).concat(R.near.filter(p => !p.a.paid), R.net.filter(p => !p.a.paid));
  R.last = B.reduce((x, b) => b.day > x ? b.day : x, 0);
  R.start = [];
  R.pend = R.aOnly.filter(a => a.paid && a.t === 'expenses' && a.day && R.last && a.day >= R.last - 2);   // notés à l'avance : carte pas encore débitée
  return R;
}
// Début de mois : des lignes de l'app du début du mois déjà passées en banque avant le 1er (donc dans le solde de départ),
// et des achats par carte du mois précédent débités le 1er. Si elles expliquent exactement l'écart de départ, ce n'est pas une erreur.
function bkStart(R, after, rest) {
  if (!rest) return;
  const ca = R.aOnly.filter(a => a.paid && !after.includes(a) && !R.pend.includes(a) && (!a.day || a.day <= 7)).map(a => [a, a.t === 'expenses' ? cents(cash(a.x)) : -a.amt]);
  const cb = R.bOnly.filter(b => b.prev || b.day <= 3).map(b => [b, b.amt]);
  const C = ca.concat(cb).slice(0, 18); let best = null;
  for (let mask = 1; mask < 1 << C.length; mask++) {
    let t = 0, n = 0; for (let i = 0; i < C.length; i++) if (mask & 1 << i) { t += C[i][1]; n++; }
    if (t === -rest && (!best || n > best.n)) best = { mask, n };
  }
  if (!best) return;
  const T = C.filter((_, i) => best.mask & 1 << i).map(c => c[0]);
  R.start = T; R.aOnly = R.aOnly.filter(a => !T.includes(a)); R.bOnly = R.bOnly.filter(b => !T.includes(b));
}
// Solde de la banque en fin de relevé (fichier ou saisi) et solde de l'app à la même date
function bkBalances(R) {
  const m = month(R.k), c = calc(m, R.k), saved = m.rec?.bank;
  let bank = null, date = null;
  if (BK.bal?.running) { const L = R.B.filter(b => b.bal != null).sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i); const l = L[L.length - 1]; if (l) { bank = l.bal; date = l.date; } }
  else if (BK.bal?.amt != null && BK.bal.date?.startsWith(R.k)) { bank = BK.bal.amt; date = BK.bal.date; }
  if (UI.bkBal != null) { bank = UI.bkBal; date = null; }
  else if (bank == null && saved && saved.k === R.k) bank = saved.amt;
  const lastDay = date ? +date.slice(8, 10) : R.last;
  // l'app au jour du relevé : sans ce qui est noté payé après cette date
  const after = R.A.filter(a => a.paid && a.day && a.day > lastDay && !R.ok.some(p => p.a === a) && !R.net.some(p => p.a === a) && !R.near.some(p => p.a === a));
  const app = cents(c.current) - after.reduce((s, a) => s + (a.t === 'expenses' ? -cents(cash(a.x)) : a.amt), 0);
  return { bank, app, after, lastDay, init: cents(c.init) };
}
// Ce qui explique l'écart, en centimes (banque − app)
function bkExplain(R, after) {
  const E = [];
  const add = (txt, v) => { if (v) E.push([txt, v]); };
  add('Opérations seulement à la banque', R.bOnly.reduce((s, b) => s + b.amt, 0));
  add('Remboursements à vérifier', R.approx.reduce((s, g) => s + g.c.amt + g.free.reduce((t, b) => t + b.amt, 0) - (g.netA && g.netA.paid ? g.netA.amt : 0), 0));
  add('Opérations ignorées', R.ign.reduce((s, b) => s + b.amt, 0));
  add('Montants différents', R.near.filter(p => p.a.paid).reduce((s, p) => s + p.b.amt - p.a.amt, 0));
  add('Passées en banque mais « à payer » dans l\'app', R.unpaid.reduce((s, p) => s + p.b.amt + (p.b2 ? p.b2.amt : 0), 0));
  add('Paiements carte pas encore débités', R.pend.filter(a => !after.includes(a)).reduce((s, a) => s + cents(cash(a.x)), 0));
  add('Notées payées dans l\'app, pas dans le relevé', -R.aOnly.filter(a => a.paid && !after.includes(a) && !R.pend.includes(a)).reduce((s, a) => s + (a.t === 'expenses' ? -cents(cash(a.x)) : a.amt), 0));
  add('« ½ Partagé » : la banque a le montant entier', -R.half.filter(h => !h.r && h.p.a.paid).reduce((s, h) => s + h.gap, 0));
  add('« ½ Partagé » : arrondi au centime', R.half.filter(h => h.r && h.p.a.paid).reduce((s, h) => s + (Math.abs(h.p.a.amt) - h.r.amt) - cents(cash(h.p.a.x)), 0) * -1);
  return E;
}

/* ---------- Écran ---------- */
function bankCheck() { go('releves'); }
function bkLine(b, acts = '') {
  return `<div class="row bkl"><span class="bkd">${b.date.slice(8, 10)}/${b.date.slice(5, 7)}</span><span class="rt"><span class="rn" title="${esc(b.label)}">${esc(bkShow(b.label))}</span></span><b class="num ${b.amt > 0 ? 'pos' : ''}">${b.amt > 0 ? '+' : ''}${eur(c2e(b.amt))}</b>${acts ? `<span class="chips">${acts}</span>` : ''}</div>`;
}
const aLbl = a => `${esc(a.label)}${a.day ? ' · le ' + a.day : ''}`;
// Chaque écart = une carte : une proposition (corriger, ajouter…) ou « C'est normal ✓ » pour le valider
function bkItems(R, V, rest) {
  const I = [], d2 = b => b.date.slice(8, 10) + '/' + b.date.slice(5, 7), sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + eur(c2e(Math.abs(v)));
  const appRow = a => `<div class="row bkl"><span class="bkd">${a.day ? String(a.day).padStart(2, '0') : '—'}</span><span class="rt"><span class="rn">${esc(a.label)}</span><span class="rs">dans l'app</span></span><b class="num">${a.t === 'expenses' ? '−' + eur(eff(a.x)) : '+' + eur(c2e(a.amt))}</b></div>`;
  R.approx.forEach((g, i) => { const tot = -g.D.reduce((t, b) => t + b.amt, 0);
    I.push({ key: 'g:' + g.c.h, ic: '🤝', t: `Remboursement : reçu ${eur(c2e(g.c.amt))} pour ${eur(c2e(tot))} payés`, s: g.diff > 0 ? eur(c2e(g.diff)) + ' reçus en trop' + (g.D.length > 1 ? ' (' + g.D.map(b => eur(c2e(-b.amt))).join(' + ') + ')' : '') : g.diff < 0 ? 'il manque ' + eur(c2e(-g.diff)) : 'montant exact', imp: g.c.amt + g.free.reduce((t, b) => t + b.amt, 0) - (g.netA && g.netA.paid ? g.netA.amt : 0),
      body: bkLine(g.c) + g.D.map(b => bkLine(b, g.free.includes(b) ? '' : '<span class="note" style="font-size:12px">notée dans l\'app</span>')).join('') + (g.netA ? `<p class="note" style="font-size:12px;margin:4px 0 0">Différence déjà notée dans l'app : « ${esc(g.netA.label)} » ${sg(g.netA.amt)}</p>` : ''),
      acts: `<button class="btn sm p" data-gnet="${i}">Compter en net${g.netA ? ' (déjà noté)' : g.diff ? ' (' + sg(g.diff) + ')' : ''}</button><button class="btn sm" data-gdet="${i}">Tout détailler</button><button class="btn sm" data-gno="${i}">Pas lié</button>`,
      why: 'Compter en net : l\'app garde seulement la différence, sans gonfler tes dépenses et recettes.' }); });
  R.near.forEach(p => I.push({ key: 'n:' + p.b.h, ic: '⚠️', t: 'Montant différent : ' + p.a.label, s: `app ${eur(c2e(Math.abs(p.a.amt)))} · banque ${eur(c2e(Math.abs(p.b.amt)))} (${sg(p.b.amt - p.a.amt)})${p.a.x.fx ? ' · paiement en ' + p.a.x.fx.cur + ' : taux et frais de la banque' : ''}`, imp: p.a.paid ? p.b.amt - p.a.amt : p.b.amt,
    body: bkLine(p.b), acts: `<button class="btn sm p" data-fix="${p.a.x.id}" data-t="${p.a.t}" data-v="${Math.abs(p.b.amt)}"${p.a.paid ? '' : ' data-pay="1"'}>Corriger à ${eur(c2e(Math.abs(p.b.amt)))}</button>` }));
  R.bOnly.forEach(b => I.push({ key: 'b:' + b.h, ic: '🏦', t: 'Pas noté dans l\'app', s: bkShow(b.label), imp: b.amt, body: bkLine(b), acts: `<button class="btn sm p" data-add="${b.i}">Ajouter</button>` }));
  R.unpaid.forEach(p => I.push({ key: 'u:' + p.b.h, ic: '⏳', t: 'Passé en banque, « à payer » dans l\'app', s: p.a.label, imp: p.b.amt + (p.b2 ? p.b2.amt : 0), body: bkLine(p.b), acts: `<button class="btn sm p" data-paid="${p.a.x.id}" data-t="${p.a.t}">Marquer ${p.a.t === 'incomes' ? 'reçu' : 'payé'}</button>` }));
  R.aOnly.filter(a => a.paid && !V.after.includes(a) && !R.pend.includes(a)).forEach(a => I.push({ key: 'a:' + a.x.id, ic: '📱', t: 'Pas dans le relevé : ' + a.label, s: 'Oubli, doublon, ou pas encore passé ?', imp: a.t === 'expenses' ? cents(cash(a.x)) : -a.amt, body: appRow(a),
    acts: `<button class="btn sm" data-unpaid="${a.x.id}" data-t="${a.t}">Pas encore passé</button><button class="btn sm" data-open="${a.x.id}" data-t="${a.t}">Voir</button>` }));
  R.half.filter(h => !h.r).forEach(h => I.push({ key: 'h:' + h.p.a.x.id, ic: '½', t: '« ½ Partagé » sans remboursement : ' + h.p.a.label, s: `−${eur(c2e(Math.abs(h.p.a.amt)))} à la banque, ${eur(eff(h.p.a.x))} dans l'app`, imp: -h.gap, body: bkLine(h.p.b), acts: `<button class="btn sm p" data-unhalf="${h.p.a.x.id}">Enlever ½</button>` }));
  // cas reconnus comme normaux : un clic pour valider
  const pend = R.pend.filter(a => !V.after.includes(a));
  if (pend.length) I.push({ key: 'p:' + pend.map(a => a.x.id).sort().join(','), ic: '⏳', ok: 1, t: `Paiements carte pas encore débités (${pend.length})`, s: 'Notés à l\'avance : la banque les débite 1 à 3 jours après', imp: pend.reduce((s, a) => s + cents(cash(a.x)), 0), body: pend.map(appRow).join('') });
  if (R.prevInfo && rest != null) {
    const pmn = mlab(kAdd(R.k, -1)).split(' ')[0].toLowerCase(), mn = mlab(R.k).split(' ')[0].toLowerCase();
    const body = R.prevm.map(p => `<div class="row bkl"><span class="bkd">${d2(p.b)}</span><span class="rt"><span class="rn">${esc(p.a.label)}</span><span class="rs">noté le ${p.a.day || '?'} ${mn} · passé le ${d2(p.b)} : ${esc(bkShow(p.b.label))}</span></span><b class="num ${p.b.amt > 0 ? 'pos' : ''}">${p.b.amt > 0 ? '+' : ''}${eur(c2e(p.b.amt))}</b></div>`).join('')
      + R.prevc.map(b => bkLine(b, `<span class="note" style="font-size:12px">achat de ${pmn}</span>`)).join('');
    const sub = [R.prevm.length ? R.prevm.length + ' ligne(s) notée(s) début ' + mn + ', passée(s) fin ' + pmn : '', R.prevc.length ? R.prevc.length + ' achat(s) de ' + pmn + ' débité(s) en ' + mn : ''].filter(Boolean).join(' · ');
    if (!rest) I.push({ key: 's1:' + R.k + ':' + V.init, ic: '🗓', ok: 1, auto: 1, t: 'Solde au 1er cohérent avec le relevé', s: sub || 'Rien de particulier', imp: 0, body });
    else I.push({ key: 's1:' + R.k + ':' + V.init, ic: '🗓', t: 'Solde au 1er : ' + eur(c2e(V.init)) + ' dans l\'app, ' + eur(c2e(V.init + rest)) + ' d\'après le relevé', s: 'Calculé avec les opérations de fin ' + pmn + (sub ? ' (' + sub + ')' : ''), imp: rest, body,
      acts: `<button class="btn sm p" data-recal="${rest}" data-nc="1">Corriger à ${eur(c2e(V.init + rest))}</button>`,
      why: 'Le solde au 1er doit être le solde de ta banque au 30, moins ce que tu as noté début ' + mn + ' alors que c\'est passé avant, plus les achats de ' + pmn + ' débités en ' + mn + '.' });
  }
  if (R.start.length) I.push({ key: 's:' + R.start.map(z => z.x ? z.x.id : z.h).sort().join(','), ic: '🗓', ok: 1, t: 'Début de mois : déjà dans le solde de départ', s: 'Passées en banque avant le 1er, ou achats du mois précédent débités le 1er', imp: 0, body: R.start.map(z => z.x ? appRow(z) : bkLine(z)).join('') });
  R.pairs.forEach(p => I.push({ key: 'x:' + p.b.h, ic: '↔', ok: 1, t: 'S\'annulent : ' + eur(c2e(-p.b.amt)) + ' payé, ' + eur(c2e(p.b2.amt)) + ' reçu', s: 'Effet nul sur ton solde, pas besoin de les saisir', imp: 0, body: bkLine(p.b) + bkLine(p.b2) }));
  R.net.forEach(p => I.push({ key: 'm:' + p.a.x.id, ic: '➗', ok: 1, t: (p.same ? 'Payé en 2 fois : ' : 'Noté en net : ') + p.a.label, s: '1 ligne de l\'app = 2 opérations de la banque', imp: 0, body: appRow(p.a) + bkLine(p.b) + bkLine(p.b2) }));
  return I;
}
function bkView() {
  if (!BK) return;
  if (BK.acc !== active) { BK = null; return toast('Compte changé : relance la vérification'); }
  const R = bkMatch(BK.k), V = bkBalances(R);
  let E = bkExplain(R, V.after), expl = E.reduce((s, e) => s + e[1], 0);
  const gap = V.bank != null ? V.bank - V.app : null;
  if (gap != null && !R.prevInfo) { bkStart(R, V.after, gap - expl); if (R.start.length) { E = bkExplain(R, V.after); expl = E.reduce((s, e) => s + e[1], 0); } }
  const rest = gap != null ? gap - expl : null, m0 = month(BK.k), val = new Set((m0.rec?.val || []).map(hkey));
  const I = bkItems(R, V, rest), TODO = I.filter(i => !val.has(i.key) && !i.auto), DONE = I.filter(i => val.has(i.key) || i.auto), normal = TODO.filter(i => i.ok);
  const restH = R.prevInfo ? 0 : rest;                                  // avec le mois précédent dans le relevé, le solde au 1er devient une carte
  const done = gap != null && !TODO.length && !restH;
  const card = (i, v) => `<div class="bki${v ? ' val' : ''}${i.ok ? ' okc' : ''}"><div class="bkih"><span class="bkic">${i.ic}</span><span class="rt"><span class="rn">${esc(i.t)}</span><span class="rs">${esc(i.s)}</span></span>${i.imp ? `<b class="num bkimp">${i.imp > 0 ? '+' : '−'}${eur(c2e(Math.abs(i.imp)))}</b>` : ''}</div>
    ${v ? '' : `<details class="bkdet"><summary>Détail</summary>${i.body}${i.why ? `<p class="note" style="font-size:12px;margin:4px 0 0">${i.why}</p>` : ''}</details>`}
    <div class="chips">${v ? `<span class="note" style="font-size:12px">✓ ${i.auto ? 'vérifié automatiquement' : 'validé'}</span>${i.auto ? '' : `<button class="lnk" data-unval="${esc(i.key)}">Annuler</button>`}` : (i.acts || '') + `<button class="btn sm${i.ok ? ' p' : ''}" data-val="${esc(i.key)}">C'est normal ✓</button>`}</div></div>`;
  const d = $('dlg'); d.onclick = null; d.oninput = null; d.onchange = null;
  d.innerHTML = `<div class="dw bkw"><div class="dh"><h2>🏦 Pointage · ${esc(accName())}</h2><button class="ib sm" data-x aria-label="Fermer">${svg('x', 16, 2.4)}</button></div>
    ${BK.months.length > 1 ? `<label class="fl" style="margin:0">Mois<select class="in" id="bk-k">${BK.months.map(k => `<option value="${k}" ${k === BK.k ? 'selected' : ''}>${esc(mlab(k))} · ${BK.lines.filter(l => l.date.startsWith(k)).length} op.</option>`).join('')}</select></label>` : `<span class="note">${esc(mlab(BK.k))} · ${R.B.length} opérations du relevé</span>`}
    <div class="bkbal">
      <span><small>Banque${V.lastDay ? ' au ' + V.lastDay + '/' + BK.k.slice(5) : ''}</small><input class="in num" id="bk-bal" inputmode="decimal" placeholder="à saisir" value="${V.bank != null ? fmtIn(c2e(V.bank)) : ''}"></span>
      <span><small>App${V.after.length ? ' (même date)' : ''}</small><b class="num">${eur(c2e(V.app))}</b></span>
    </div>
    ${gap == null ? `<p class="note" style="font-size:13px">Saisis le solde affiché par ta banque${R.last ? ' au ' + R.last + '/' + BK.k.slice(5) : ''} pour calculer l'écart.</p>`
      : done ? `<div class="bkok">✓ Relevé pointé${gap ? ' · écart de ' + eur(c2e(gap)) + ' validé' : ' · aucun écart'}</div>`
      : `<div class="bkgap"><b>Écart : ${gap > 0 ? '+' : ''}${eur(c2e(gap))}</b> <span>(banque − app) · ${TODO.length} point${TODO.length > 1 ? 's' : ''} à vérifier</span>
        ${restH ? `<p>${rest === gap ? 'Aucune opération du mois ne l\'explique' : eur(c2e(rest)) + ' ne s\'expliquent pas par les opérations du mois'} : ça vient d'<b>avant ce mois</b> (solde au 1er). <button class="lnk" data-recal="${rest}">Corriger le solde au 1er de ${rest > 0 ? '+' : ''}${eur(c2e(rest))}</button></p>` : '<p>✓ Tout l\'écart s\'explique par les points ci-dessous.</p>'}
        <span class="bkprog"><i style="width:${I.length ? Math.round(DONE.length / I.length * 100) : 0}%"></i></span></div>`}
    ${normal.length > 1 ? `<button class="btn" data-valall>✓ Valider les ${normal.length} cas normaux reconnus</button>` : ''}
    ${TODO.length ? `<div class="bklist">${TODO.map(i => card(i, false)).join('')}</div>` : ''}
    ${DONE.length || R.grp.length || R.ign.length ? `<details class="bks"><summary><b>✓ Validés</b><span class="bkn">${DONE.length + R.grp.length + R.ign.length}</span></summary><div class="bkb">
      ${DONE.map(i => card(i, true)).join('')}
      ${R.grp.map(z => `<div class="bki val"><div class="bkih"><span class="bkic">🤝</span><span class="rt"><span class="rn">Remboursement compté en net</span><span class="rs">${z.a ? esc(z.a.label) + ' · ' + eur(c2e(z.a.amt)) : 'montant exact'}</span></span></div><div class="chips"><span class="note" style="font-size:12px">✓ validé</span><button class="lnk" data-gundo="${esc(z.g.h[0])}">Annuler</button></div></div>`).join('')}
      ${R.ign.map(b => bkLine(b, `<button class="lnk" data-unign="${esc(b.h)}">Annuler</button>`)).join('')}</div></details>` : ''}
    <details class="bks"><summary><b>Pointées automatiquement</b><span class="bkn">${R.ok.length + R.half.filter(h => h.r).length}</span></summary><div class="bkb">${R.ok.map(p => `<div class="row bkl"><span class="bkd">${p.b.date.slice(8, 10)}/${p.b.date.slice(5, 7)}</span><span class="rt"><span class="rn">${aLbl(p.a)}</span><span class="rs">${esc(bkShow(p.b.label))}</span></span><b class="num ${p.b.amt > 0 ? 'pos' : ''}">${p.b.amt > 0 ? '+' : ''}${eur(c2e(p.b.amt))}</b></div>`).join('') + R.half.filter(h => h.r).map(h => bkLine(h.r, '<span class="note" style="font-size:12px">½ remboursé</span>')).join('')}</div></details>
    ${V.after.length ? `<p class="note" style="font-size:12px">${V.after.length} ligne(s) notée(s) après le ${V.lastDay} : pas encore dans ce relevé, non comptée(s).</p>` : ''}
    <div class="dact"><button class="btn" data-again>Déposer un relevé</button><button class="btn p" data-x>${done ? 'Terminé' : 'Fermer'}</button></div></div>`;
  // Mémorise le résultat (affiché dans Mouvements)
  const rec = m0.rec || {}, todo = gap == null ? I.length : TODO.length + (restH ? 1 : 0);
  if (rec.gap !== gap || rec.todo !== todo || rec.done !== done || !rec.at || Date.now() - rec.at > 60000) mutate(() => { const mm = month(BK.k); mm.rec = Object.assign({}, mm.rec, { at: Date.now(), gap, todo, done, n: R.B.length }); }, false);
  const re = () => setTimeout(bkView, 30), setVal = fn => { mutate(() => { const mm = month(BK.k); mm.rec = Object.assign({}, mm.rec); mm.rec.val = fn(mm.rec.val || []); }, false); re(); };
  d.onchange = e => { if (e.target.id === 'bk-k') { BK.k = e.target.value; UI.bkBal = null; re(); } if (e.target.id === 'bk-bal') { const v = e.target.value.trim(); UI.bkBal = v ? Math.round(parseAmt(v) * 100) : null; if (UI.bkBal != null) mutate(() => { month(BK.k).rec = Object.assign({}, month(BK.k).rec, { bank: { k: BK.k, amt: UI.bkBal } }); }, false); re(); } };
  d.onclick = e => {
    const b = e.target.closest('button,[data-x]'); if (!b) return; const k = BK.k;
    if (b.dataset.x !== undefined) { d.close(); BK = null; UI.bkBal = null; if (STM[active]) STM[active].at = 0; return render(); }
    if (b.dataset.again !== undefined) return $('bkfile').click();
    if (b.dataset.val) return setVal(v => [...new Set([...v, b.dataset.val])]);
    if (b.dataset.unval) return setVal(v => v.filter(z => hkey(z) !== b.dataset.unval));
    if (b.dataset.valall !== undefined) return setVal(v => [...new Set([...v, ...normal.map(i => i.key)])]);
    if (b.dataset.add) return bkAdd([R.B.find(x => x.i === +b.dataset.add)]), re();
    if (b.dataset.addall !== undefined) return bkAdd(R.bOnly), re();
    if (b.dataset.gnet) { const g = R.approx[+b.dataset.gnet], A_ = g.apps;
      if (A_.length && !confirm('Compter en net : ' + A_.map(a => '« ' + a.label + ' » ' + eur(c2e(Math.abs(a.amt)))).join(', ') + ' (payé pour l\'autre personne) sera retiré de l\'app' + (g.diff ? ', remplacé par une ligne de ' + (g.diff > 0 ? '+' : '−') + eur(c2e(Math.abs(g.diff))) : '') + '. Continuer ?')) return;
      const nid = g.netA ? g.netA.x.id : g.diff ? uid() : null, nm = 'Écart remboursement ' + bkName(g.D[0].label);
      mutate(() => { const mm = month(k);
        A_.forEach(a => { mm[a.t] = mm[a.t].filter(x => x.id !== a.x.id); });
        if (g.netA) { const x = mm[g.netA.t].find(y => y.id === g.netA.x.id); if (x) x.status = g.netA.t === 'incomes' ? 'Reçu' : 'Payé'; }
        else if (g.diff > 0) mm.incomes.unshift({ id: nid, name: nm, amount: c2e(g.diff), date: String(g.c.day), status: 'Reçu', isFixed: false, bk: 1 });
        else if (g.diff < 0) mm.expenses.unshift({ id: nid, name: nm, amount: c2e(-g.diff), date: String(g.c.day), status: 'Payé', cat: 'Autre', isFixed: false, isDivided: false, bk: 1 });
        mm.rec = Object.assign({}, mm.rec); mm.rec.grp = (mm.rec.grp || []).concat([{ h: [g.c.h, ...g.D.map(x => x.h)], id: nid, own: !!g.netA, rm: A_.map(a => ({ t: a.t, x: JSON.parse(JSON.stringify(a.x)) })) }]); }, 'Compté en net');
      return re(); }
    if (b.dataset.gdet) { const g = R.approx[+b.dataset.gdet]; bkAdd([g.c, ...g.free]); return re(); }
    if (b.dataset.gno) { const g = R.approx[+b.dataset.gno]; mutate(() => { const mm = month(k); mm.rec = Object.assign({}, mm.rec); mm.rec.nogrp = [...new Set([...(mm.rec.nogrp || []), g.c.h])]; }, false); return re(); }
    if (b.dataset.gundo) { const z = R.grp.find(x => x.g.h[0] === b.dataset.gundo); if (!z) return; mutate(() => { const mm = month(k); mm.rec.grp = (mm.rec.grp || []).filter(x => x !== mm.rec.grp.find(y => y.h[0] === z.g.h[0])); if (z.g.id && !z.g.own) { mm.incomes = mm.incomes.filter(x => x.id !== z.g.id); mm.expenses = mm.expenses.filter(x => x.id !== z.g.id); } (z.g.rm || []).forEach(r => { if (!mm[r.t].some(x => x.id === r.x.id)) mm[r.t].unshift(r.x); }); }, 'Regroupement annulé'); return re(); }
    if (b.dataset.ign) { mutate(() => { const mm = month(k); mm.rec = Object.assign({}, mm.rec); mm.rec.ign = [...new Set([...(mm.rec.ign || []), b.dataset.ign])]; }, false); return re(); }
    if (b.dataset.unign) { mutate(() => { const mm = month(k); mm.rec.ign = (mm.rec.ign || []).filter(h => hkey(h) !== hkey(b.dataset.unign)); }, false); return re(); }
    const item = () => month(k)[b.dataset.t].find(x => x.id === (b.dataset.fix || b.dataset.paid || b.dataset.unpaid || b.dataset.open));
    if (b.dataset.fix) { mutate(() => { const x = item(); if (x) { x.amount = c2e(+b.dataset.v); if (b.dataset.pay) x.status = b.dataset.t === 'incomes' ? 'Reçu' : 'Payé'; } }, 'Montant corrigé'); return re(); }
    if (b.dataset.paid) { mutate(() => { const x = item(); if (x) x.status = b.dataset.t === 'incomes' ? 'Reçu' : 'Payé'; }, false); return re(); }
    if (b.dataset.paidall !== undefined) { mutate(() => R.unpaid.forEach(p => { const x = month(k)[p.a.t].find(y => y.id === p.a.x.id); if (x) x.status = p.a.t === 'incomes' ? 'Reçu' : 'Payé'; }), 'Marquées passées'); return re(); }
    if (b.dataset.unpaid) { mutate(() => { const x = item(); if (x) x.status = b.dataset.t === 'incomes' ? 'En attente' : 'Prévu'; }, false); return re(); }
    if (b.dataset.unhalf) { mutate(() => { const x = month(k).expenses.find(y => y.id === b.dataset.unhalf); if (x) x.isDivided = false; }, '« ½ Partagé » retiré'); return re(); }
    if (b.dataset.open) { const t = b.dataset.t, id = b.dataset.open; d.close(); if (ck() !== k) { cur = new Date(+k.slice(0, 4), +k.slice(5) - 1, 1); } return openPanel(t, id); }
    if (b.dataset.recal) { const v = +b.dataset.recal; if (!b.dataset.nc && !confirm('Le solde au 1er ' + mlab(k).toLowerCase() + ' passera de ' + eur(c2e(V.init)) + ' à ' + eur(c2e(V.init + v)) + '. Continuer ?')) return;
      mutate(() => { month(k).bankBalance = c2e(V.init + v); }, 'Solde au 1er corrigé'); return re(); }
  };
  if (!d.open) d.showModal();
}
// Ajoute dans l'app des opérations vues seulement à la banque
const bkName = s => { let t = bkShow(s).split(' · ')[0].replace(/^(paiement par carte|carte|cb|achat cb|prlv sepa|prelevement|prélèvement|vir(ement)?( sepa)?( inst(antane)?)?( re[çc]u| emis| émis)?( de| vers| en faveur de)?)\s+/i, '').replace(/\b\d{2}[\/.]\d{2}([\/.]\d{2,4})?\b/g, '').replace(/\s{2,}/g, ' ').trim();
  t = t.split(' ').slice(0, 5).join(' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Opération'; };
function bkAdd(L) {
  mutate(() => L.forEach(b => { if (!b) return; const mm = month(b.date.slice(0, 7)), name = bkName(b.label), dd = String(+b.date.slice(8, 10));
    if (b.amt < 0) mm.expenses.unshift({ id: uid(), name, amount: c2e(-b.amt), date: dd, status: 'Payé', cat: autoCat(name) || 'Autre', isFixed: false, isDivided: false, bk: 1 });
    else mm.incomes.unshift({ id: uid(), name, amount: c2e(b.amt), date: dd, status: 'Reçu', isFixed: false, bk: 1 }); }), L.length > 1 ? L.length + ' opérations ajoutées' : 'Ajoutée');
}
// Libellé lisible : sans « Paiement par carte X0298 », « Virement en votre faveur VIR INST de »…
function bkShow(s) {
  let t = String(s || '').replace(/^(paiement par carte|carte|achat cb|cb|pr[ée]l[èe]vement( sepa)?|prlv( sepa)?|virement (en votre faveur|[ée]mis|re[çc]u)|vir(ement)?( sepa)?( inst(antan[ée])?)?)\s+/i, '')
    .replace(/^(vir(ement)?\s+)?(inst\s+)?/i, '').replace(/^X\d{4}\s+/i, '').replace(/^[A-Za-z0-9]{12}\s+/, '').replace(/\s{2,}/g, ' ').trim();
  const brand = t.match(/\d{2}\/\d{2} - (.+)$/); if (brand && brand[1].trim().length > 1) t = t.replace(/\s*\d{2}\/\d{2} - .+$/, '') + ' · ' + brand[1].trim();
  return t || String(s || '');
}
// Petit rappel dans Mouvements
function bkNoteHTML() {
  const r = month(ck()).rec;
  return `<button class="btn bkbtn" data-a="bank-check">🏦 Relevés & pointage${r?.at ? `<small>${r.done || (r.gap === 0 && !r.todo) ? '✓ pointé le ' + fmtD(r.at) + (r.gap ? ' · écart ' + eur(c2e(r.gap)) + ' validé' : '') : (r.todo || '?') + ' point(s) à vérifier · ' + fmtD(r.at)}</small>` : '<small>Excel, CSV, OFX ou QIF de ta banque</small>'}</button>`;
}
