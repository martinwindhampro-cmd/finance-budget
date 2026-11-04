const {JSDOM}=require('jsdom');const fs=require('fs');const install=require('./fsmock.js');
let html=fs.readFileSync(process.argv[2],'utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<link [^>]*>/g,'');
const shared={store:new Map(),listeners:new Set(),seq:0};shared.notify=()=>setTimeout(()=>shared.listeners.forEach(L=>L.fire()),3);
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){install(w,shared);w.__charts=0;w.Chart=class{constructor(){w.__charts++}destroy(){}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
w.scrollTo=()=>{};w.Element.prototype.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.confirm=()=>true;w.alert=()=>{};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};w.print=()=>{};}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
const errs=[];w.addEventListener('error',e=>errs.push(e.message));
const click=sel=>{const el=typeof sel==='string'?d.querySelector(sel):sel;if(!el)throw new Error('introuvable: '+sel);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
const typeIn=(el,v,ev='input')=>{el.value=v;el.dispatchEvent(new w.Event(ev,{bubbles:true}));};
const ok=(name,cond)=>{console.log((cond?'✅':'❌')+' '+name);if(!cond)process.exitCode=1;};
// --- ancienne donnée (format V1)
const nk=(()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')})();
const pk=(()=>{const x=new Date();x.setDate(1);x.setMonth(x.getMonth()-1);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')})();
const T={expenses:[{tmplId:'t1',date:'4',cat:'Logement',name:'Loyer net',amount:740,isDivided:false},{tmplId:'t2',date:'',cat:'Abonnement',name:'Spotify Premium',amount:7.07},{tmplId:'t3',date:'28',cat:'Énergie',name:'Électricité (EDF)',amount:100}],incomes:[{tmplId:'i1',date:'1',name:'Salaire',amount:2300}],budgets:[{tmplId:'b1',cat:'Alimentation',amount:400}]};
const mk=(st)=>({bankBalance:null,savingGoal:150,expenses:[{id:'e1',tmplId:'t1',date:'4',cat:'Logement',name:'Loyer net',amount:740,status:st,isFixed:true},{id:'e2',tmplId:'t2',date:'',cat:'Abonnement',name:'Spotify Premium',amount:7.07,status:'Prévu',isFixed:true},{id:'e3',tmplId:'t3',date:'28',cat:'Énergie',name:'Électricité (EDF)',amount:100,status:'Prévu',isFixed:true},{id:'v1',date:'2',cat:'Alimentation',name:'Courses',amount:84.5,status:'Payé',isFixed:false,isDivided:true}],incomes:[{id:'s1',tmplId:'i1',date:'1',name:'Salaire',amount:2300,status:'Reçu',isFixed:true}],budgets:[{id:'bb',tmplId:'b1',cat:'Alimentation',amount:400}]});
const old={categories:['Logement','Énergie','Assurance','Abonnement','Banque','Alimentation','Transport','Santé','Loisirs','Autre'],templates:T,months:{[pk]:Object.assign(mk('Payé'),{bankBalance:1000}),[nk]:mk('Payé')},savAcc:[{id:'a1',name:'Livret A',type:'Livret A',rate:3,hist:{[pk]:5000,[nk]:5200}}],savings:{monthly:150}};
(async()=>{
  shared.store.set('users/u1/data/budget',{budgetData:JSON.stringify(old)});
  await wait(20); w.__login({uid:'u1',email:'robin@test.fr'});
  ok('écran de chargement',!$('loading').hidden);
  await wait(200);
  ok('app affichée',!$('app').hidden);
  ok('accueil : reste à vivre affiché',/Reste à vivre/.test($('v-accueil').textContent));
  const c=w.eval('calc(month(),ck())');
  ok('reste à vivre = solde actuel + recettes à venir − à payer − épargne ('+c.rav.toFixed(2)+')',Math.abs(c.rav-(c.current+c.incWait-c.outPlan-c.saving))<0.001);
  ok('fin de mois = reste à vivre − dépenses habituelles à venir ('+c.est.toFixed(2)+')',Math.abs(c.est-(c.rav-(c.vr?c.vr.v:0)))<0.001);
  w.eval("S.templates.expenses.find(t=>t.tmplId==='t2').site='spotify.com'; month().expenses.push({id:'zz',name:'spotify premium',cat:'Loisirs',amount:3,status:'Payé',isFixed:false,date:'3'}); render()");
  ok('logo lié au nom (mouvement sans site)',/spotify\.com/.test(w.eval("ico(month().expenses.find(e=>e.id==='zz'),'expenses')")));
  w.eval("month().expenses=month().expenses.filter(e=>e.id!=='zz'); delete S.templates.expenses.find(t=>t.tmplId==='t2').site; render()");
  ok('½ compté pour moitié',Math.abs(w.eval('calc(month(),ck()).varAll')-42.25)<0.001);
  ok('infobulles présentes ('+d.querySelectorAll('#v-accueil .tip').length+')',d.querySelectorAll('#v-accueil .tip').length>=5);
  await wait(1700); ok('sauvegarde quotidienne créée',[...shared.store.keys()].some(k=>k.includes('/backups/')));
  // navigation dans tous les écrans
  for(const v of ['mouvements','budgets','epargne','historique','parametres','accueil']){ click(`[data-view="${v}"]`); ok('écran '+v+' sans erreur',!$('v-'+v).hidden&&$('v-'+v).innerHTML.length>200&&!errs.length); }
  // ajout d'une dépense via la fiche
  click('[data-a=new]'); ok('fiche ouverte',$('panel').classList.contains('on'));
  typeIn($('pn-a'),'23,40'); typeIn($('pn-n'),'Courses');
  ok('catégorie auto (Alimentation)',d.querySelector('#panel [data-p=cat].on')?.dataset.v==='Alimentation');
  click('#panel [data-p=save]'); await wait(10);
  ok('dépense ajoutée',w.eval("month().expenses.some(e=>e.amount===23.4&&e.cat==='Alimentation'&&!e.isFixed)"));
  ok('toast avec Annuler',!!$('toast').querySelector('button'));
  // annuler
  click('#toast button'); ok('annulation OK',!w.eval("month().expenses.some(e=>e.amount===23.4)"));
  // nouvelle charge fixe avec logo du site
  click('[data-a=new]'); typeIn($('pn-a'),'10'); typeIn($('pn-n'),'Forfait'); click('#panel [data-p=icon][data-v=site]'); typeIn($('pn-site'),'https://www.exemple.fr/offre'); 
  d.querySelector('#panel [data-p=repeat]').checked=true; click('#panel [data-p=repeat]'); d.querySelector('#panel [data-p=repeat]').checked=true; w.eval('P.repeat=true');
  click('#panel [data-p=save]'); await wait(10);
  ok('charge fixe créée + modèle',w.eval("S.templates.expenses.some(t=>t.name==='Forfait'&&t.site==='exemple.fr')"));
  // modifier une charge fixe et appliquer aux mois suivants
  click('[data-view=mouvements]');
  const loyer=w.eval("month().expenses.find(e=>e.name==='Loyer net').id");
  w.eval(`openPanel('expenses','${loyer}')`); typeIn($('pn-a'),'760'); click('#panel [data-p=save]'); await wait(10);
  ok('modèle loyer mis à jour (760)',w.eval("S.templates.expenses.find(t=>t.tmplId==='t1').amount")===760);
  ok('loyer déjà payé du mois modifié aussi',w.eval("month().expenses.find(e=>e.name==='Loyer net').amount")===760);
  // statut rapide
  const spot=d.querySelector('[data-a=tst]'); const before=w.eval(`month().expenses.concat(month().incomes).find(e=>e.id==='${spot.dataset.id}').status`); click(spot);
  ok('changement de statut ('+before+' → '+w.eval(`month().expenses.concat(month().incomes).find(e=>e.id==='${spot.dataset.id}').status`)+')',w.eval(`month().expenses.concat(month().incomes).find(e=>e.id==='${spot.dataset.id}').status`)!==before);
  // filtres et recherche
  click('[data-a=flt][data-v=fixed]'); ok('filtre Fixes',[...d.querySelectorAll('#v-mouvements .rowb')].length===w.eval('month().expenses.filter(e=>e.isFixed).length+month().incomes.filter(e=>e.isFixed).length'));
  click('[data-a=flt][data-v=all]'); $('q').focus(); typeIn($('q'),'spot'); ok('recherche',d.querySelectorAll('#v-mouvements .rowb').length===1&&d.activeElement.id==='q');
  typeIn($('q'),'');
  // mois suivant : brouillon non sauvegardé, puis ajout
  click('[data-a=next]'); await wait(900);
  const nx=w.eval('ck()'); ok('mois seulement consulté non sauvegardé',![...shared.store.keys()].some(k=>k.endsWith('/months/'+nx)));
  ok('mois suivant contient Forfait (modèle)',w.eval("month().expenses.some(e=>e.name==='Forfait'&&e.site==='exemple.fr')"));
  ok('solde chaîné ('+w.eval('calc(month(),ck()).init').toFixed(2)+')',isFinite(w.eval('calc(month(),ck()).init')));
  click('[data-a=prev]');
  // budgets : dialogue
  click('[data-view=budgets]'); click('[data-a=bud]'); typeIn($('f_amount'),'450'); d.querySelector('#dlg form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  ok('budget modifié + modèle',w.eval("month().budgets[0].amount")===450&&w.eval("S.templates.budgets[0].amount")===450);
  ok('calendrier échéancier',d.querySelectorAll('.cal .d').length===w.eval('dim(ck())'));
  // solde du 1er
  click('[data-view=accueil]'); click('[data-a=bank]'); typeIn($('f_b'),'1234,56'); d.querySelector('#dlg form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  ok('solde du 1er saisi',w.eval('month().bankBalance')===1234.56&&w.eval('calc(month(),ck()).init')===1234.56);
  // épargne : simulateur
  click('[data-view=epargne]'); click('[data-a=sim-open]'); const r=d.querySelector('[data-sv=monthly]'); typeIn(r,'300'); ok('simulateur réactif',/Total versé/.test($('sv-res').textContent)&&w.eval('sv().monthly')===300);
  click('[data-a=sv-apply]'); ok('épargne appliquée au mois',w.eval('month(nowK()).savingGoal')===300);
  // historique
  click('[data-view=historique]'); ok('historique lignes',d.querySelectorAll('#v-historique tbody tr').length>=2);
  click('[data-a=hp][data-v="-1"]'); ok('mode année',/Année/.test($('v-historique').textContent));
  click('[data-a=csv]');
  // paramètres : modèle inline
  w.eval("UI.pt='fixes'"); click('[data-view=parametres]'); const amt=d.querySelector('[data-tpl=expenses][data-id=t3] [data-f=amount]'); typeIn(amt,'120','change'); await wait(10);
  const it=w.eval("month().expenses.find(e=>e.tmplId==='t3')");ok('modèle électricité modifié inline (mois: '+it.status+' '+it.amount+')',w.eval("S.templates.expenses.find(t=>t.tmplId==='t3').amount")===120&&(it.status==='Payé'?it.amount===100:it.amount===120));
  w.eval("UI.pt='donnees';render()"); click('[data-a=bk-list]'); await wait(20); ok('liste des sauvegardes',d.querySelectorAll('#bk-list [data-a=bk-res]').length>=1);
  // alertes
  click('[data-a=alerts]'); ok('cloche → messagerie',!$('v-messages').hidden&&/Alertes/.test($('v-messages').textContent)); console.log('DBG active',d.activeElement&&d.activeElement.tagName,d.activeElement&&d.activeElement.id,'P',w.eval('!!P'),'dlg',$('dlg').open);
  // synchro distante
  await wait(900); const aid=w.eval('active'); const ad=shared.store.get('accounts/'+aid); const mm=JSON.parse(ad.meta); mm.categories.push('Vacances');
  ad.meta=JSON.stringify(mm); ad.updatedBy='autre'; shared.notify(); await wait(30);
  ok('modif autre appareil reçue',w.eval("S.categories.includes('Vacances')"));
  // raccourci clavier
  d.activeElement.blur(); d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'n',bubbles:true})); ok('raccourci N',$('panel').classList.contains('on')); d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  ok('Échap ferme la fiche',!$('panel').classList.contains('on'));
  await wait(900);
  const months=[...shared.store.keys()].filter(k=>k.includes('/months/'));
  ok('données cloud valides ('+months.length+' mois)',months.some(k=>k.endsWith(nk))&&JSON.parse(shared.store.get('accounts/'+aid).meta).templates.expenses.some(t=>t.amount===120));
  ok('graphiques créés ('+w.__charts+')',w.__charts>=3);
  console.log('Erreurs JS :',errs.length?errs:'aucune');
  process.exit(process.exitCode||0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
