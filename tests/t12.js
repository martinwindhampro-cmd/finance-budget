const {JSDOM}=require('jsdom');const fs=require('fs');const install=require('./fsmock.js');
const src=fs.readFileSync(process.argv[2],'utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<link [^>]*>/g,'');
const shared={store:new Map(),listeners:new Set(),seq:0};
shared.notify=()=>setTimeout(()=>shared.listeners.forEach(L=>{if(!L.win.document){shared.listeners.delete(L);return}try{L.fire()}catch(e){console.error('listener',e)}}),3);
const errs=[];
function client(name){
  const dom=new JSDOM(src,{runScripts:'dangerously',url:'https://x.test/'+name,pretendToBeVisual:true,beforeParse(w){
    install(w,shared);
    w.Chart=class{destroy(){}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
    w.scrollTo=()=>{};w.fetch=u=>Promise.resolve({ok:true,json:()=>Promise.resolve({amount:1,base:'EUR',date:'2026-10-12',rates:{USD:1.1181,GBP:0.84478,JPY:177.33}})});w.Element.prototype.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>'SUPPRIMER';
  }});
  dom.window.addEventListener('error',e=>errs.push(name+': '+e.message));
  const w=dom.window;w.name_=name;return w;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)fails++;};
const ev=(w,js)=>w.eval(js);
const click=(w,sel)=>{const el=typeof sel==='string'?w.document.querySelector(sel):sel;if(!el)throw new Error(w.name_+' introuvable: '+sel);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
const nk=(()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')})();
(async()=>{
  const A=client('robin'); await wait(20); A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  // ---- Devises
  ev(A,"openPanel('expenses')"); await wait(50);
  const sel=A.document.querySelector('#panel [data-pcur]'); ok('Panneau : choix de devise',!!sel);
  sel.value='USD'; sel.dispatchEvent(new A.Event('change',{bubbles:true})); await wait(50);
  ev(A,"P.d.amount='50';P.d.name='Hôtel NY'"); A.eval("fxPaint()");
  ok('Conversion affichée ('+A.document.getElementById('pn-fx').textContent.trim().slice(0,40)+')',/44,7\d/.test(A.document.getElementById('pn-fx').textContent));
  click(A,'#panel [data-p=save]'); await wait(50);
  const x=JSON.parse(ev(A,"JSON.stringify(month().expenses.find(e=>e.name==='Hôtel NY'))"));
  ok('Enregistré en € ('+x.amount+') avec montant d\'origine',Math.abs(x.amount-44.72)<0.01&&x.fx.cur==='USD'&&x.fx.amt===50);
  ok('Ligne : montant en dollars affiché',/50,00\s\$US|50,00\s\$|\$/.test(ev(A,`rowHTML(month().expenses.find(e=>e.name==='Hôtel NY'),'expenses')`)));
  ev(A,`openPanel('expenses','${x.id}')`); ok('Modification : reprend 50 USD',ev(A,'P.cur')==='USD'&&ev(A,'P.d.amount')==='50'); ev(A,'closePanel()');
  ev(A,"openPanel('expenses')"); ok('Devise mémorisée pour le mouvement suivant (USD)',ev(A,'P.cur')==='USD'&&A.document.querySelector('#panel [data-pcur]').value==='USD');
  { const s2=A.document.querySelector('#panel [data-pcur]'); s2.value='EUR'; s2.dispatchEvent(new A.Event('change',{bubbles:true})); ev(A,"P.d.amount='5';P.d.name='Café'"); click(A,'#panel [data-p=save]'); await wait(30); ev(A,"openPanel('expenses')"); ok("Retour à l'euro mémorisé aussi",ev(A,'P.cur')==='EUR'); ev(A,'closePanel()'); }
  // ---- Objectifs
  ev(A,"go('epargne')"); click(A,'[data-a=goal-new]');
  A.document.getElementById('f_name').value='PS5'; A.document.getElementById('f_target').value='600'; A.document.getElementById('f_saved').value='100'; A.document.getElementById('f_date').value=(()=>{const d=new Date();d.setMonth(d.getMonth()+5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})();
  click(A,'#g-emo [data-e="🎮"]'); A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(50);
  const g=JSON.parse(ev(A,"JSON.stringify(U.goals[0])")); ok('Objectif créé (PS5, 600, 🎮)',g.name==='PS5'&&g.target===600&&g.emo==='🎮');
  { const txt=A.document.getElementById('v-epargne').textContent; ok('Carte objectif : 17 %, 100 €/mois',/17\s%/.test(txt)&&/100\s€\s\/ mois/.test(txt)); }
  click(A,`[data-a=goal-add][data-id="${g.id}"]`); A.document.getElementById('f_amt').value='500'; A.document.getElementById('g-out').checked=true; A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(50);
  ok('Ajout 500 € → atteint 🎉',ev(A,"goalInfo(U.goals[0]).done")===true&&/Objectif atteint/.test(A.document.getElementById('v-epargne').textContent));
  ok('Option : dépense ajoutée sur le compte',ev(A,"month(nowK()).expenses.some(e=>e.name==='Objectif : PS5'&&e.amount===500)"));
  await wait(900); ok('Objectifs enregistrés dans le profil',(shared.store.get('users/uA').goals||[]).length===1);
  // ---- Crédit
  ev(A,"go('budgets')"); click(A,'[data-a=loan-new]');
  const f=(i,v)=>A.document.getElementById('f_'+i).value=v;
  f('name','Prêt voiture'); A.document.getElementById('f_kind').value='Auto / moto'; f('bank','Crédit Agricole'); f('capital','15000'); f('rate','4,5'); f('months','60'); const st=(()=>{const d=new Date();d.setMonth(d.getMonth()-12);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})(); f('start',st); f('day','5'); f('ins','12');
  A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(120);
  const c=JSON.parse(ev(A,"JSON.stringify(loanCalc(S.loans[0]))"));
  ok('Mensualité calculée (279,65 €) : '+c.M.toFixed(2),Math.abs(c.M-279.65)<0.05);
  ok('Reste dû après 13 échéances ≈ 12 030 € : '+Math.round(c.left),Math.abs(c.left-12030)<5);
  ok('Fin = start + 59 mois, coût intérêts ≈ 1779 € : '+c.end+' / '+Math.round(c.interest),c.end===ev(A,`kAdd('${st}',59)`)&&Math.abs(c.interest-1779)<5);
  ok('Fenêtre détail ouverte (tableau par année)',A.document.getElementById('dlg').open&&A.document.querySelectorAll('#dlg tbody tr').length>=5); A.eval("$('dlg').close()");
  ok('Charge fixe ajoutée ce mois (291,65 €, le 5)',ev(A,"month(nowK()).expenses.some(e=>e.loan&&Math.abs(e.amount-291.65)<0.01&&e.date==='5'&&e.isFixed)"));
  const endK=c.end; ok('Plus de mensualité après la fin',ev(A,`month(kAdd('${endK}',1)).expenses.every(e=>!e.loan)`)&&ev(A,`month('${endK}').expenses.some(e=>e.loan)`));
  ok('Pas de mensualité avant le début',ev(A,`month(kAdd('${st}',-1)).expenses.every(e=>!e.loan)`));
  ev(A,"go('budgets')"); ok('Liste des crédits (onglet Budgets) : reste à rembourser',/Reste à rembourser/.test(A.document.getElementById('v-budgets').textContent)&&/Prêt voiture/.test(A.document.getElementById('v-budgets').textContent));
  // modification : durée 48 → nouvelle mensualité dans la charge fixe
  A.eval(`loanDialog(S.loans[0].id)`); A.document.getElementById('f_months').value='48'; A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(120); A.eval("$('dlg').open&&$('dlg').close()");
  const M2=ev(A,"loanCalc(S.loans[0]).total"); ok('Modif. durée → charge fixe mise à jour ('+M2.toFixed(2)+')',ev(A,`month(nowK()).expenses.some(e=>e.loan&&Math.abs(e.amount-${M2})<0.01)`)&&ev(A,`S.templates.expenses.filter(t=>t.loan).length`)===1);
  await wait(1200); ok('Crédit enregistré dans le cloud (compte)',JSON.parse(shared.store.get('accounts/'+ev(A,'active')).meta).loans.length===1);
  // suppression
  A.eval(`loanDialog(S.loans[0].id)`); A.document.querySelector('#dlg [data-del]').click(); await wait(50);
  ok('Suppression : crédit et charge fixe retirés',ev(A,"loans().length")===0&&ev(A,"month(nowK()).expenses.every(e=>!e.loan)&&!S.templates.expenses.some(t=>t.loan)"));
  for(const v of ['accueil','mouvements','budgets','epargne','historique','parametres','messages','comptes']) ev(A,`go('${v}')`);
  ev(A,"setMode('simple');go('accueil')"); ok('Simple : objectifs visibles sur l\'accueil',/PS5/.test(A.document.getElementById('v-accueil').textContent)); ev(A,"setMode('full')");
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
