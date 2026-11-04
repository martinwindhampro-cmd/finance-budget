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
  const A=client('robin'); await wait(20); A.__login({uid:'uA',email:'Robin@test.fr'}); await wait(250);
  const perso=ev(A,'active');
  const joint=await ev(A,"createAccount({name:'Joint Boursorama',bank:'Boursorama'})"); await wait(150);
  ok('A : 2 comptes',ev(A,'accIds.length')===2);
  // ---- Virement interne via le panneau
  ev(A,`openAccount('${perso}')`); await wait(150);
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]');
  ok('Panneau : onglet Virement, compte d\'arrivée proposé',ev(A,'P.type')==='xfer'&&ev(A,'P.dest')===joint&&!!A.document.querySelector('#panel [data-p=dest]'));
  ev(A,"P.d.amount='150'"); click(A,'#panel [data-p=save]'); await wait(1300);
  const exp=ev(A,"JSON.stringify(month().expenses.find(e=>e.xfer))"); const xe=JSON.parse(exp||'null');
  ok('Interne : sortie sur le perso (150, Virement)',xe&&xe.amount===150&&xe.cat==='Virement'&&xe.xfer.acc===joint);
  const jm=()=>JSON.parse(shared.store.get(`accounts/${joint}/months/${nk}`)?.data||'{"incomes":[]}');
  ok('Interne : entrée sur le joint, même identifiant',jm().incomes.some(i=>i.amount===150&&i.xfer.id===xe.xfer.id&&i.name==='Virement de Compte principal'));
  ok('Interne : pas compté comme dépense hors budget',ev(A,'calc(month(),ck()).varOut')===0&&ev(A,'calc(month(),ck()).xferOut')===150);
  ok('Interne : libellé de ligne',/Virement vers Joint Boursorama/.test(ev(A,"rowHTML(month().expenses.find(e=>e.xfer),'expenses')")));
  // modification → répercutée
  ev(A,`openPanel('expenses','${xe.id}')`); ev(A,"P.d.amount='175'"); click(A,'#panel [data-p=save]'); await wait(1300);
  ok('Interne : modif du montant répercutée (175)',jm().incomes.some(i=>i.xfer?.id===xe.xfer.id&&i.amount===175));
  // ouverture du joint : l'entrée est là
  ev(A,`openAccount('${joint}')`); await wait(250);
  ok('Joint ouvert : la recette apparaît',ev(A,"month().incomes.some(i=>i.xfer&&i.amount===175)"));
  ev(A,`openAccount('${perso}')`); await wait(250);
  // suppression → répercutée
  ev(A,`openPanel('expenses','${xe.id}')`); click(A,'#panel [data-p=del]'); await wait(1300);
  ok('Interne : suppression répercutée',!jm().incomes.some(i=>i.xfer?.id===xe.xfer.id)&&!ev(A,"month().expenses.some(e=>e.xfer)"));
  // virement mensuel
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]'); ev(A,"P.d.amount='50';P.d.date='5';P.repeat=true"); click(A,'#panel [data-p=save]'); await wait(1300);
  const jmeta=JSON.parse(shared.store.get('accounts/'+joint).meta);
  ok('Mensuel : modèle recette sur le joint + modèle charge ici',jmeta.templates.incomes.some(t=>t.amount===50&&t.xfer)&&ev(A,"S.templates.expenses.some(t=>t.xfer&&t.amount===50)"));
  ev(A,"cur.setMonth(cur.getMonth()+1)"); ok('Mensuel : présent le mois prochain ici',ev(A,"month(ck()).expenses.some(e=>e.xfer&&e.amount===50)")); ev(A,"cur.setMonth(cur.getMonth()-1)");
  // ---- Virement vers une personne
  const B=client('marie'); await wait(20); B.__login({uid:'uB',email:'marie@test.fr'}); await wait(300);
  const bAcc=ev(B,'active');
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]'); click(A,'#panel [data-p=xk][data-v=person]');
  ok('Personne : aucune suggestion au départ',!A.document.querySelector('#panel [data-p=sugg]'));
  ev(A,"P.d.amount='42,50';P.d.email='Marie@test.fr';P.d.name='Resto';P.d.date='12'"); click(A,'#panel [data-p=save]'); await wait(1500);
  const tx=[...shared.store.entries()].find(([k])=>k.startsWith('transfers/'));
  ok('Personne : virement déposé',!!tx&&tx[1].to==='marie@test.fr'&&tx[1].amount===42.5);
  ok('B : reçu en direct comme recette (libellé, montant, date)',ev(B,"month().incomes.some(i=>i.name==='Resto'&&i.amount===42.5&&i.date==='12'&&i.status==='Reçu')"));
  ok('Statut « reçu » + compte',shared.store.get(tx[0]).status==='received'&&shared.store.get(tx[0]).toAcc===bAcc);
  ok('B : une seule recette (pas de doublon)',ev(B,"month().incomes.filter(i=>i.name==='Resto').length")===1&&JSON.parse(shared.store.get(`accounts/${bAcc}/months/${nk}`).data).incomes.filter(i=>i.name==='Resto').length===1);
  ok('B : pastille messagerie',ev(B,'unreadCount()')>=1);
  ok('A : sortie marquée « reçu ✓ »',/reçu ✓/.test(ev(A,"rowHTML(month().expenses.find(e=>e.xfer?.kind==='person'),'expenses')")));
  ev(B,"go('messages')"); ok('B : section Virements dans la messagerie',/Resto/.test(B.document.getElementById('v-messages').textContent));
  // suggestion
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]'); click(A,'#panel [data-p=xk][data-v=person]');
  const sg=A.document.querySelector('#panel [data-p=sugg]'); ok('Suggestion : Marie proposée',!!sg&&sg.dataset.v==='marie@test.fr');
  click(A,sg); ok('Suggestion : un clic remplit l\'email',ev(A,'P.d.email')==='marie@test.fr'); ev(A,'closePanel()');
  ok('Contacts enregistrés dans le profil',(shared.store.get('users/uA').contacts||[]).some(c=>c.email==='marie@test.fr'&&c.n===1));
  // B hors ligne → reçu à la connexion
  B.close(); await wait(50);
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]'); click(A,'#panel [data-p=xk][data-v=person]'); ev(A,"P.d.amount='10';P.d.email='marie@test.fr';P.d.name='Cadeau'"); click(A,'#panel [data-p=save]'); await wait(1200);
  const tid=[...shared.store.entries()].find(([k,v])=>k.startsWith('transfers/')&&v.label==='Cadeau')[0];
  ok('Hors ligne : en attente (envoyé)',shared.store.get(tid).status==='sent');
  // A modifie avant réception → transmis
  const cid=ev(A,"month().expenses.find(e=>e.name==='Cadeau').id"); ev(A,`openPanel('expenses','${cid}')`); ev(A,"P.d.amount='12'"); click(A,'#panel [data-p=save]'); await wait(1200);
  ok('Avant réception : modification transmise',shared.store.get(tid).amount===12);
  // B se reconnecte sur 2 onglets en même temps → une seule recette
  const B2=client('marie2'), B3=client('marie3'); await wait(20); shared.txDelay=30;
  B2.__login({uid:'uB',email:'marie@test.fr'}); B3.__login({uid:'uB',email:'marie@test.fr'}); await wait(1500); shared.txDelay=0;
  ok('Reconnexion (2 onglets) : reçu une seule fois',JSON.parse(shared.store.get(`accounts/${bAcc}/months/${nk}`).data).incomes.filter(i=>i.name==='Cadeau'&&i.amount===12).length===1&&shared.store.get(tid).status==='received');
  // compte de réception choisi
  const bSav=await ev(B2,"createAccount({name:'Livret B',bank:'Revolut',kind:'epargne'})"); await wait(100);
  ev(B2,`U.recvAcc='${bSav}';saveUser()`); await wait(900);
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]'); click(A,'#panel [data-p=xk][data-v=person]'); ev(A,"P.d.amount='5';P.d.email='marie@test.fr';P.d.name='Remb'"); click(A,'#panel [data-p=save]'); await wait(1500);
  ok('Compte de réception choisi respecté',JSON.parse(shared.store.get(`accounts/${bSav}/months/${nk}`)?.data||'{"incomes":[]}').incomes.some(i=>i.name==='Remb'));
  // sécurité : B ne peut pas modifier le montant d'un virement reçu
  let den=false; await B2.eval(`db.collection('transfers').doc('${tid.split('/')[1]}').update({amount:999})`).catch(e=>den=e.code==='permission-denied'); ok('Sécurité : le destinataire ne peut pas changer le montant',den);
  // ---- Choix du compte du destinataire
  await wait(1500);
  const dir=shared.store.get('directory/marie@test.fr'); ok('Annuaire de B publié ('+(dir?.accounts||[]).map(a=>a.name).join(', ')+')',dir&&dir.accounts.length===2&&dir.recv===bSav);
  ok('Annuaire : pas de soldes',!JSON.stringify(dir).includes('summary')&&!JSON.stringify(dir).includes('current'));
  ok('Sans connexion : comptes de B non visibles',!(await A.eval("db.collection('directory').doc('marie@test.fr').get().then(()=>true).catch(()=>false)")));
  await A.eval("linkRequest('marie@test.fr')"); await wait(200); ok('B reçoit la demande de connexion',B2.eval('linkPending().length')===1);
  await B2.eval("linkAnswer(linkPending()[0].id,true)"); await wait(300); ok('Connectés',A.eval("isLinked('marie@test.fr')"));
  ev(A,"openPanel('expenses')"); click(A,'#panel [data-p=type][data-v=xfer]'); click(A,'#panel [data-p=xk][data-v=person]'); click(A,'#panel [data-p=sugg]'); await wait(100);
  const tbtn=[...A.document.querySelectorAll('#panel [data-p=tacc]')]; ok('Panneau : comptes de B proposés ('+tbtn.length+'), défaut présélectionné',tbtn.length===2&&ev(A,'P.toAcc')===bSav);
  click(A,`#panel [data-p=tacc][data-v="${bAcc}"]`); ev(A,"P.d.amount='7';P.d.name='Choisi'"); click(A,'#panel [data-p=save]'); await wait(1600);
  const inB=k=>JSON.parse(shared.store.get(`accounts/${k}/months/${nk}`)?.data||'{"incomes":[]}').incomes;
  ok('Reçu sur le compte choisi par l\'expéditeur (pas le défaut)',inB(bAcc).some(i=>i.name==='Choisi')&&!inB(bSav).some(i=>i.name==='Choisi'));
  ok('Expéditeur : ligne indique le compte',/Compte principal/.test(ev(A,"rowHTML(month().expenses.find(e=>e.name==='Choisi'),'expenses')")));
  // B masque un compte
  ev(B2,"UI.pt='profil';go('parametres')"); const cb=B2.document.querySelector(`[data-rvis="${bAcc}"]`); cb.checked=false; cb.dispatchEvent(new B2.Event('change',{bubbles:true})); await wait(2200);
  ok('Compte masqué retiré de l\'annuaire',shared.store.get('directory/marie@test.fr').accounts.length===1);
  // B déplace un virement reçu
  ev(B2,`openAccount('${bAcc}')`); await wait(300);
  const rid=ev(B2,"month().incomes.find(i=>i.name==='Choisi').id"); ev(B2,`openPanel('incomes','${rid}')`);
  ok('Panneau reçu : bouton Déplacer',!!B2.document.querySelector(`#panel [data-p=xmove][data-v="${bSav}"]`));
  click(B2,`#panel [data-p=xmove][data-v="${bSav}"]`); await wait(1600);
  ok('Déplacé : sur le livret, plus sur le principal',inB(bSav).some(i=>i.name==='Choisi')&&!inB(bAcc).some(i=>i.name==='Choisi'));
  ev(B2,"go('messages')"); ok('Messagerie : indique le nouveau compte',/Choisi[\s\S]*sur Livret B/.test(B2.document.getElementById('v-messages').textContent));
  // B supprime un virement reçu → disparaît de la messagerie
  ev(B2,`openAccount('${bSav}')`); await wait(300);
  const rid2=ev(B2,"month().incomes.find(i=>i.name==='Choisi').id"); ev(B2,`openPanel('incomes','${rid2}')`); click(B2,'#panel [data-p=del]'); await wait(300);
  ev(B2,"go('messages')"); ok('Supprimé → retiré de la messagerie',!/Choisi/.test(B2.document.getElementById('v-messages').textContent));
  const hb=B2.document.querySelector('#v-messages [data-a=xf-hide]'); click(B2,hb); ok('Bouton × : retire une ligne',B2.document.querySelectorAll('#v-messages [data-a=xf-hide]').length>=0&&ev(B2,'U.xfHide.length')===2);
  await wait(900); ok('Masquages enregistrés (autres appareils)',(shared.store.get('users/uB').xfHide||[]).length===2);
  for(const v of ['accueil','mouvements','budgets','messages','parametres']) ev(A,`go('${v}')`);
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
