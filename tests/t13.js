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
  const perso=ev(A,'active'); const joint=await ev(A,"createAccount({name:'Joint',bank:'Boursorama'})"); await wait(150);
  ev(A,`openAccount('${perso}')`); await wait(200);
  // historique : « Super U » déjà classé en Alimentation
  ev(A,"mutate(()=>{month().expenses.unshift({id:'h1',name:'Super U',cat:'Alimentation',amount:20,status:'Payé',isFixed:false,date:'1'});month().budgets.push({id:'bb',cat:'Alimentation',amount:400})},false)");
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]');
  ok('Virement : choix de catégorie (Aucune par défaut)',ev(A,'P.d.cat')==='Virement'&&/Aucune \(simple virement\)/.test(A.document.getElementById('panel').textContent));
  ok('Virement : choix du logo aussi vers mes comptes',!!A.document.querySelector('#panel [data-p=icon][data-v=site]'));
  const n=A.document.getElementById('pn-n'); n.value='Super U'; n.dispatchEvent(new A.Event('input',{bubbles:true}));
  ok('Libellé connu → catégorie devinée (Alimentation)',ev(A,'P.d.cat')==='Alimentation');
  click(A,'#panel [data-p=icon][data-v=site]'); ev(A,"P.d.site='magasins-u.com';P.d.amount='150';P.d.date='3';P.repeat=true");
  click(A,'#panel [data-p=save]'); await wait(1300);
  const x=JSON.parse(ev(A,"JSON.stringify(month().expenses.find(e=>e.xfer&&e.name==='Super U'))"));
  ok('Côté perso : dépense « Super U », catégorie Alimentation, logo',x&&x.cat==='Alimentation'&&x.site==='magasins-u.com'&&x.amount===150);
  const c=JSON.parse(ev(A,"JSON.stringify(calc(month(),ck()))"));
  ok('Compté dans les courses (Alimentation : 170 €, dont 150 € en charge fixe), pas en « virement »',ev(A,"vspent(month(),'Alimentation')")===170&&ev(A,"calc(month(),ck()).fixAll")===150&&c.xferOut===0&&ev(A,"catTotals(month()).Alimentation")===170);
  ok('Ligne : « Alimentation · Virement vers Joint »',/Alimentation · Virement vers Joint/.test(ev(A,`rowHTML(month().expenses.find(e=>e.name==='Super U'&&e.xfer),'expenses')`)));
  ok('Chaque mois : modèle avec catégorie et logo',ev(A,"S.templates.expenses.some(t=>t.xfer&&t.cat==='Alimentation'&&t.site==='magasins-u.com'&&t.name==='Super U')"));
  const jm=JSON.parse(shared.store.get(`accounts/${joint}/months/${nk}`).data), jmeta=JSON.parse(shared.store.get('accounts/'+joint).meta);
  ok('Côté joint : recette « Super U » avec logo',jm.incomes.some(i=>i.name==='Super U'&&i.site==='magasins-u.com'&&i.amount===150&&i.xfer));
  ok('Côté joint : recette mensuelle avec logo',jmeta.templates.incomes.some(t=>t.name==='Super U'&&t.site==='magasins-u.com'));
  // virement sans catégorie : toujours à part
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]'); ev(A,"P.d.amount='50'"); click(A,'#panel [data-p=save]'); await wait(1300);
  ok('Virement sans catégorie : reste « virement », hors dépenses',ev(A,"calc(month(),ck()).xferOut")===50&&ev(A,"catTotals(month()).Alimentation")===170);
  // modification via le panneau classique : changer la catégorie
  ev(A,`openPanel('expenses','${x.id}')`); ok('Panneau classique : chip « Virement » proposé',!!A.document.querySelector('#panel [data-p=cat][data-v=Virement]'));
  click(A,'#panel [data-p=cat][data-v=Énergie]'); click(A,'#panel [data-p=save]'); await wait(50);
  ok('Catégorie modifiée → comptée en Énergie',ev(A,"catTotals(month())['Énergie']")===150);
  for(const v of ['accueil','mouvements','budgets','historique']) ev(A,`go('${v}')`);
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
