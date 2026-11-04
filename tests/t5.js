const {JSDOM}=require('jsdom');const fs=require('fs');const install=require('./fsmock.js');
const src=fs.readFileSync(process.argv[2],'utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<link [^>]*>/g,'');
const shared={store:new Map(),listeners:new Set(),seq:0};
shared.notify=()=>setTimeout(()=>shared.listeners.forEach(L=>{try{L.fire()}catch(e){console.error('listener',e)}}),3);
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
const legacy={categories:['Logement','Alimentation','Autre'],templates:{expenses:[{tmplId:'t1',date:'4',cat:'Logement',name:'Loyer',amount:740}],incomes:[{tmplId:'i1',date:'1',name:'Salaire',amount:2300}],budgets:[]},
  months:{[nk]:{bankBalance:1000,savingGoal:null,expenses:[{id:'e1',tmplId:'t1',date:'4',cat:'Logement',name:'Loyer',amount:740,status:'Payé',isFixed:true}],incomes:[{id:'s1',tmplId:'i1',date:'1',name:'Salaire',amount:2300,status:'Reçu',isFixed:true}],budgets:[]}},savAcc:[{id:'a1',name:'Livret A',type:'Livret A',rate:3,hist:{[nk]:5000}}]};
shared.store.set('users/uA/data/budget',{budgetData:JSON.stringify(legacy)});
(async()=>{
  const A=client('robin'); await wait(20);
  A.__login({uid:'uA',email:'Robin@test.fr'}); await wait(150);
  ok('A : migration → 1 compte "Compte principal"',ev(A,'accIds.length')===1&&ev(A,'ACC[active].name')==='Compte principal');
  ok('A : données reprises (loyer, salaire, livret)',ev(A,"month().expenses.some(e=>e.name==='Loyer')&&month().incomes.length===1&&U.savAcc.length===1&&!S.savAcc"));
  ok('A : un document par mois',[...shared.store.keys()].filter(k=>k.includes('/months/')).length===1);
  ok('A : ancien bloc conservé intact',shared.store.has('users/uA/data/budget'));
  ok('A : sauvegarde du jour (par compte)',await wait(1700).then(()=>[...shared.store.keys()].some(k=>k.includes('/backups/'))));
  // ajout perso
  ev(A,"openPanel('expenses')"); A.document.getElementById('pn-a').value='12';A.document.getElementById('pn-a').dispatchEvent(new A.Event('input',{bubbles:true}));
  ev(A,"P.d.name='Pharmacie'"); click(A,'#panel [data-p=save]'); await wait(1000);
  ok('A : dépense perso enregistrée dans le cloud',JSON.stringify([...shared.store.entries()].filter(([k])=>k.includes('/months/'))).includes('Pharmacie'));
  // création compte joint + invitation
  const persoId=ev(A,'active');
  const jointId=await ev(A,"createAccount({name:'Joint Boursorama',bank:'Boursorama',color:'#0F766E'})"); await ev(A,`inviteMember('Marie@Test.fr','${jointId}','Joint Boursorama')`);
  ev(A,`openAccount('${jointId}')`); await wait(150);
  ok('A : 2 comptes, joint actif et vide',ev(A,'accIds.length')===2&&ev(A,'active')===jointId&&ev(A,'month().expenses.length')===0);
  ok('A : invitation créée',shared.store.get('invites/'+jointId+'_marie@test.fr')?.status==='pending');
  // B se connecte
  const B=client('marie'); await wait(20);
  B.__login({uid:'uB',email:'marie@test.fr'}); await wait(200);
  ok('B : compte perso créé (sans ancien bloc)',ev(B,'accIds.length')===1);
  ok('B : invitation reçue + pastille',ev(B,'INV.in.length')===1&&ev(B,'unreadCount()')===1);
  // B tente d'accepter sans email vérifié → refusé
  let denied=false; await ev(B,"acceptInvite(INV.in[0])").catch(e=>denied=e.code==='permission-denied'); ok('B : acceptation refusée sans email confirmé',denied);
  ev(B,'currentUser.emailVerified=true'); await ev(B,"acceptInvite(INV.in[0])"); ev(B,`openAccount('${jointId}')`); await wait(250);
  ok('B : membre du joint',shared.store.get('accounts/'+jointId).members.join()==='uA,uB'&&ev(B,'accIds.length')===2&&ev(B,'active')===jointId);
  ok('B : ne voit pas le compte perso de A',!ev(B,`accIds.includes('${persoId}')`)&&!ev(B,`'${persoId}' in ACC`));
  await wait(100);
  ok('A : sait que le joint est partagé',ev(A,'isShared()')===true);
  // A ajoute une dépense sur le joint → B la reçoit + activité
  ev(A,"mutate(()=>month().expenses.unshift({id:'j1',name:'Courses',cat:'Alimentation',amount:50,status:'Payé',isFixed:false,date:'3'}),'Dépense ajoutée : Courses · 50,00 €')"); await wait(1100);
  ok('B : reçoit la dépense de A en direct',ev(B,"month().expenses.some(e=>e.id==='j1')"));
  ok('B : notification d\'activité (non lue)',ev(B,'unreadCount()')>=1&&ev(B,"Object.values(ACT).flat().some(a=>a.text.includes('Courses'))"));
  // modifications simultanées sur le même mois
  ev(A,"mutate(()=>month().expenses.unshift({id:'jA',name:'Essence',cat:'Autre',amount:60,status:'Payé',isFixed:false,date:'5'}),false)");
  ev(B,"mutate(()=>month().expenses.unshift({id:'jB',name:'Cinéma',cat:'Autre',amount:20,status:'Payé',isFixed:false,date:'5'}),false)");
  await wait(2500);
  const ids=w=>ev(w,"month().expenses.map(e=>e.id).sort().join()");
  ok('Simultané : A voit les 2 ajouts ('+ids(A)+')',ids(A)==='j1,jA,jB');
  ok('Simultané : B voit les 2 ajouts ('+ids(B)+')',ids(B)==='j1,jA,jB');
  ok('Simultané : le cloud a les 2 ajouts',['jA','jB'].every(x=>shared.store.get('accounts/'+jointId+'/months/'+nk).data.includes(x)));
  // suppression chez A pendant modification chez B
  ev(A,"mutate(()=>{month().expenses=month().expenses.filter(e=>e.id!=='jA')},false)");
  ev(B,"mutate(()=>{month().expenses.find(e=>e.id==='jB').amount=25},false)");
  await wait(2500);
  ok('Fusion : suppression A + modif B conservées ('+ids(A)+' / '+ev(A,"month().expenses.find(e=>e.id==='jB')?.amount")+')',ids(A)==='j1,jB'&&ids(B)==='j1,jB'&&ev(A,"month().expenses.find(e=>e.id==='jB').amount")===25);
  // réglages (catégorie) ajoutés des deux côtés
  ev(A,"mutate(()=>S.categories.push('Vacances'),false)"); ev(B,"mutate(()=>S.categories.push('Cadeaux'),false)"); await wait(2500);
  ok('Fusion réglages : catégories des deux',ev(A,"S.categories.includes('Vacances')&&S.categories.includes('Cadeaux')")&&ev(B,"S.categories.includes('Vacances')&&S.categories.includes('Cadeaux')"));
  { const w0=shared.writes; await wait(3000); ok('Au repos : aucune écriture en boucle ('+(shared.writes-w0)+')',shared.writes-w0===0); }
  // écrans
  for(const v of ['accueil','mouvements','budgets','epargne','historique','parametres','messages','comptes']){ ev(B,`go('${v}')`); }
  ok('B : tous les écrans (dont Messagerie et Tous mes comptes) sans erreur',!errs.length);
  ok('B : messagerie lue → pastille effacée',await wait(1800).then(()=>ev(B,'unreadCount()'))===0);
  ok('Comptes : résumé du joint calculé',!!shared.store.get('accounts/'+jointId).summary);
  // séparation des comptes
  ev(A,`openAccount('${persoId}')`); await wait(150);
  ok('A : retour au perso, sans les dépenses du joint',ev(A,"!month().expenses.some(e=>e.id==='j1')&&month().expenses.some(e=>e.name==='Pharmacie')"));
  // rechargement de A
  const A2=client('robin2'); await wait(20); A2.__login({uid:'uA',email:'Robin@test.fr'}); await wait(250);
  ok('A (autre appareil) : pas de nouvelle migration, 2 comptes',ev(A2,'accIds.length')===2&&Object.keys(Object.fromEntries(shared.store)).filter(k=>k.startsWith('accounts/')&&k.split('/').length===2).length===3);
  // ---- Compte Épargne partagé
  const savId=await ev(A,"createAccount({name:'Revolut Joint',bank:'Revolut',kind:'epargne'})"); await ev(A,`inviteMember('marie@test.fr','${savId}','Revolut Joint')`); await wait(150);
  const inv2=ev(B,`JSON.stringify(INV.in.find(i=>i.acc==='${savId}'))`); await ev(B,`acceptInvite(${inv2})`); ev(B,`openAccount('${savId}')`); ev(A,`openAccount('${savId}')`); await wait(300);
  ev(B,"go('accueil')"); ok('Épargne : écran simplifié (sans Budgets)',ev(B,"isSavAcc()")&&!B.document.querySelector('[data-view=budgets]')&&/Versements et retraits/.test(B.document.getElementById('v-accueil').textContent));
  ev(B,"openPanel('expenses')"); ok('Épargne : nouvelle saisie = Versement par défaut',ev(B,'P.type')==='incomes'); B.document.getElementById('pn-a').value='200'; B.document.getElementById('pn-a').dispatchEvent(new B.Event('input',{bubbles:true}));
  ev(B,"P.d.name='Versement mensuel'"); click(B,'#panel [data-p=save]'); await wait(1300);
  ok('Épargne : versement de B visible chez A avec son auteur',ev(A,"month().incomes.some(i=>i.amount===200&&i.by==='marie@test.fr')")&&/par marie/.test(A.document.getElementById('v-accueil').textContent));
  ok('Épargne : résumé du compte = 200 €',shared.store.get('accounts/'+savId).summary.current===200);
  ev(A,"go('epargne')"); const totIn=ev(A,"document.getElementById('v-epargne').querySelector('.hero .v').textContent");
  ev(A,`U.savIncl['${savId}']=false;saveUser();render()`); const totOut=ev(A,"document.getElementById('v-epargne').querySelector('.hero .v').textContent");
  ok('Épargne : inclure / exclure du total ('+totIn.trim()+' → '+totOut.trim()+')',totIn!==totOut&&/5\s?000/.test(totOut)&&/5\s?200/.test(totIn));
  await wait(800); ok('Épargne : choix enregistré dans le profil de A',shared.store.get('users/uA').savIncl[savId]===false);
  // ---- Robustesse : liste de comptes effacée → réparation automatique au rechargement
  const uA=shared.store.get('users/uA'); const before=uA.accounts.slice(); uA.accounts=[before[0]]; shared.notify(); await wait(100);
  const A3=client('robin3'); await wait(20); A3.__login({uid:'uA',email:'Robin@test.fr'}); await wait(600);
  ok('Réparation : comptes retrouvés ('+shared.store.get('users/uA').accounts.length+'/'+before.length+')',before.every(x=>shared.store.get('users/uA').accounts.includes(x)));
  ok('Réparation : aucun compte en double créé',[...shared.store.keys()].filter(k=>/^accounts\/[^/]+$/.test(k)&&shared.store.get(k).owner==='uA').length===before.length);
  { const u=shared.store.get('users/uA'); const keep=u.accounts.slice(); u.accounts=[]; shared.notify(); await wait(50);
    const A4=client('robin4'); await wait(20); A4.__login({uid:'uA',email:'Robin@test.fr'}); await wait(800);
    ok('Liste vide : comptes retrouvés sans en recréer',keep.every(x=>shared.store.get('users/uA').accounts.includes(x))&&[...shared.store.keys()].filter(k=>/^accounts\/[^/]+$/.test(k)&&shared.store.get(k).owner==='uA').length===keep.length); }
  // ---- Robustesse : changement d'utilisateur dans le même navigateur pendant une modification en attente
  const mk=`accounts/${persoId}/months/${nk}`; ev(A3,`openAccount('${persoId}')`); await wait(200);
  const m0=shared.store.get(mk).data; const w0=JSON.stringify(shared.store.get('users/uA').accounts);
  ev(A3,"mutate(()=>month().expenses.unshift({id:'zz',name:'Test',cat:'Autre',amount:1,status:'Payé',isFixed:false,date:'1'}),false)");
  A3.__auth.user={uid:'uB',email:'marie@test.fr',emailVerified:true};   // l'autre onglet s'est connecté en Marion
  await wait(1200);
  ok('Changement d\'utilisateur : rien écrit avec la mauvaise session',shared.store.get(mk).data===m0&&JSON.stringify(shared.store.get('users/uA').accounts)===w0);
  // B quitte le joint
  await ev(B,`leaveAccount('${jointId}')`); await wait(300);
  ok('B quitte : plus membre, A garde le compte',shared.store.get('accounts/'+jointId).members.join()==='uA'&&!ev(B,`accIds.includes('${jointId}')`)&&ev(B,`active!=='${jointId}'`));
  // A supprime le joint
  ev(A,`openAccount('${jointId}')`); await wait(150); await ev(A,`deleteAccountData('${jointId}')`); await wait(300);
  ok('A supprime le joint : tout est effacé',![...shared.store.keys()].some(k=>k.includes(jointId)&&!k.startsWith('invites/'))&&!ev(A,`accIds.includes('${jointId}')`));
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
