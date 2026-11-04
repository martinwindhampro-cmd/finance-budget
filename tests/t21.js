// Faux positifs : 200 mois aléatoires, un virement reçu non noté ne doit presque jamais être « regroupé » à tort
const {JSDOM}=require('jsdom');const fs=require('fs');const install=require('./fsmock.js');
const src=fs.readFileSync(process.argv[2],'utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<link [^>]*>/g,'');
const shared={store:new Map(),listeners:new Set(),seq:0};shared.notify=()=>{};
const dom=new JSDOM(src,{runScripts:'dangerously',url:'https://x.test/a',pretendToBeVisual:true,beforeParse(w){install(w,shared);w.Chart=class{destroy(){}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};w.Element.prototype.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});}});
const w=dom.window;
(async()=>{ await new Promise(r=>setTimeout(r,50)); w.__login({uid:'uA',email:'a@t.fr'}); await new Promise(r=>setTimeout(r,400)); w.eval("cur=new Date(2026,9,1)");
  let fp=0,N=200,rnd=(a,b)=>a+Math.random()*(b-a);
  for(let t=0;t<N;t++){
    const L=[];for(let i=0;i<25;i++){const d=1+Math.floor(rnd(0,21));L.push({date:'2026-10-'+String(d).padStart(2,'0'),amt:-Math.round(rnd(1,60)*100),label:'CB COMMERCE '+i});}
    const c={date:'2026-10-'+String(5+Math.floor(rnd(0,16))).padStart(2,'0'),amt:Math.round(rnd(5,80)*100),label:'VIR RECU DE QUELQU UN'};L.push(c);
    
    // l'app a noté toutes les dépenses, pas le virement reçu
    w.__L=L; w.eval("(()=>{const m=month('2026-10');m.expenses=[];m.incomes=[];m.rec={};__L.filter(l=>l.amt<0).forEach((l,i)=>m.expenses.push({id:'x'+i,name:'Achat '+i,amount:-l.amt/100,date:String(+l.date.slice(8)),status:'Payé',cat:'Autre',isFixed:false,isDivided:false}))})()");
    w.eval("BK={lines:__L.map((l,i)=>Object.assign({},l,{i,h:bkHash(l)})),months:['2026-10'],k:'2026-10',acc:active,bal:null}");
    if(w.eval("bkMatch('2026-10').approx.length")) { fp++; if(fp===1) console.log(w.eval("JSON.stringify((()=>{const R=bkMatch('2026-10');return {ok:R.ok.length,a:R.A.length,b:R.B.length,g:R.approx.map(g=>[g.c.amt,g.D.map(b=>b.amt),g.free.length])}})())")); }
  }
  console.log('Faux regroupements :',fp,'/',N, fp/N<=0.05?'✅ OK (≤ 5 %)':'❌ trop');process.exit(0);
})();
