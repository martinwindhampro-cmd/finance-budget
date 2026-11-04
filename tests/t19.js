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
const D=w=>w.document.getElementById('dlg');
const K=ev=>0;
// Opérations du mois (jour, libellé banque, montant)
const OPS=[[1,'VIR SALAIRE ACME SAS',2300],[4,'PRLV SEPA FONCIA LOYER',-740],[6,'CB RESTAU LE BISTROT 06/10',-22],[7,'VIR INST MARION DUPONT',22],[8,'PRLV SEPA EDF CLIENTS PARTICULIERS',-62],
 [10,'CB CARREFOUR MARKET 10/10',-45.30],[11,'CB BOULANGERIE PAUL 11/10',-3.20],[12,'PRLV NETFLIX.COM',-13.49],[14,'CB LA TABLE DU MARCHE',-40],[16,'VIR MARION DUPONT REMB RESTO',20],
 [15,'CB AMAZON US 15/10 USD 27,30',-23.61],[18,'CB PATHE CINEMA',-24],[19,'VIR LUCAS MARTIN',12],[20,'PRLV FREE MOBILE',-15.99]];
const START=1000, END=Math.round((START+OPS.reduce((s,o)=>s+o[2],0))*100)/100;
const k='2026-10', fr=n=>n.toFixed(2).replace('.',','), dfr=d=>String(d).padStart(2,'0')+'/10/2026';
const FILES={
 'CA.csv':'Téléchargement du 21/10/2026;\n\nCOMPTE CHEQUES N° 123;\nSolde au 21/10/2026 '+fr(END).replace(/\B(?=(\d{3})+,)/g,' ')+' €;\n\nListe des opérations du compte entre le 01/10/2026 et le 21/10/2026;\n\nDate;Libellé;Débit euros;Crédit euros;\n'+OPS.map(o=>`${dfr(o[0])};"${o[1].replace(' ','\n')}";${o[2]<0?fr(-o[2]):''};${o[2]>0?fr(o[2]):''};`).join('\n')+'\n',
 'bourso.csv':'dateOp;dateVal;label;category;categoryParent;supplierFound;amount;comment;accountNum;accountLabel;accountbalance\n'+OPS.slice().reverse().map(o=>`2026-10-${String(o[0]).padStart(2,'0')};2026-10-${String(o[0]).padStart(2,'0')};"${o[1]}";"Divers";"Divers";"";"${fr(o[2]).replace(/\B(?=(\d{3})+,)/g,' ')}";;00040;"Joint";${fr(END)}`).join('\n'),
 'revolut.csv':(()=>{let b=START;return 'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n'+OPS.map(o=>{const fee=o[1].includes('AMAZON')?0.16:0;const amt=o[2]+fee;b=Math.round((b+o[2])*100)/100;return `CARD_PAYMENT,Current,2026-10-${String(o[0]).padStart(2,'0')} 10:00:00,2026-10-${String(o[0]).padStart(2,'0')} 12:00:00,${o[1].replace(/,/g,' ')},${amt.toFixed(2)},${fee.toFixed(2)},EUR,COMPLETED,${b.toFixed(2)}`}).join('\n')+'\nCARD_PAYMENT,Current,2026-10-13 10:00:00,,Annulé,-50.00,0.00,EUR,REVERTED,'})(),
 'releve.ofx':'OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n'+OPS.map(o=>`<STMTTRN>\n<TRNTYPE>OTHER\n<DTPOSTED>202610${String(o[0]).padStart(2,'0')}\n<TRNAMT>${o[2].toFixed(2)}\n<NAME>${o[1]}\n</STMTTRN>`).join('\n')+`\n</BANKTRANLIST><LEDGERBAL><BALAMT>${END.toFixed(2)}<DTASOF>20261021</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
};
const APP=`mutate(()=>{const m=month('${k}');m.bankBalance=${START};m.expenses=[];m.incomes=[];m.budgets=[];
 const E=(name,amount,date,status,extra)=>m.expenses.push(Object.assign({id:'e_'+name,name,amount,date:String(date),status,cat:'Autre',isFixed:false,isDivided:false},extra||{}));
 E('Loyer',740,4,'Payé');E('EDF',62,8,'Payé');E('Courses',45.30,10,'Payé');E('Netflix',13.49,12,'Payé');E('Restaurant',40,14,'Payé',{isDivided:true});
 E('Amazon',23.45,15,'Payé',{fx:{cur:'USD',amt:27.30,rate:0.859,date:'2026-10-15'}});E('Cinéma',12,18,'Payé');E('Forfait Free',15.99,20,'Prévu');E('Pharmacie',8.50,17,'Payé');
 m.incomes.push({id:'i_sal',name:'Salaire',amount:2300,date:'1',status:'Reçu',isFixed:false});},false)`;
(async()=>{
  const A=client('robin'); await wait(20); A.TextDecoder=TextDecoder; A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  ev(A,"cur=new Date(2026,9,1)"); ev(A,APP); await wait(200); ev(A,"go('mouvements')");
  console.log('Banque fin :',END,' · App :',ev(A,`calc(month('${k}'),'${k}').current`));
  ok('Bouton « Vérifier avec le relevé » dans Mouvements',!!A.document.querySelector('#v-mouvements [data-a=bank-check]'));
  ok('½ Partagé arrondi au centime (10,99 → 5,50)',ev(A,"eff({isDivided:true,amount:10.99})")===5.5);
  for(const [name,txt] of Object.entries(FILES)){
    console.log('— '+name);
    const r=ev(A,'bkParse')(txt,name); ok('Lu : '+r.lines.length+' opérations (attendu '+OPS.length+')',r.lines.length===OPS.length);
    if(name==='revolut.csv') ok('Revolut : frais compris dans le montant (Amazon −23,61), annulée ignorée',r.lines.some(l=>l.amt===-2361)&&!r.lines.some(l=>l.amt===-5000));
    if(name==='CA.csv') ok('CA : solde du relevé lu ('+fr(END)+' €)',r.bal&&r.bal.amt===Math.round(END*100));
    ev(A,'UI.bkBal=null'); ev(A,'bkLoad')(r); await wait(50);
    const T=D(A).textContent, R=ev(A,"bkMatch(BK.k)");
    ok('Solde banque trouvé tout seul'+(name==='bourso.csv'?' (Boursorama : à saisir)':''),name==='bourso.csv'||A.document.getElementById('bk-bal').value===fr(END));
    if(name==='bourso.csv'){ const i=A.document.getElementById('bk-bal'); i.value=fr(END); i.dispatchEvent(new A.Event('change',{bubbles:true})); await wait(80); }
    const T2=D(A).textContent;
    ok('Pointées au centime : 7 (loyer, salaire, EDF, courses, Netflix, resto, Free)',R.ok.length===7);
    ok('−22 / +22 Marion : « s\'annulent », rien à saisir',R.pairs.length===1&&R.pairs[0].b.amt===-2200);
    ok('Cinéma noté en net (−24 +12 = −12)',R.net.length===1&&R.net[0].a.label==='Cinéma');
    ok('½ Partagé Restaurant : remboursement de 20 € de Marion reconnu',R.half.length===1&&R.half[0].r&&R.half[0].r.amt===2000);
    ok('Amazon : montant différent de 0,16 € (paiement en USD)',R.near.length===1&&R.near[0].b.amt-R.near[0].a.amt===-16&&/USD : taux et frais/.test(T2));
    ok('Boulangerie −3,20 seulement à la banque',R.bOnly.length===1&&R.bOnly[0].amt===-320);
    ok('Forfait Free : passé en banque, encore « à payer »',R.unpaid.length===1);
    ok('Pharmacie : notée payée, pas dans le relevé',R.aOnly.filter(a=>a.paid).length===1&&R.aOnly.find(a=>a.paid).label==='Pharmacie');
    ok('Écart entièrement expliqué',/Tout l'écart s'explique/.test(T2));

  }
  console.log('— Corrections depuis l\'écran');
  const clickB=sel=>{const b=D(A).querySelector(sel);if(!b)throw new Error('introuvable '+sel);b.dispatchEvent(new A.MouseEvent('click',{bubbles:true}));};
  clickB('[data-fix]'); await wait(80); clickB('[data-add]'); await wait(80); clickB('[data-paid]'); await wait(80); clickB('[data-unpaid]'); await wait(80);
  const T3=D(A).textContent; const R3=ev(A,"bkMatch(BK.k)");
  ok('Après corrections : plus rien à traiter',!R3.near.length&&!R3.bOnly.length&&!R3.unpaid.length&&!R3.aOnly.some(a=>a.paid));
  ok('Écart 0 € : il reste seulement les cas normaux à valider (s\'annulent, net)',/Écart|Relevé pointé/.test(T3)&&ev(A,"bkItems(bkMatch(BK.k),bkBalances(bkMatch(BK.k))).every(i=>i.ok)"));
  clickB('[data-valall]'); await wait(100); const T4=D(A).textContent;
  ok('« Valider les cas normaux » → « ✓ Relevé pointé · aucun écart »',/Relevé pointé · aucun écart/.test(T4));
  ok('Solde de l\'app = solde de la banque',Math.round(ev(A,`calc(month('${k}'),'${k}').current`)*100)===Math.round(END*100));
  ok('Boulangerie ajoutée (nom nettoyé : « Boulangerie paul »)',ev(A,`month('${k}').expenses.some(e=>/^Boulangerie paul$/i.test(e.name)&&e.amount===3.2&&e.date==='11')`));
  ok('Amazon corrigé à 23,61 €',ev(A,`month('${k}').expenses.find(e=>e.name==='Amazon').amount`)===23.61);
  clickB('[data-x]'); ev(A,"render()"); ok('Mouvements : « ✓ vérifié le … »',/pointé le/.test(A.document.querySelector('[data-a=bank-check]').textContent));
  console.log('— Ignorer / écart d\'avant le mois');
  ev(A,`mutate(()=>{month('${k}').bankBalance=${START-0.07}},false)`); await wait(50);
  ev(A,'bkLoad')(ev(A,'bkParse')(FILES['releve.ofx'],'x')); await wait(50);
  ok('Écart de 0,07 € venant d\'avant le mois → « Corriger le solde au 1er »',/Écart : \+0,07/.test(D(A).textContent)&&/vient d'avant ce mois/.test(D(A).textContent));
  A.confirm=()=>true; clickB('[data-recal]'); await wait(80); ok('Solde au 1er corrigé → relevé pointé',/Relevé pointé · aucun écart/.test(D(A).textContent));
  ev(A,`mutate(()=>{const m=month('${k}');m.expenses=m.expenses.filter(e=>!/boulangerie/i.test(e.name))},false)`); ev(A,'bkView()'); await wait(50);
  ok('Boulangerie retirée de l\'app → carte « Pas noté dans l\'app » avec Ajouter / C\'est normal',!!D(A).querySelector('[data-val^="b:"]')&&!!D(A).querySelector('[data-add]'));
  clickB('[data-val^="b:"]'); await wait(100); ok('« C\'est normal » : validée → relevé pointé avec écart validé',/Relevé pointé · écart de −?3,20\s€ validé|Relevé pointé · écart de -3,20/.test(D(A).textContent)||/Relevé pointé · écart/.test(D(A).textContent));
  ev(A,'bkLoad')(ev(A,'bkParse')(FILES['CA.csv'],'x')); await wait(50); ok('Réimport : toujours validée',/Relevé pointé/.test(D(A).textContent));
  console.log('— Format inconnu → choix des colonnes');
  const odd='Quand|Quoi|Valeur\n'.replace(/\|/g,';')+'03/10/2026;Truc;-12,50\n04/10/2026;Bidule;30,00\n';
  ev(A,'BK=null'); const f=new A.File([odd],'x.csv',{type:'text/csv'}); if(!f.arrayBuffer) f.arrayBuffer=()=>Promise.resolve(new TextEncoder().encode(odd).buffer);
  await ev(A,'bankImport')(f); await wait(50); ok('Fenêtre « Quelles colonnes ? »',/Quelles colonnes/.test(D(A).textContent));
  const sel=(id,i)=>{const s=A.document.getElementById(id);s.selectedIndex=i;};
  sel('f_d',0);sel('f_l',1);sel('f_a',3); D(A).querySelector('form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(150);
  ok('Lu avec les colonnes choisies',ev(A,"BK&&BK.lines.length")===2);
  console.log('— Fichier latin-1 (vieux export)');
  const lat=Buffer.from(FILES['CA.csv'],'latin1'); const f2=new A.File([''],'ca.csv'); f2.arrayBuffer=()=>Promise.resolve(lat.buffer.slice(lat.byteOffset,lat.byteOffset+lat.length));
  await ev(A,'bankImport')(f2); await wait(80); ok('Accents et opérations lus (latin-1), fusionnés avec le relevé précédent',ev(A,"BK.lines.length")===OPS.length+2&&ev(A,"BK.lines.some(l=>/Libell|LOYER/.test(l.label))"));
  for(const v of ['accueil','mouvements','budgets']) ev(A,`go('${v}')`);
  ok('Aucune erreur JS',!errs.length);
  console.log('Erreurs JS :',errs.length?errs:'aucune');console.log(fails?fails+' échec(s)':'TOUT EST OK');process.exit(0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
