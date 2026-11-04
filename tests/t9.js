const {JSDOM}=require('jsdom');const fs=require('fs');const install=require('./fsmock.js');
const src=fs.readFileSync(process.argv[2],'utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<link [^>]*>/g,'');
const shared={store:new Map(),listeners:new Set(),seq:0};
shared.notify=()=>setTimeout(()=>shared.listeners.forEach(L=>{if(!L.win.document){shared.listeners.delete(L);return}try{L.fire()}catch(e){console.error('listener',e)}}),3);
const errs=[];
function client(name){
  const dom=new JSDOM(src,{runScripts:'dangerously',url:'https://x.test/'+name,pretendToBeVisual:true,beforeParse(w){
    install(w,shared);
    w.Chart=class{destroy(){}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
    w.scrollTo=()=>{};w.Element.prototype.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>'SUPPRIMER';
  }});
  dom.window.addEventListener('error',e=>errs.push(name+': '+e.message));
  const w=dom.window;w.name_=name;return w;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)fails++;};
const ev=(w,js)=>w.eval(js);
const click=(w,sel)=>{const el=typeof sel==='string'?w.document.querySelector(sel):sel;if(!el)throw new Error(w.name_+' introuvable: '+sel);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
const nk=(()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')})();
const pk=n=>{const x=new Date();x.setDate(1);x.setMonth(x.getMonth()-n);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')};
const td=new Date().getDate();
const mk=(late,early)=>({bankBalance:null,savingGoal:null,expenses:[{id:'f'+late,isFixed:true,tmplId:'t1',cat:'Logement',name:'Loyer',amount:700,status:'Payé',date:'4'},{id:'a'+late,isFixed:false,cat:'Alimentation',name:'Courses',amount:early,status:'Payé',date:'1'},{id:'b'+late,isFixed:false,cat:'Alimentation',name:'Courses fin',amount:late,status:'Payé',date:String(Math.min(28,td+1))}],incomes:[{id:'s',tmplId:'i1',name:'Salaire',amount:2000,status:'Reçu',date:'1'}],budgets:[{id:'bb',cat:'Alimentation',amount:900}]});
const legacy={categories:['Logement','Alimentation','Autre'],templates:{expenses:[{tmplId:'t1',date:'4',cat:'Logement',name:'Loyer',amount:700}],incomes:[{tmplId:'i1',date:'1',name:'Salaire',amount:2000}],budgets:[{tmplId:'b1',cat:'Alimentation',amount:900}]},
 months:{[pk(3)]:mk(200,50),[pk(2)]:mk(300,60),[pk(1)]:mk(250,70),[nk]:{bankBalance:1000,savingGoal:null,expenses:[{id:'e1',tmplId:'t1',isFixed:true,date:'4',cat:'Logement',name:'Loyer',amount:700,status:'Payé'}],incomes:[{id:'s1',tmplId:'i1',isFixed:true,date:'1',name:'Salaire',amount:2000,status:'Reçu'}],budgets:[{id:'b',tmplId:'b1',cat:'Alimentation',amount:900}]}}};
shared.store.set('users/uA/data/budget',{budgetData:JSON.stringify(legacy)});
(async()=>{
  const A=client('robin'); await wait(20); A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  ok('Date du jour affichée',/\d/.test(A.document.getElementById('todayd').textContent)&&A.document.getElementById('todayd').textContent.length>5);
  const c=JSON.parse(ev(A,"JSON.stringify(calc(month(),ck()))"));
  ok('Historique : 3 mois, moyenne après aujourd\'hui = 250 ('+c.vr.n+' / '+c.vr.h.mean+')',c.vr.n===3&&Math.abs(c.vr.h.mean-250)<0.01);
  ok('Fin de mois = reste à vivre − 250 (budgets ignorés) : '+c.est+' / rav '+c.rav,Math.abs(c.est-(c.rav-250))<0.01);
  const hero=A.document.querySelector('#v-accueil .hero').textContent; ok('Accueil : ≈ et ± % affichés',/≈/.test(hero)&&/d'après 3 mois/.test(hero));
  // dépense future déjà saisie déduite
  ev(A,`mutate(()=>month().expenses.unshift({id:'zz',isFixed:false,cat:'Alimentation',name:'Resto prévu',amount:100,status:'Prévu',date:'${Math.min(28,td+1)}'}),false)`);
  const c2=JSON.parse(ev(A,"JSON.stringify(calc(month(),ck()))")); ok('Déjà prévu non compté deux fois ('+c2.vr.v+')',Math.abs(c2.vr.v-150)<0.01);
  // mois suivant : estimation sur mois complet
  const cf=JSON.parse(ev(A,"cur.setMonth(cur.getMonth()+1);const r=JSON.stringify(calc(month(ck()),ck()));cur.setMonth(cur.getMonth()-1);r"));
  ok('Mois suivant : dépenses habituelles du mois entier ('+Math.round(cf.vr.h.mean)+')',Math.abs(cf.vr.h.mean-310)<0.01);
  // alertes personnalisées
  ev(A,"UI.pt='alertes';go('parametres')"); click(A,'[data-a=al-new]'); ok('Choix du type d\'alerte (5)',A.document.querySelectorAll('#dlg [data-alt]').length===5);
  click(A,'#dlg [data-alt=cat]'); A.document.getElementById('f_cat').value='Alimentation'; A.document.getElementById('f_amt').value='50';
  A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(50);
  ok('Alerte catégorie créée',ev(A,"AL().custom.length")===1);
  ok('Alerte catégorie déclenchée (100 > 50)',ev(A,"alerts(nowK()).some(a=>/Alimentation : .*ta limite/.test(a.text))"));
  ev(A,"alertDialog('bal')"); A.document.getElementById('f_amt').value='5000'; A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true}));
  ev(A,"alertDialog('rem')"); A.document.getElementById('f_text').value='Payer la cantine'; A.document.getElementById('f_day').value=String(td); A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true}));
  ev(A,"alertDialog('inc')"); A.document.getElementById('f_name').value='Prime'; A.document.getElementById('f_day').value='1'; A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true}));
  ev(A,"alertDialog('big')"); A.document.getElementById('f_amt').value='80'; A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true}));
  const al=ev(A,"alerts(nowK()).map(a=>a.text).join(' | ')"); console.log('  '+al);
  ok('Solde, rappel, recette manquante, grosse dépense : déclenchées',/sous ton seuil/.test(al)&&/cantine/.test(al)&&/Prime/.test(al)&&/Grosse dépense : Resto prévu/.test(al));
  ev(A,"UI.pt='alertes';render()");ok('Liste dans Paramètres (5)',A.document.querySelectorAll('#v-parametres [data-a=al-edit]').length===5);
  const id=ev(A,"AL().custom[1].id"); const cb=A.document.querySelector(`[data-alon="${id}"]`); cb.checked=false; cb.dispatchEvent(new A.Event('change',{bubbles:true})); await wait(50);
  ok('Alerte coupée → plus déclenchée',!ev(A,"alerts(nowK()).some(a=>/sous ton seuil/.test(a.text))"));
  ev(A,`alertDialog(null,'${id}')`); A.document.querySelector('#dlg [data-del]').click(); await wait(50); ok('Alerte supprimée',ev(A,"AL().custom.length")===4);
  await wait(1200); ok('Alertes enregistrées dans le cloud',JSON.parse(shared.store.get(`accounts/${ev(A,'active')}`).meta).alerts.custom.length===4);
  await wait(1200); ok('Alertes enregistrées dans le cloud',JSON.parse(shared.store.get(`accounts/${ev(A,'active')}`).meta).alerts.custom.length===4);
  ok('Cloche : compteur',/\d/.test(A.document.getElementById('bell').textContent));
  for(const v of ['accueil','mouvements','budgets','epargne','historique','parametres','messages','comptes']) ev(A,`go('${v}')`);
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
