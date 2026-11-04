
/* ============================== 10. ÉVÉNEMENTS ============================== */
document.addEventListener('click', ev => {
  const pb = ev.target.closest('#panel [data-p]');
  if (pb && P) return panelClick(pb);
  if (ev.target.id === 'scrim') return closePanel();
  const b = ev.target.closest('[data-view],[data-a]'); if (!b || !loaded) return;
  if (b.dataset.view) { if (b.dataset.pt) UI.pt = b.dataset.pt; return go(b.dataset.view); }
  const a = b.dataset.a, k = ck(), m = month(k), t = b.dataset.t, id = b.dataset.id;
  switch (a) {
    case 'prev': case 'next': cur.setMonth(cur.getMonth() + (a === 'next' ? 1 : -1)); UI.calDay = null; UI.showPaid = false; return render();
    case 'today': cur = keyDate(nowK()); UI.calDay = null; return render();
    case 'new': return openPanel('expenses');
    case 'open': return openPanel(t, id);
    case 'tst': { const x0 = m[t].find(e => e.id === id), was = isPaid(x0, t), nm = x0.name || x0.cat || 'Recette';
      if (x0.xfer?.kind === 'acc') setTimeout(() => xferPropagate(x0.xfer, { paid: !was }), 0);
      return mutate(() => { const x = month(k)[t].find(e => e.id === id); x.status = t === 'incomes' ? (was ? 'En attente' : 'Reçu') : (was ? 'Prévu' : 'Payé'); },
        nm + ' : ' + (t === 'incomes' ? (was ? 'en attente' : 'reçu ✓') : (was ? 'à payer' : 'payé ✓')) + ' · ' + eur(t === 'incomes' ? num(x0.amount) : eff(x0))); }
    case 'flt': if (b.dataset.go) return go(b.dataset.go, { flt: b.dataset.v }); UI.flt = b.dataset.v; return render();
    case 's-new': return openPanel(t);
    case 's-allset': UI.allSet = true; render(); return scrollTo({ top: 0 });
    case 'mode': return setMode(b.dataset.v);
    case 'alerts': return go('messages');
    case 'sim-open': UI.simOpen = !UI.simOpen; return render();
    case 'ptab': UI.pt = b.dataset.v; return render();
    case 'goal-new': return goalDialog(null);
    case 'goal-edit': return goalDialog(id);
    case 'goal-add': return goalAddDialog(id);
    case 'link-yes': return linkAnswer(id, true);
    case 'link-no': return linkAnswer(id, false);
    case 'link-del': return linkRemove(id);
    case 'link-req': { const e = $('link-email'); return linkRequest(e?.value).then(() => { if (e) e.value = ''; }); }
    case 'dreq-yes': case 'dreq-no': return debtAnswer(id, b.dataset.r, a === 'dreq-yes');
    case 'debt-hist': UI.debtHist = !UI.debtHist; return render();
    case 'debt-new': return debtDialog(null);
    case 'bank-check': return bankCheck();
    case 'bal-solde': return balDialog(id);
    case 'half-conv': return halfConvDialog();
    case 'sav-int': return savDialog();
    case 'sav-int-add': return savIntAdd();
    case 'stm-add': return $('bkfile').click();
    case 'stm-open': return stmOpen(b.dataset.k);
    case 'stm-del': return stmDelete(id);
    case 'stm-dl': return stmDownload(id);
    case 'split-new': return splitDialog();
    case 'grp-open': return groupView(id);
    case 'inv-split': return inviteDialog(id);
    case 'pc-ok': return payConfirmDialog(id, b.dataset.v);
    case 'pc-no': return payConfirm(id, b.dataset.v, false);
    case 'pr-act': return payRejAction(id, b.dataset.v, b.dataset.w);
    case 'shfix-yes': return shfixAnswerDialog(id);
    case 'shfix-no': return shfixAnswer(id, false);
    case 'tshare': return shfixDialog(b.closest('[data-tpl]').dataset.id);
    case 'inv-split-no': return inviteAnswer(id, false);
    case 'split-dec': return declinedAction(id, b.dataset.v);
    case 'debt-open': return debtView(id);
    case 'debt-goto': { const acc = b.dataset.acc; openAccount(acc); go('budgets'); setTimeout(() => debtView(id), 700); return; }
    case 'loan-new': return loanDialog(null);
    case 'loan-open': return loanView(id);
    case 'theme': try { localStorage.setItem('theme', b.dataset.v); } catch (e) {} applyTheme(b.dataset.v); render(); return toast({ auto: 'Apparence automatique', light: 'Mode clair', dark: 'Mode sombre' }[b.dataset.v]);
    case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); } return;
    case 'al-new': return alertNewDialog();
    case 'al-edit': return alertDialog(null, id);
    case 'xf-hide': (U.xfHide = U.xfHide || []).push(id); saveUser(); return render();
    case 'alertgo': { const al = alerts(k)[0]; if (al) go(al.go, { flt: al.flt || 'all', q: al.q || '' }); return; }
    case 'bank': return bankDialog();
    case 'saving': return savingDialog();
    case 'ob-inc': return openPanel('incomes', null, { repeat: true });
    case 'ob-fix': return openPanel('expenses', null, { repeat: true });
    case 'bud': return budgetDialog(id);
    case 'bud-new': return budgetDialog(null, b.dataset.v);
    case 'calday': UI.calDay = UI.calDay === +b.dataset.v ? null : +b.dataset.v; return render();
    case 'showpaid': UI.showPaid = true; return render();
    // Épargne
    case 'sav-acc': return accountDialog(id);
    case 'sav-new': return accountDialog(null);
    case 'sav-bal': return balancesDialog();
    case 'svmode': sv().mode = b.dataset.v; saveUser(); return render();
    case 'svmore': UI.svMore = !UI.svMore; return render();
    case 'sv-use': { const tot = sum(accs(), x => aBal(x)), A = accs(); const w = tot > 0 ? sum(A, x => aBal(x) * num(x.rate)) / tot : 0;
      sv().capital = Math.round(tot * 100) / 100; if (w > 0) sv().rate = Math.round(w * 10) / 10; saveUser(); render(); return toast('Départ : ' + eur(tot)); }
    case 'sv-apply': { const v = Math.round(svSim(sv(), num(sv().rate)).d1 * 100) / 100; return mutate(() => { month(nowK()).savingGoal = v; }, 'Épargne prévue de ' + mlab(nowK()) + ' : ' + eur(v)); }
    case 'sv-take': sv().monthly = num(month(nowK()).savingGoal); sv().mode = 'fix'; saveUser(); render(); return toast('Versement repris : ' + eur(sv().monthly));
    // Historique
    case 'hp': UI.hp = +b.dataset.v; return render();
    case 'hy': UI.hy += +b.dataset.v; return render();
    case 'gom': return goMonth(b.dataset.v);
    case 'csv': return exportCSV();
    case 'pdf': return print();
    // Paramètres
    case 'pwd': return changePassword();
    case 'delacc': return deleteAccount();
    case 'logout': return logout();
    case 'bk-now': return backupNow('manuelle').then(ok => { toast(ok ? '💾 Sauvegarde créée' : 'Rien à sauvegarder'); if (ok && $('bk-list')?.innerHTML) listBackups(); });
    case 'bk-list': return listBackups();
    case 'bk-res': return restoreBackup(id);
    case 'bk-dl': { const dd = bkCache[id]; if (dd) download('budget_sauvegarde_' + id.replace('old_', '').slice(0, 10) + '.json', JSON.stringify(JSON.parse(dd), null, 2), 'application/json'); return; }
    case 'export': download('budget_perso_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(JSON.parse(snapshot()), null, 2), 'application/json'); return toast('Export téléchargé');
    case 'import': return $('file').click();
    case 'reset': if (!confirm('Effacer TOUT ton budget ? Une sauvegarde sera faite juste avant. Ton compte n\'est pas supprimé.')) return;
      backupNow('avant réinitialisation'); allowDeletes = true; return mutate(() => { S = normalize(fresh()); }, 'Budget réinitialisé');
    case 'addcat': { const v = $('newcat').value.trim(); if (!v || S.categories.includes(v)) return toast('Catégorie vide ou déjà existante'); return mutate(() => S.categories.push(v), 'Catégorie ajoutée'); }
    case 'delcat': { const c = S.categories[+b.dataset.i]; if (!confirm(`Supprimer la catégorie « ${c} » ? Les mouvements existants la gardent.`)) return; return mutate(() => S.categories.splice(+b.dataset.i, 1), 'Catégorie supprimée'); }
    case 'tadd': { const n = t === 'expenses' ? { tmplId: uid(), date: '', cat: S.categories[0] || 'Autre', name: 'Nouvelle charge', amount: 0, isDivided: false }
        : t === 'incomes' ? { tmplId: uid(), date: '', name: 'Nouvelle recette', amount: 0 } : { tmplId: uid(), cat: S.categories[0] || 'Autre', amount: 0 };
      return mutate(() => tplAdd(t, n, k), 'Ajouté'); }
    case 'thalf': { const tr = b.closest('[data-tpl]'), x = S.templates.expenses.find(y => y.tmplId === tr.dataset.id); return mutate(() => { x.isDivided = !x.isDivided; syncTpl('expenses', x, ['isDivided'], k); }, false); }
    case 'tdel': { const tr = b.closest('[data-tpl]'); if (!confirm('Supprimer cet élément récurrent ? Ce qui n\'est pas encore réglé sera retiré de ' + mlab(k) + ' et des mois suivants.')) return;
      const tp0 = S.templates[tr.dataset.tpl].find(z => z.tmplId === tr.dataset.id), cp = tp0 && JSON.parse(JSON.stringify(tp0));
      mutate(() => tplDel(tr.dataset.tpl, tr.dataset.id, k), 'Supprimé'); if (cp?.xfer) xferTplSync(tr.dataset.tpl, cp, 'del'); return; }
  }
});

// Saisie au clavier
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'q') { UI.q = el.value; return render(); }
  if (el.dataset.pf && P) {
    P.d[el.dataset.pf] = el.value;
    if (el.dataset.pf === 'name' && (P.type === 'expenses' || P.type === 'xfer')) { const c = autoCat(el.value); if (c && c !== P.d.cat) { P.d.cat = c; $$('#panel [data-p=cat]').forEach(b => b.classList.toggle('on', b.dataset.v === c)); } }
    if (el.dataset.pf === 'name' && P.type === 'expenses' && cmApplyDef()) cmBoxPaint();
    if (el.dataset.pf === 'email') xfLookupSoon();
    if (el.dataset.pf === 'amount') fxPaint();
    if (el.dataset.pf === 'amount' || el.dataset.pf === 'cmPart') cmInfoPaint();
    if (el.dataset.pf === 'amount' && P.d.isDivided) { const h = $$('#panel [data-p=half]')[0]; if (h) h.textContent = '½ Partagé · ma part ' + eur(parseAmt(el.value) / 2); }
    return;
  }
  if (el.dataset.sv) {                                          // simulateur : mise à jour en direct
    const p = sv(), f = el.dataset.sv; p[f] = parseFloat(el.value) || 0; if (f === 'years') p.years = Math.min(60, Math.max(1, p.years));
    const l = $$(`[data-svl="${f}"]`)[0]; if (l) l.textContent = String(p[f]).replace('.', ',') + el.dataset.u;
    svResults();
  }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.id === 'file') return importFile(el.files[0]);
  if (el.id === 'imgfile') return readImage(el.files[0]);
  if (el.id === 'bkfile') return bankImport(el.files[0]);
  if (el.id === 'pn-site' && P) return paintPanel();
  if (el.dataset.pf === 'cmWho' && P) { P.d.cmWho = el.value; return paintPanel(); }
  if (el.dataset.pcur && P) { P.cur = el.value; paintPanel(); if (P.cur !== 'EUR') fxLoad().then(fxPaint); return; }
  if (el.dataset.sv) return saveUser();
  if (el.dataset.recv) { U.recvAcc = el.value; U.recvHide = (U.recvHide || []).filter(x => x !== el.value); saveUser(); render(); return toast('Compte par défaut : « ' + (ACC[el.value]?.name || '') + ' »'); }
  if (el.dataset.rvis) { const id = el.dataset.rvis; U.recvHide = (U.recvHide || []).filter(x => x !== id); if (!el.checked) { if (id === recvAccount()) { toast('C\'est ton compte par défaut : il reste proposé'); return render(); } U.recvHide.push(id); } saveUser(); return render(); }
  if (el.dataset.alon) { const id = el.dataset.alon, on = el.checked; return mutate(() => { const a = AL().custom.find(x => x.id === id); if (a) a.on = on; }, on ? 'Alerte activée' : 'Alerte coupée'); }
  if (el.dataset.al) { const f = el.dataset.al, v = parseFloat(el.value) || 0; return mutate(() => { AL()[f] = v; }, 'Seuil d\'alerte enregistré'); }
  const tr = el.closest('[data-tpl]'), f = el.dataset.f;
  if (tr && f) {
    let v = el.value; if (f === 'amount') v = Math.max(0, parseAmt(v)); if (f === 'date') v = day(v); if (f === 'site') v = cleanSite(v);
    const ty = tr.dataset.tpl, x = S.templates[ty].find(y => y.tmplId === tr.dataset.id);
    const c = f === 'name' && ty === 'expenses' ? autoCat(v) : null;
    const old = { name: x.name, amount: x.amount };
    setTimeout(() => { mutate(() => { if (v === '' && f === 'site') delete x[f]; else x[f] = v; syncTpl(ty, x, [f]); if (c && x.cat !== c && !x.xfer) { x.cat = c; syncTpl(ty, x, ['cat']); } }, false);
      if (x.xfer && ['name', 'amount', 'date', 'site'].includes(f)) xferTplSync(ty, x, 'upd', old); }, 0);  // après le déplacement du focus
  }
});
function importFile(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result); if (!d.templates || !d.months) throw 0;
      if (!confirm('Remplacer tes données par ce fichier ? Une sauvegarde sera faite juste avant.')) return;
      backupNow('avant import'); allowDeletes = true; mutate(() => { S = normalize(d); }, 'Import réussi');
    } catch (e) { toast('Fichier invalide'); }
  };
  r.readAsText(f); $('file').value = '';
}

// Raccourcis : N nouveau · / rechercher · ← → mois · Échap fermer · Ctrl+Z annuler
document.addEventListener('keydown', e => {
  if (!loaded) return;
  if (e.key === 'Escape' && $('accmenu')) return $('accmenu').remove();
  if (e.key === 'Escape' && P) return closePanel();
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing && undoSnap) { e.preventDefault(); return undo(); }
  if (typing || P || $('dlg').open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'n') { e.preventDefault(); openPanel('expenses'); }
  if (e.key === '/') { e.preventDefault(); if (UI.view !== 'mouvements') go('mouvements'); $('q')?.focus(); }
  if (MONTH_VIEWS.includes(UI.view) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { cur.setMonth(cur.getMonth() + (e.key === 'ArrowRight' ? 1 : -1)); render(); }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-a=gom]')) goMonth(e.target.dataset.v);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); render(); });

/* ---------- Démarrage ---------- */
try { const v = localStorage.getItem('bt'); if (VIEWS.some(x => x[0] === v)) UI.view = v; } catch (e) {}
showScreen('loading');
