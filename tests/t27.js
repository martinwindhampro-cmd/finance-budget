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
const inp=(w,el,v)=>{el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const chg=(w,el,v)=>{el.value=v;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
const rows=w=>[...w.document.querySelectorAll('#sp-rows .sprow')];
const sub=w=>w.document.querySelector('#dlg form').dispatchEvent(new w.Event('submit',{cancelable:true}));
const V=w=>w.document.getElementById('v-budgets').textContent.replace(/\s+/g,' ');
const OUT=w=>!!w.document.querySelector('#v-budgets .dhead.out');
const go=async(w,acc)=>{w.eval(`openAccount('${acc}')`); await wait(400); w.eval("go('budgets')"); await wait(150);};
(async()=>{
  const A=client('robin'); await wait(20); A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  const rperso=ev(A,'active'); const joint=await ev(A,"createAccount({name:'Revolut Joint',bank:'Revolut'})"); await ev(A,`inviteMember('marion@test.fr','${joint}','Revolut Joint')`); await wait(150);
  const B=client('marion'); await wait(20); B.__login({uid:'uB',email:'marion@test.fr',emailVerified:true}); await wait(300); await B.eval("acceptInvite(INV.in[0])"); await wait(300);
  const mperso=ev(B,`accIds.find(a=>a!=='${joint}')`);
  B.eval(`U.recvAcc='${joint}';saveUser()`);   // piège : son compte par défaut est le joint
  await A.eval("linkRequest('marion@test.fr')"); await wait(200); await B.eval("linkAnswer(linkPending()[0].id,true)"); await wait(400);
  await go(A,joint);
  const mk=async(name,tot)=>{ ev(A,"splitDialog()"); await wait(30); inp(A,A.document.getElementById('sp-name'),name); inp(A,A.document.getElementById('sp-tot'),String(tot));
    const me=A.document.getElementById('sp-me'); me.checked=false; me.dispatchEvent(new A.Event('change',{bubbles:true}));
    chg(A,rows(A)[0].querySelector('select'),'a:'+rperso); A.document.querySelector('[data-sp-add]').dispatchEvent(new A.MouseEvent('click',{bubbles:true})); chg(A,rows(A)[1].querySelector('select'),'u:uB');
    sub(A); await wait(1500); A.eval("$('dlg').open&&$('dlg').close()"); };
  await mk('Argent mariage',540); await mk('BlaBlacar',44.28); await mk('Restaurant Chalimar',68.80);
  console.log('— Marion accepte ses 3 parts');
  B.eval("go('messages')"); await wait(100);
  ok('Marion : « Revolut Joint te demande 270,00 € »',/Revolut Joint te demande 270,00/.test(B.document.getElementById('v-messages').textContent));
  B.eval("inviteDialog(invitesForMe()[0].id)"); await wait(50);
  ok('Le compte joint n\'est pas proposé pour rembourser (c\'est lui qui a avancé)',![...B.document.getElementById('f_acc').options].some(o=>o.text==='Revolut Joint'));
  B.eval("$('dlg').close()");
  for(const d of B.eval("invitesForMe().map(d=>d.id)")) { B.eval(`inviteDialog('${d}')`); await wait(50); sub(B); await wait(700); }
  await go(A,joint); await go(B,joint); console.log('VB',(V(B).match(/Remboursements.{0,420}/)||[''])[0]);
  ok('Robin, compte joint : À recevoir 653,08 € (3 partages)',/À recevoir\s?653,08/.test(V(A))&&!OUT(A));
  ok('Marion, compte joint : À recevoir 653,08 € aussi, rien « à rembourser »',/À recevoir\s?653,08/.test(V(B))&&!OUT(B));
  ok('Chaque partage : « 2 personnes », reste 540 / 44,28 / 68,80',/Argent mariage · 2 personnes Reste 540,00/.test(V(B))&&/BlaBlacar · 2 personnes Reste 44,28/.test(V(B))&&/Restaurant Chalimar · 2 personnes Reste 68,80/.test(V(B)));
  await go(B,mperso); ok('Marion, compte perso : À rembourser 326,54 €',/À rembourser\s?326,54/.test(V(B)));
  await go(A,rperso); ok('Robin, compte principal : À rembourser 326,54 €',/À rembourser\s?326,54/.test(V(A)));
  console.log('— Marion rembourse sa part du mariage depuis son compte perso');
  await go(B,mperso); const mid=B.eval("allDebts().find(e=>e.d.name==='Argent mariage'&&e.home.shared).d.id");
  await B.eval(`payDialog('${mid}')`); await wait(60);
  ok('Par défaut : depuis son compte perso vers Revolut Joint',B.document.getElementById('f_from').value.startsWith('Compte')&&/^Revolut Joint/.test(B.document.getElementById('f_to').value));
  sub(B); await wait(1500); B.eval("$('dlg').open&&$('dlg').close()");
  await go(A,joint); ok('Joint (Robin) : Argent mariage · reste 270 € sur 540 €',/Argent mariage · 2 personnes Reste 270,00\s€ sur 540,00/.test(V(A)));
  ok('Recette de 270 € arrivée sur le joint',ev(A,"month(nowK()).incomes.some(i=>i.amount===270)"));
  B.eval("debtView('"+mid+"')"); await wait(50); ok('Fiche (Marion) : « A avancé : Revolut Joint »',/Aavancé\s*RevolutJoint/.test(B.document.getElementById('dlg').textContent.replace(/\s+/g,''))); B.eval("$('dlg').close()");
  console.log('— Ancien partage où Marion avait choisi le joint pour rembourser');
  await B.eval(`updateDebt({d:PDEBTS.find(x=>x.name==='BlaBlacar'),home:{shared:PDEBTS.find(x=>x.name==='BlaBlacar').id}},x=>{x.borrower.acc='${joint}'})`); await wait(400);
  await go(B,joint); ok('Réparé à l\'affichage : toujours rien « à rembourser » sur le joint',!OUT(B));
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
