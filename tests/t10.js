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
(async()=>{
  const A=client('robin'); await wait(20); A.eval("innerWidth"); A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  ev(A,"setMode('simple')"); ev(A,"$('dlg').open&&$('dlg').close()");
  ok('Simple : 3 onglets (Accueil, Mouvements, Réglages)',[...A.document.querySelectorAll('#navlist .nav')].map(b=>b.textContent).join()==='Accueil,Mouvements,Réglages');
  ok('Simple : accueil avec gros boutons',!!A.document.querySelector('#v-accueil [data-a=s-new][data-t=expenses]')&&/Il me reste/.test(A.document.getElementById('v-accueil').textContent));
  click(A,'#v-accueil [data-a=s-new][data-t=expenses]'); ok('Saisie simple ouverte',/C'est quoi/.test(A.document.getElementById('panel').textContent)&&!/Catégorie/.test(A.document.getElementById('panel').textContent));
  ev(A,"P.d.amount='45';P.d.name='Boulangerie';P.d.date='20'"); click(A,'#panel [data-p=spaid][data-v="0"]'); A.document.querySelector('#panel [data-p=repeat]').checked=true; A.document.querySelector('#panel [data-p=repeat]').dispatchEvent(new A.MouseEvent('click',{bubbles:true}));
  ev(A,"P.repeat=true"); click(A,'#panel [data-p=save]'); await wait(100);
  const x=JSON.parse(ev(A,"JSON.stringify(month().expenses.find(e=>e.name==='Boulangerie'))"));
  ok('Dépense simple : catégorie Autre, à payer, chaque mois ('+x.cat+','+x.status+','+x.isFixed+')',x.cat==='Autre'&&x.status==='Prévu'&&x.isFixed===true);
  ok('Libellé « À payer » sur la ligne',/À payer/.test(A.document.getElementById('v-accueil').textContent));
  ev(A,`openPanel('expenses','${x.id}')`); click(A,'#panel [data-p=full]'); ok('Plus d\'options → panneau complet',/Catégorie/.test(A.document.getElementById('panel').textContent)); ev(A,'closePanel()');
  ev(A,"go('budgets')"); ok('Simple : écran Budgets inaccessible → Accueil',ev(A,'UI.view')==='accueil');
  ev(A,"go('parametres')"); ok('Réglages simples',/Mon compte/.test(A.document.getElementById('v-parametres').textContent)&&!/Charges fixes/.test(A.document.getElementById('v-parametres').textContent));
  click(A,'[data-a=s-allset]');ev(A,"UI.pt='fixes';render()"); ok('Tous les réglages accessibles',/Charges fixes/.test(A.document.getElementById('v-parametres').textContent));
  ev(A,"go('mouvements')"); ok('Mouvements simples : 3 filtres',A.document.querySelectorAll('#v-mouvements [data-a=flt]').length===3);
  ev(A,"setMode('full')"); ok('Retour au mode complet : 6 onglets',A.document.querySelectorAll('#navlist .nav').length===6);
  for(const v of ['accueil','mouvements','budgets','epargne','historique','parametres','messages','comptes']) ev(A,`go('${v}')`);
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
