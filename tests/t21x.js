// Faux positifs : 200 mois aléatoires, un virement reçu non noté ne doit presque jamais être « regroupé » à tort
const {JSDOM}=require('jsdom');const fs=require('fs');const install=require('./fsmock.js');
const src=fs.readFileSync(process.argv[2],'utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<link [^>]*>/g,'');
const shared={store:new Map(),listeners:new Set(),seq:0};shared.notify=()=>{};
const dom=new JSDOM(src,{runScripts:'dangerously',url:'https://x.test/a',pretendToBeVisual:true,beforeParse(w){install(w,shared);w.Chart=class{destroy(){}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.scrollTo=()=>{};w.Element.prototype.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});}});
const w=dom.window;
(async()=>{ await new Promise(r=>setTimeout(r,50)); w.__login({uid:'uA',email:'a@t.fr'}); await new Promise(r=>setTimeout(r,400)); w.eval("cur=new Date(2026,9,1)");
  const L=[{date:'2026-10-20',amt:-1500,label:'CB SNCF 19/10'},{date:'2026-10-20',amt:-720,label:'CB SNCF 19/10'},{date:'2026-10-22',amt:2220,label:'VIR MARION'},{date:'2026-10-05',amt:-990,label:'PRLV FREE'}];
  w.__L=L; w.eval("(()=>{const m=month('2026-10');m.expenses=[{id:'s',name:'Sncf',amount:7.2,date:'19',status:'Payé',cat:'Transport',isFixed:false,isDivided:false},{id:'f',name:'Free',amount:9.9,date:'5',status:'Payé',cat:'Autre',isFixed:false,isDivided:false}];m.incomes=[];m.rec={}})()");
  w.eval("BK={lines:__L.map((l,i)=>Object.assign({},l,{i,h:bkHash(l)})),months:['2026-10'],k:'2026-10',acc:active,bal:null}");
  const G=w.eval("bkMatch('2026-10').approx"); console.log(G.length===1&&G[0].diff===0&&G[0].D.length===2?'✅ remboursement exact 22,20 = 15 + 7,20 repéré':'❌ exact non repéré '+JSON.stringify(G.map(g=>[g.c.amt,g.D.map(b=>b.amt)])));process.exit(0);
})();