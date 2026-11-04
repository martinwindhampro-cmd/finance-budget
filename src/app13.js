
/* ============================== RELEVÉS BANCAIRES (historique) ==============================
   Chaque relevé déposé est gardé dans accounts/{compte}/statements/{du}_{au} (membres du compte seulement),
   avec ses opérations (JSON). Les relevés qui se chevauchent sont fusionnés sans doublon : le pointage d'un mois
   utilise toutes les opérations connues. Un même relevé redéposé (même période) remplace l'ancien.            */
let STM = {};                                     // compte → { at, L:[relevés] }
const stmCol = (acc = active) => accDoc(acc).collection('statements');
async function stmLoad(acc = active, force) {
  const c = STM[acc];
  if (c && !force && Date.now() - c.at < 60000) return c.L;
  const q = await stmCol(acc).get();
  const L = q.docs.map(d => { const x = d.data(); let lines = []; try { lines = JSON.parse(x.lines || '[]'); } catch (e) {} return Object.assign({ id: d.id }, x, { L: lines }); })
    .sort((a, b) => b.to.localeCompare(a.to) || b.at - a.at);
  STM[acc] = { at: Date.now(), L }; return L;
}
async function stmSave(r, name) {
  const L = r.lines.map(l => Object.assign({ d: l.date, a: l.amt, l: String(l.label || '').slice(0, 160) }, l.bal != null ? { b: l.bal } : {}));
  const ds = L.map(l => l.d).sort(), from = ds[0], to = ds[ds.length - 1], id = from + '_' + to;
  const doc = { name: String(name || '').slice(0, 80), src: r.src || '', from, to, n: L.length, at: Date.now(), by: currentUser.uid, byEmail: currentUser.email || '', lines: JSON.stringify(L) };
  if (r.bal?.running) doc.running = true; else if (r.bal?.amt != null && r.bal.date) doc.bal = { date: r.bal.date, amt: r.bal.amt };
  await stmCol().doc(id).set(doc);
  if (STM[active]) STM[active].at = 0;
  return { id, from, to };
}
// Toutes les opérations connues, sans doublon (chaque opération gardée autant de fois que dans le relevé qui en a le plus)
function stmMerged(list) {
  const keep = new Map();
  list.slice().reverse().forEach(s => { const c = new Map();
    s.L.forEach(l => { const x = { date: l.d, amt: l.a, label: l.l, bal: l.b ?? null }, h = bkHash(x); (c.get(h) || c.set(h, []).get(h)).push(x); });
    c.forEach((arr, h) => { if (!keep.has(h) || keep.get(h).length < arr.length) keep.set(h, arr); }); });
  return [...keep.values()].flat().sort((a, b) => a.date.localeCompare(b.date));
}
// Ouvre le pointage d'un mois avec tous les relevés du compte
async function stmOpen(k) {
  let L; try { L = await stmLoad(active); } catch (e) { return toast('⚠ Relevés indisponibles (' + (e.code || e.message) + ')'); }
  const lines = stmMerged(L); if (!lines.some(l => l.date.startsWith(k))) return toast('Aucun relevé ne couvre ' + mlab(k).toLowerCase());
  const bals = L.filter(s => s.bal?.date?.startsWith(k)).sort((a, b) => b.bal.date.localeCompare(a.bal.date) || b.at - a.at);
  bkLoad({ lines, bal: bals[0] ? bals[0].bal : L.some(s => s.running) ? { running: true } : null, src: 'relevés' }, k);
}
const trackedMonths = () => Object.keys(S.months).filter(k => S.months[k].expenses.length || S.months[k].incomes.length).sort();
const dmy = d => d.slice(8, 10) + '/' + d.slice(5, 7);

/* ---------- Écran « Relevés bancaires » ---------- */
function vReleves() {
  const V = $('v-releves'), acc = active, c = STM[acc];
  if (!c || Date.now() - c.at > 60000) {
    if (!c) V.innerHTML = '<p class="empty">Chargement des relevés…</p>';
    stmLoad(acc, true).then(() => { if (UI.view === 'releves' && active === acc) vReleves(); }).catch(e => { V.innerHTML = `<p class="empty">⚠ Relevés indisponibles (${esc(e.code || e.message)})</p>`; });
    if (!c) return;
  }
  const L = STM[acc].L, lines = stmMerged(L), me = currentUser.uid;
  const months = [...new Set([...trackedMonths(), ...(trackedMonths().length ? [] : lines.map(l => l.date.slice(0, 7)))])].sort().reverse();
  const row = k => {
    const ml = lines.filter(l => l.date.startsWith(k)), r = S.months[k]?.rec, past = k < nowK();
    const last = ml.length ? ml[ml.length - 1].date : null, first = ml.length ? ml[0].date : null;
    const full = ml.length && (!past || +last.slice(8, 10) >= dim(k) - 3);
    const st = !ml.length ? [past ? '📄 Relevé à déposer' : 'Pas encore de relevé', past ? 'var(--warn)' : 'var(--mute)']
      : r?.done ? ['✓ Pointé' + (r.gap ? ' · écart ' + eur(c2e(r.gap)) + ' validé' : ''), 'var(--ok)']
      : r?.at ? [(r.todo || 0) + ' point' + (r.todo > 1 ? 's' : '') + ' à vérifier', 'var(--warn)'] : ['Pas encore pointé', 'var(--ink)'];
    return `<div class="row stmm"><span class="rt"><span class="rn">${esc(mlab(k))}</span><span class="rs" style="color:${st[1]}">${st[0]}</span>
      ${ml.length ? `<span class="rs">${ml.length} opération${ml.length > 1 ? 's' : ''} · du ${dmy(first)} au ${dmy(last)}${past && !full ? ' · <b style="color:var(--warn)">relevé incomplet</b>' : ''}${r?.at ? (r.done ? ' · pointé le ' : ' · vérifié le ') + fmtD(r.at) : ''}</span>` : ''}</span>
      ${ml.length ? `<button class="btn sm${r?.done ? '' : ' p'}" data-a="stm-open" data-k="${k}">${r?.done ? 'Revoir' : 'Pointer'}</button>` : ''}</div>`;
  };
  V.innerHTML = `<div class="grid2">
  <section class="card" style="flex:1 1 320px;display:flex;flex-direction:column;gap:12px">
    <div class="ch"><h2>🏦 Relevés · ${esc(accName())}</h2></div>
    <p class="note">Chaque mois, dépose le relevé téléchargé depuis ta banque : l'app le garde, compare chaque opération avec ce que tu as noté et t'aide à pointer le mois.</p>
    <button class="btn p big" data-a="stm-add">${svg('up', 18)} Déposer un relevé</button>
    <details class="note" style="font-size:13px"><summary>Où trouver ce fichier ?</summary><p style="margin:6px 0 0">• <b>Crédit Agricole</b> : site web › Mes comptes › le compte › « Télécharger » (Excel ou CSV).<br>• <b>Boursorama</b> : site web › le compte › Mouvements › « Exporter » (CSV).<br>• <b>Revolut</b> : appli › le compte › ⋯ › Relevé › Excel ou CSV.<br>Prends la période depuis la fin du relevé précédent : les opérations en double sont reconnues.</p></details>
  </section>
  <section class="card" style="flex:1 1 320px;display:flex;flex-direction:column;gap:4px">
    <div class="ch"><h2>Pointage par mois</h2></div>
    ${months.map(row).join('') || '<p class="empty">Aucun mois suivi pour l\'instant.</p>'}
  </section></div>
  <section class="card" style="display:flex;flex-direction:column;gap:4px">
    <div class="ch"><h2>Relevés déposés</h2><span class="note">${L.length}</span></div>
    ${L.map(s => `<div class="row stmm"><span class="ico" style="--c:#0EA5E9">${svg('list', 18)}</span><span class="rt"><span class="rn">Du ${dmy(s.from)} au ${dmy(s.to)}/${s.to.slice(0, 4)} · ${s.n} opération${s.n > 1 ? 's' : ''}</span>
      <span class="rs">${s.bal ? 'Solde ' + eur(c2e(s.bal.amt)) + ' au ' + dmy(s.bal.date) + ' · ' : ''}déposé le ${fmtD(s.at)}${s.by !== me ? ' par ' + esc(shortName(s.byEmail)) : ''}${s.name ? ' · ' + esc(s.name) : ''}</span></span>
      <button class="ib sm" data-a="stm-dl" data-id="${esc(s.id)}" aria-label="Télécharger ce relevé (CSV)" title="Télécharger (CSV)">${svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 16)}</button><button class="x" data-a="stm-del" data-id="${esc(s.id)}" aria-label="Supprimer ce relevé">${svg('trash', 15)}</button></div>`).join('') || '<p class="empty">Aucun relevé déposé. Touche « Déposer un relevé ».</p>'}
  </section>`;
}
async function stmDelete(id) {
  const s = STM[active]?.L.find(x => x.id === id); if (!s) return;
  if (!confirm('Supprimer le relevé du ' + dmy(s.from) + ' au ' + dmy(s.to) + ' (' + s.n + ' opérations) ? Tes pointages déjà faits sont gardés.')) return;
  try { await stmCol().doc(id).delete(); STM[active].L = STM[active].L.filter(x => x.id !== id); toast('Relevé supprimé'); render(); }
  catch (e) { toast('⚠ ' + (e.code || e.message)); }
}
function stmDownload(id) {
  const s = STM[active]?.L.find(x => x.id === id); if (!s) return;
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const csv = '﻿Date;Libellé;Montant\n' + s.L.map(l => [l.d.split('-').reverse().join('/'), q(l.l), (l.a / 100).toFixed(2).replace('.', ',')].join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'releve_' + accName().replace(/[^\w-]+/g, '_') + '_' + s.from + '_' + s.to + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}
// Rappel en début de mois : relevé du mois dernier pas encore pointé
function stmAlerts() {
  const pk = kAdd(nowK(), -1), m = S.months[pk];
  if (today() > 12 || !m || !(m.expenses.length || m.incomes.length) || m.rec?.done) return [];
  return [{ id: 'stm_' + pk, lvl: 'warn', text: `🏦 Dépose ton relevé de ${mlab(pk).split(' ')[0].toLowerCase()} pour pointer le mois`, go: 'releves' }];
}
