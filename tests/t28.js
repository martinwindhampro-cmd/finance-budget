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
const ev=(w,js)=>w.eval(js), D=w=>w.document.getElementById('dlg');
(async()=>{
  const A=client('robin'); await wait(20); A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  const liv=await ev(A,"createAccount({name:'Livret A',bank:'Crédit Agricole',kind:'epargne'})"); ev(A,`openAccount('${liv}')`); await wait(400);
  ev(A,`mutate(()=>{month('2026-01').bankBalance=1000;month('2026-03').incomes.push({id:'v1',name:'Versement',amount:500,date:'10',status:'Reçu',isFixed:false});month('2026-06').expenses.push({id:'r1',name:'Retrait',amount:200,date:'20',status:'Payé',cat:'Autre',isFixed:false,isDivided:false});},false)`); await wait(200);
  ev(A,"go('accueil')"); const V=()=>A.document.getElementById('v-accueil').textContent.replace(/\s+/g,' ');
  ok('Compte épargne : carte « Intérêts » avec « Fixer le taux et les caractéristiques »',/Fixer le taux et les caractéristiques/.test(V()));
  A.document.querySelector('[data-a=sav-int]').click(); await wait(50);
  ok('Fenêtre : type, taux, calcul, versement, fiscalité, plafond',['f_type','f_rate','f_calc','f_pay','f_tax','f_cap'].every(id=>A.document.getElementById(id)));
  ok('Livret A pré-rempli : quinzaines, 31 décembre, net d\'impôt, plafond 22 950',/quinzaine/.test(A.document.getElementById('f_calc').value)&&/31 décembre/.test(A.document.getElementById('f_pay').value)&&/Net/.test(A.document.getElementById('f_tax').value)&&/22950/.test(A.document.getElementById('f_cap').value));
  A.document.getElementById('f_rate').value='1,5'; D(A).querySelector('form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(200); ev(A,'render()');
  // calcul indépendant par quinzaines : 1000 jusqu'au versement (compte à partir de la quinzaine suivante), retrait retiré dès sa quinzaine
  const nk=new Date(), mi=nk.getMonth(), dimN=new Date(nk.getFullYear(),mi+1,0).getDate(), td=nk.getDate(), full=Math.max(0,mi-6);   // mois complets après juin (juillet = 6)
  const bases=4*1000 + 1000+1500 + 4*1500 + 1500+1300 + 2*1300*full, cur=2*1300*td/dimN;
  const expYtd=Math.round((bases+cur)*0.015/24*100)/100;
  const I=ev(A,'savInterest()'); console.log('ytd',I.ytd.toFixed(4),'attendu',expYtd,'année',I.year.toFixed(2));
  ok('Intérêts gagnés depuis janvier = '+expYtd+' € (calcul par quinzaines)',Math.abs(I.ytd-expYtd)<0.006);
  ok('Affichage : 1,5 % · par quinzaine · versés au 31 décembre · net d\'impôt',/1,5 % par an · par quinzaine/.test(V())&&/versés au 31 décembre/.test(V())&&/net d'impôt/.test(V()));
  ok('Plafond : 1 300 € sur 22 950 €',/Plafond : 1\s?300\s€ sur 22\s?950\s€/.test(V()));
  console.log('— Compte rémunéré : au jour le jour, chaque mois, flat tax 30 %');
  A.document.querySelector('[data-a=sav-int]').click(); await wait(50);
  const t=A.document.getElementById('f_type'); t.value='Livret bancaire / compte rémunéré'; t.dispatchEvent(new A.Event('change',{bubbles:true}));
  ok('Le type pré-remplit : au jour le jour, chaque mois, 30 %, sans plafond',/jour le jour/.test(A.document.getElementById('f_calc').value)&&/Chaque mois/.test(A.document.getElementById('f_pay').value)&&/30/.test(A.document.getElementById('f_tax').value)&&A.document.getElementById('f_cap').value==='');
  A.document.getElementById('f_rate').value='3'; D(A).querySelector('form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(200); ev(A,'render()');
  const I2=ev(A,'savInterest()'), sep=ev(A,"savMonthInt('2026-09',3,'d')");
  ok('Septembre au jour le jour : 1 300 × 3 % × 30/365 = '+(1300*0.03*30/365).toFixed(2),Math.abs(sep-1300*0.03*30/365)<0.001);
  ok('Proposition : « Intérêts septembre 2026 » (net 30 %) → Ajouter au compte',new RegExp('Intérêts '+A.eval("mlab(kAdd(nowK(),-1)).toLowerCase()")+' : environ').test(V()));
  A.document.querySelector('[data-a=sav-int-add]').click(); await wait(200); ev(A,'render()');
  const pk=A.eval("kAdd(nowK(),-1)"), pv=A.eval(`savMonthInt('${pk}',3,'d')`);
  ok('Ajoutés le 1er du mois, une seule fois',ev(A,`month(nowK()).incomes.filter(i=>i.int==='${pk}').length`)===1&&Math.abs(ev(A,`month(nowK()).incomes.find(i=>i.int==='${pk}').amount`)-Math.round(pv*0.7*100)/100)<0.001&&!/Ajouter au compte/.test(V()));
  console.log('— Compte joint : les caractéristiques sont partagées');
  await ev(A,`inviteMember('marie@test.fr','${liv}','Livret A')`); await wait(150);
  const B=client('marie'); await wait(20); B.__login({uid:'uB',email:'marie@test.fr',emailVerified:true}); await wait(300); await B.eval("acceptInvite(INV.in[0])"); await wait(300);
  B.eval(`openAccount('${liv}')`); await wait(500); ok('Marie voit le même taux (3 %)',B.eval('savCfg()&&savCfg().rate')===3);
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
