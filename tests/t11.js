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
  const A=client('robin'); await wait(20); A.__login({uid:'uA',email:'robin@test.fr'}); await wait(400);
  ev(A,"setMode('simple');$('dlg').open&&$('dlg').close()");
  ev(A,"mutate(()=>month().expenses.unshift({id:'p1',name:'Pain',cat:'Autre',amount:30,status:'Payé',isFixed:false,date:'2'}),false)");
  click(A,'#v-accueil .srow[data-a=bank]'); A.document.getElementById('f_b').value='500'; A.document.querySelector('#dlg form').dispatchEvent(new A.Event('submit',{cancelable:true})); await wait(50);
  ok('Solde du jour saisi → affiché tel quel ('+ev(A,"calc(month(),ck()).current")+')',Math.abs(ev(A,"calc(month(),ck()).current")-500)<0.001&&ev(A,"month().bankBalance")===530);
  console.log(errs.length?errs:'', fails?'ÉCHEC':'TOUT EST OK'); process.exit(0);
})();
