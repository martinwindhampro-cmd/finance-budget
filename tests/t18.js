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
const conf=async W=>{await W.eval("Promise.all(payConfirmsForMe().map(({d,p})=>payConfirm(d.id,p.id,true,ACC[p.toAcc]?p.toAcc:recvAccount())))");await wait(1500);};
let fails=0;const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)fails++;};
const click=(w,sel)=>{const el=typeof sel==='string'?w.document.querySelector(sel):sel;if(!el)throw new Error(w.name_+' introuvable: '+sel);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
const nk=(()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')})();
const sub=w=>w.document.querySelector('#dlg form').dispatchEvent(new w.Event('submit',{cancelable:true}));
const close=w=>w.eval("$('dlg').open&&$('dlg').close()");
const ev=(w,js)=>w.eval(js);
const D=w=>w.document.getElementById('dlg');
const inp=(w,el,v)=>{el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const chg=(w,el,v)=>{el.value=v;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
const rows=w=>[...w.document.querySelectorAll('#sp-rows .sprow')];
// Remplit le partage : parts = [['u:uB'] | ['txt','Léa'], montant libre?]
async function split(w,{name,tot,me=true,mode='eq',parts,acc}){
  ev(w,"splitDialog()"); await wait(30);
  inp(w,w.document.getElementById('sp-name'),name); inp(w,w.document.getElementById('sp-tot'),String(tot));
  if(acc) chg(w,w.document.getElementById('sp-acc'),acc);
  const me_=w.document.getElementById('sp-me'); if(me_.checked!==me){me_.checked=me;me_.dispatchEvent(new w.Event('change',{bubbles:true}));}
  if(mode==='free') click(w,'[data-sp-mode=free]');
  for(let i=0;i<parts.length;i++){ if(i>0) click(w,'[data-sp-add]'); const r=rows(w)[i]; chg(w,r.querySelector('select'),parts[i][0]); const r2=rows(w)[i];
    if(parts[i][0]==='txt') inp(w,r2.querySelector('[data-who]'),parts[i][1]); if(mode==='free') inp(w,r2.querySelector('[data-amt]'),String(parts[i][2])); }
}
(async()=>{
  const A=client('robin'); await wait(20); A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  const B=client('marie'); await wait(20); B.__login({uid:'uB',email:'marie@test.fr',emailVerified:true}); await wait(300);
  const C=client('paul'); await wait(20); C.__login({uid:'uC',email:'paul@test.fr',emailVerified:true}); await wait(300);
  const perso=ev(A,'active'), bperso=ev(B,'active');
  const bliv=await ev(B,"createAccount({name:'Compte Marie 2',bank:'LCL'})"); ev(B,`openAccount('${bperso}')`); await wait(300);
  await A.eval("linkRequest('marie@test.fr')"); await A.eval("linkRequest('paul@test.fr')"); await wait(200);
  await B.eval("linkAnswer(linkPending()[0].id,true)"); await C.eval("linkAnswer(linkPending()[0].id,true)"); await wait(400);
  const PM=(a,k)=>JSON.parse(shared.store.get(`accounts/${a}/months/${k}`)?.data||'{"incomes":[],"expenses":[]}');
  ev(A,"go('budgets')"); const V=w=>w.document.getElementById('v-budgets').textContent;
  console.log('— 1. Parts égales : Restaurant 120 € (moi + Marie + Paul + Léa)');
  await split(A,{name:'Restaurant',tot:120,parts:[['u:uB'],['u:uC'],['txt','Léa']]});
  const amts=rows(A).map(r=>r.querySelector('[data-amt]').value);
  console.log('amts',amts);ok('Parts calculées : 30 / 30 / 30 (+ ma part 30)',amts.join('|')==='30|30|30'&&/Ma part : 30,00/.test(A.document.getElementById('sp-sum').textContent));
  ok('Bouton « Envoyer les 2 demandes »',/Envoyer les 2 demandes/.test(A.document.getElementById('sp-ok').textContent));
  sub(A); await wait(1500);
  const P=[...shared.store.entries()].filter(([k])=>k.startsWith('pdebts/')).map(([k,v])=>v);
  ok('2 demandes partagées « en attente » (Marie, Paul)',P.length===2&&P.every(d=>d.invite.status==='pending'&&d.amount===30));
  ok('Part de Léa suivie de mon côté (30 €)',ev(A,"debts().some(d=>d.borrower.who==='Léa'&&d.amount===30&&d.grp)"));
  ok('Dépense de 120 € ajoutée au compte, liée au partage',ev(A,"month(nowK()).expenses.some(e=>e.name==='Restaurant'&&e.amount===120&&e.split)"));
  ok('Fiche du partage ouverte : 4 lignes (moi + 3)',/Restaurant/.test(D(A).textContent)&&D(A).querySelectorAll('[data-part]').length===3&&/sa part/.test(D(A).textContent)); close(A); ev(A,'render()');
  ok('Budgets : une seule ligne « Restaurant · 3 personnes · ⏳ 2 »',/Restaurant · 3 personnes/.test(V(A))&&/⏳ 2/.test(V(A))&&A.document.querySelectorAll('#v-budgets [data-a=grp-open]').length===1);
  console.log('— 2. Côté Marie : notification, accepter avec son compte');
  ok('Marie : badge cloche + demande dans la Messagerie',ev(B,'unreadCount()')>=1&&(ev(B,"go('messages')"),/te demande 30,00\s€ · Restaurant/.test(B.document.getElementById('v-messages').textContent)));
  ok('Marie : rien dans « À rembourser » avant d\'accepter',(ev(B,"go('budgets')"),!/Restaurant/.test(V(B))));
  ev(B,"go('messages')"); click(B,'#v-messages [data-a=inv-split]'); await wait(50);
  ok('Fenêtre : total, détail des parts, choix du compte',/120,00/.test(D(B).textContent)&&/Léa 30,00/.test(D(B).textContent)&&!!B.document.getElementById('f_acc'));
  chg(B,B.document.getElementById('f_acc'),'Compte Marie 2'); sub(B); await wait(900);
  const mid=P.find(d=>d.borrower.uid==='uB').id;
  ok('Acceptée, compte choisi enregistré',ev(A,`findDebt('${mid}').d.invite.status`)==='accepted'&&ev(B,`findDebt('${mid}').d.borrower.acc`)===bliv);
  ok('Marie : visible dans « À rembourser » de son compte choisi',(ev(B,`openAccount('${bliv}')`),await wait(400),ev(B,"go('budgets')"),/Restaurant/.test(V(B))));
  console.log('— 3. Paul refuse → Robin choisit');
  ev(C,"go('messages')"); click(C,'#v-messages [data-a=inv-split-no]'); await wait(900);
  ev(A,"go('messages')"); ok('Robin : « Paul a refusé sa part » + 3 choix',/Paul a refusé sa part de 30,00/.test(A.document.getElementById('v-messages').textContent)&&A.document.querySelectorAll('#v-messages [data-a=split-dec]').length===3);
  ev(A,"go('budgets')"); ok('Budgets : « ❌ 1 refus », reste à récupérer sans Paul = 60 €',/1 refus/.test(V(A))&&/Reste 60,00/.test(V(A)));
  const pid=P.find(d=>d.borrower.uid==='uC').id;
  ev(A,"go('messages')"); click(A,`#v-messages [data-a=split-dec][data-v=keep][data-id="${pid}"]`); await wait(1200);
  ok('Gardée en suivi perso : « Paul » (nom) dans le partage, demande supprimée',!shared.store.has('pdebts/'+pid)&&ev(A,"debts().some(d=>d.borrower.who==='Paul'&&d.grp)"));
  ev(A,"go('budgets')"); ok('Reste à récupérer : 90 €, plus de refus',/Reste 90,00/.test(V(A))&&!/refus/.test(V(A)));
  console.log('— 4. Remboursement de Marie → le partage suit');
  await B.eval(`payDialog('${mid}')`); await wait(50); sub(B); await wait(1500); close(B); ev(A,'render()');
  ok('Reste 60 € sur 90 €, 33 %',/Reste 60,00\s€ sur 90,00/.test(V(A)));
  await wait(800);ok('Robin doit confirmer : rien sur son compte avant',ev(A,'payConfirmsForMe().length')===1&&!PM(perso,nk).incomes.some(i=>/Restaurant/.test(i.name)));
  await conf(A); ok('Robin confirme : 30 € reçus sur son compte',PM(perso,nk).incomes.some(i=>/Restaurant/.test(i.name)&&i.amount===30));
  console.log('— 5. Montants libres, sans moi');
  await split(A,{name:'Airbnb',tot:100,me:false,mode:'free',parts:[['u:uB',0,70],['txt','Léa',20]]});
  ok('Reste 10 € à répartir → refusé',/Reste 10,00\s€ à répartir/.test(A.document.getElementById('sp-sum').textContent)&&(sub(A),await wait(100),D(A).open));
  inp(A,rows(A)[1].querySelector('[data-amt]'),'30'); ok('Total juste → OK',/À récupérer 100,00/.test(A.document.getElementById('sp-sum').textContent));
  sub(A); await wait(1200); close(A);
  ok('Airbnb : Marie 70 € (demande) + Léa 30 €',[...shared.store.values()].some(d=>d.name==='Airbnb'&&d.amount===70&&d.invite)&&ev(A,"debts().some(d=>d.name==='Airbnb'&&d.amount===30)"));
  console.log('— 6. Arrondis : 100 € entre 3 (moi compris)');
  await split(A,{name:'Cadeau',tot:100,parts:[['u:uB'],['txt','Léa']]});
  ok('33,33 / 33,33, ma part 33,34',rows(A).map(r=>r.querySelector('[data-amt]').value).join('|')==='33,33|33,33'&&/Ma part : 33,34/.test(A.document.getElementById('sp-sum').textContent)); close(A);
  console.log('— 7. Depuis une dépense existante (fiche du mouvement)');
  ev(A,`mutate(()=>month(nowK()).expenses.unshift({id:'ex1',name:'Courses',amount:60,date:'3',status:'Payé',cat:'Alimentation',isFixed:false,isDivided:false}),false)`); await wait(200);
  ev(A,"go('mouvements')"); ev(A,"openPanel('expenses','ex1')"); await wait(50);
  click(A,'#panel [data-p=split]'); await wait(400);
  ok('Pré-rempli (Courses, 60 €), pas de 2ᵉ dépense proposée',A.document.getElementById('sp-name').value==='Courses'&&/60/.test(A.document.getElementById('sp-tot').value)&&!A.document.getElementById('sp-add'));
  chg(A,rows(A)[0].querySelector('select'),'txt'); inp(A,rows(A)[0].querySelector('[data-who]'),'Tom'); sub(A); await wait(1200); close(A);
  ok('Dépense reliée, pas de doublon',ev(A,"month(nowK()).expenses.filter(e=>e.name==='Courses').length")===1&&!!ev(A,"month(nowK()).expenses.find(e=>e.id==='ex1').split"));
  ev(A,"openPanel('expenses','ex1')"); await wait(50); ok('Fiche du mouvement : « 👥 Partagée · voir »',/Partagée · voir/.test(A.document.getElementById('panel').textContent)); ev(A,'closePanel()');
  console.log('— 8. Annuler une demande pas encore acceptée');
  const air=[...shared.store.entries()].find(([k,d])=>d.name==='Airbnb')[0].split('/')[1];
  A.confirm=()=>true; await ev(A,`removeDebt(findDebt('${air}'))`); await wait(800);
  ok('Retirée directement (pas besoin de l\'accord de Marie)',!shared.store.has('pdebts/'+air)&&!ev(B,`invitesForMe().some(d=>d.id==='${air}')`));
  ok('Marie n\'a plus la demande Airbnb',!/Airbnb/.test((ev(B,"go('messages')"),B.document.getElementById('v-messages').textContent)));
  console.log('— 9. Historique quand tout est remboursé');
  const ids=ev(A,"allDebts().filter(e=>e.d.grp&&e.d.grp.name==='Restaurant'&&!debtInfo(e.d).done).map(e=>e.d.id)");
  for(const id of ids){ if(ev(A,`!!findDebt('${id}').home.shared`)) continue; await A.eval(`payDialog('${id}')`); await wait(50); console.log('dlg',D(A).querySelector('h2')?.textContent, A.document.getElementById('f_amt')?.value); sub(A); await wait(100); console.log('toast',A.document.getElementById('toast').textContent); await wait(1300); close(A); }
  ev(A,"go('budgets');UI.debtHist=true;render()");
  console.log(ids, ev(A,"JSON.stringify(allDebts().filter(e=>e.d.grp&&e.d.grp.name==='Restaurant').map(e=>[e.d.borrower.who||e.d.borrower.email,debtInfo(e.d).left,e.d.doneAt,lenderAcc(e)===active]))"), V(A).slice(-400));ok('Partage Restaurant soldé → dans l\'historique',!A.document.querySelector('#v-budgets .dpart [data-a=grp-open]:not(.done)')||!/Restaurant · 3/.test(V(A)));
  ok('Historique : « Restaurant · reçu 90 € sur 90 € »',/Restaurant · reçu 90\s€ sur 90\s€/.test(V(A)));
  for(const v of ['accueil','mouvements','budgets','messages']) { ev(A,`go('${v}')`); ev(B,`go('${v}')`); ev(C,`go('${v}')`); }
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
