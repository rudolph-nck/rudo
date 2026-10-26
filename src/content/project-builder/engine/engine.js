/* Project Builder guide engine: renders a guide from the JSON in #guide-data.
   Shared by every data-driven guide (see engine/README.md for the format). */
(function(){
"use strict";
var G=JSON.parse(document.getElementById("guide-data").textContent);
var KEY="pb-guide:"+G.slug;
var S;
try{S=JSON.parse(localStorage.getItem(KEY)||"{}");}catch(e){S={};}
S.answers=S.answers||{};S.tools=S.tools||{};S.done=S.done||{};S.skipped=S.skipped||{};S.quizSkip=S.quizSkip||{};S.timers=S.timers||[];
S.tab=S.tab||"start";S.stepMode=S.stepMode||"index";S.listMode=S.listMode||"steps";
(G.questions||[]).forEach(function(q){if(S.answers[q.id]===undefined) S.answers[q.id]=q.default;});
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ---------- helpers ---------- */
function $(s,r){return (r||document).querySelector(s);}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function frac(x){
  if(!isFinite(x)) return "—";
  var neg=x<0;x=Math.abs(x);var w=Math.floor(x),n=Math.round((x-w)*16);if(n===16){w++;n=0;}
  var d=16;while(n&&n%2===0){n/=2;d/=2;}
  var s=(w?w:"")+(n?(w?" ":"")+n+"/"+d:"");return (neg?"−":"")+(s||"0")+'"';
}
function note(kind,tag,html){return '<div class="note '+kind+'"><b class="tag">'+esc(tag)+'</b><div>'+html+'</div></div>';}
function toast(t){var d=document.createElement("div");d.className="toast";d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove();},2200);}
var C={};
function evalExpr(expr){try{return Function("a","c","frac","Math","return ("+expr+");")(S.answers,C,frac,Math);}catch(e){return undefined;}}
function calc(){C={};(G.calcs||[]).forEach(function(k){C[k.id]=evalExpr(k.expr);});}
function tpl(str){
  if(str==null) return "";
  return String(str).replace(/\{\{([\s\S]+?)\}\}/g,function(_,ex){var v=evalExpr(ex);return v==null?"":v;})
    .replace(/\[\[(warn|info|ok)\|([^|\]]+)\|([\s\S]+?)\]\]/g,function(_,k,t,h){return note(k,t,h);});
}
function on(item){return !item.when||!!evalExpr(item.when);}
var PH_COLORS=["#6A7B8C","#2F86C6","#B5793A","#24907C","#C9483B","#7B5CC8","#1B5FD1","#8A6D1F"];
function phColor(pi){return PH_COLORS[pi%PH_COLORS.length];}
var REDUCED=false;try{REDUCED=window.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){}

/* ---------- figures ---------- */
function figHTML(id){
  var f=(G.figs||{})[id]; if(!f) return "";
  var svg='<svg viewBox="0 0 320 '+(f.h||180)+'" role="img" aria-label="'+esc(f.cap||f.title||id)+'">'+tpl(f.svg)+'</svg>';
  if(REDUCED) svg=svg.replace(/<animate[^>]*\/>/g,"").replace(/<animateTransform[^>]*\/>/g,"").replace(/<animateMotion[^>]*\/>/g,"");
  var isAnim=/<animate/.test(f.svg);
  return '<figure class="fig'+(isAnim?" anim":"")+'">'+(isAnim?'<div class="animtag">'+(REDUCED?"Picture":"Watch the move")+'</div>':'')+(f.title?'<div class="animt">'+esc(f.title)+'</div>':'')+svg+(f.cap?'<figcaption>'+tpl(f.cap)+'</figcaption>':'')+'</figure>';
}
function figsFor(v){if(!v) return "";return (Array.isArray(v)?v:[v]).map(figHTML).join("");}

/* ---------- steps ---------- */
function phases(){return (G.phases||[]).map(function(p){return {name:p.name,steps:(p.steps||[]).filter(on)};}).filter(function(p){return p.steps.length;});}
function flatSteps(){var out=[];phases().forEach(function(p,pi){p.steps.forEach(function(s,si){out.push({s:s,phase:p.name,pi:pi,si:si,pn:p.steps.length});});});return out;}
function stepState(id){return S.done[id]?"done":S.skipped[id]?"skip":"todo";}
function resumeIndex(list){
  var i=list.findIndex(function(x){return x.s.id===S.cur;});
  if(i>=0&&stepState(S.cur)==="todo") return i;
  var j=list.findIndex(function(x){return stepState(x.s.id)==="todo";});
  return j>=0?j:(i>=0?i:0);
}
function phaseDone(pi){return flatSteps().filter(function(x){return x.pi===pi;}).every(function(x){return stepState(x.s.id)!=="todo";});}

/* ---------- tools ---------- */
function tools(){return (G.tools||[]).filter(on).map(function(t){return {id:t.id,c:t.c||"Tools",n:tpl(t.n),must:t.must!==false&&t.must!==0,w:tpl(t.w),q:tpl(t.q||t.n),qty:tpl(t.qty),rent:t.rent};});}
function links(q){var e=encodeURIComponent(q);return '<div class="links"><a href="https://www.lowes.com/search?searchTerm='+e+'" target="_blank" rel="noopener">Lowe\'s</a><a href="https://www.homedepot.com/s/'+e+'" target="_blank" rel="noopener">Home Depot</a><a href="https://www.amazon.com/s?k='+e+'" target="_blank" rel="noopener">Amazon</a></div>';}
function renderTools(){
  var list=tools(),unans=list.filter(function(i){return !S.tools[i.id]&&!S.quizSkip[i.id];}),answered=list.filter(function(i){return S.tools[i.id];}).length,cur=unans[0];
  var qz=$("#quiz");
  if(cur){
    qz.innerHTML='<div class="eyebrow">Question '+(answered+1)+' of '+list.length+' · '+esc(cur.c)+'</div><div class="qname">Do you have: '+esc(cur.n)+'?'+(cur.must?'<span class="badge must">must have</span>':'<span class="badge">nice to have</span>')+'</div>'+
      (cur.qty?'<div class="qtyl">You need: '+esc(cur.qty)+'</div>':'')+'<p class="muted">'+esc(cur.w)+'</p>'+
      '<div class="acts"><button class="btn good" data-q="have" data-id="'+cur.id+'">Yes, I have it</button><button class="btn primary" data-q="need" data-id="'+cur.id+'">No, add to list</button></div><div class="btnrow"><button class="btn ghost sm" data-q="skip" data-id="'+cur.id+'">Not sure, ask later</button></div>';
  }else{
    var sk=Object.keys(S.quizSkip).filter(function(k){return S.quizSkip[k]&&!S.tools[k];}).length;
    qz.innerHTML='<div class="eyebrow">All questions answered</div><div class="qname">Your list is ready below.</div><div class="btnrow">'+(sk?'<button class="btn sm" data-q="unskip">Revisit '+sk+' skipped</button>':'')+'<button class="btn ghost sm" data-q="reset">Start the questions over</button></div>';
  }
  var need=list.filter(function(i){return S.tools[i.id]==="need";}),sh=$("#shop");
  if(!need.length) sh.innerHTML='<div class="eyebrow">Shopping list</div><h2>Nothing to buy yet</h2><p class="muted">Each "No" above adds the item here with its quantity.</p>';
  else{
    var txt=G.title.toUpperCase()+" — SHOPPING LIST\n"+need.map(function(i){return "[ ] "+i.n+(i.qty?" — "+i.qty:"")+(i.rent?" (rent?)":"");}).join("\n");
    sh.innerHTML='<div class="eyebrow">Shopping list · '+need.length+' items</div><h2>What to buy</h2>'+need.map(function(i){return '<div class="li"><div><b>'+esc(i.n)+'</b>'+(i.qty?' <span class="qtyl">'+esc(i.qty)+'</span>':'')+(i.rent?'<span class="badge">rent it</span>':'')+'</div>'+links(i.q)+'</div>';}).join("")+
      '<textarea id="shopTxt" readonly aria-label="Shopping list text">'+esc(txt)+'</textarea><div class="btnrow"><button class="btn primary" id="copyShop">Copy list</button></div>';
  }
  var cats={};list.forEach(function(i){(cats[i.c]=cats[i.c]||[]).push(i);});
  $("#toolList").innerHTML='<h2 style="margin-top:6px">Everything for this job</h2>'+Object.keys(cats).map(function(c){
    return '<div class="card"><div class="cat">'+esc(c)+'</div>'+cats[c].map(function(i){var v=S.tools[i.id];
      return '<div class="item"><div class="nm">'+esc(i.n)+(i.must?'<span class="badge must">must</span>':'<span class="badge">nice</span>')+(i.qty?'<div class="qty">'+esc(i.qty)+'</div>':'')+'</div><div class="seg"><button class="have'+(v==="have"?" on":"")+'" data-set="have" data-id="'+i.id+'">Have</button><button class="need'+(v==="need"?" on":"")+'" data-set="need" data-id="'+i.id+'">Need</button></div><div class="why">'+esc(i.w)+'</div>'+links(i.q)+'</div>';}).join("")+'</div>';}).join("");
  $("#nTools").textContent=need.length+" to buy";
}

/* ---------- start tab ---------- */
function renderStart(){
  calc();
  var qs=(G.questions||[]).map(function(q){
    if(q.type==="number") return '<div class="q"><label for="q_'+q.id+'">'+esc(q.label)+'</label><div class="num"><input id="q_'+q.id+'" data-qnum="'+q.id+'" type="number" inputmode="decimal" step="'+(q.step||"any")+'" value="'+esc(S.answers[q.id])+'"><span>'+esc(q.unit||"")+'</span></div>'+(q.hint?'<div class="hint">'+esc(q.hint)+'</div>':'')+'</div>';
    return '<div class="q"><span class="ql">'+esc(q.label)+'</span><div class="chips">'+q.options.map(function(o){return '<button class="chip" data-qid="'+q.id+'" data-v="'+esc(o.v)+'" aria-pressed="'+(String(S.answers[q.id])===String(o.v))+'">'+esc(o.label)+(o.hint?'<small>'+esc(o.hint)+'</small>':'')+'</button>';}).join("")+'</div>'+(q.hint?'<div class="hint">'+esc(q.hint)+'</div>':'')+'</div>';
  }).join("");
  var stats=(G.calcs||[]).filter(function(k){return k.label&&on(k);}).map(function(k){var v=C[k.id];return '<div class="stat"><div class="k">'+esc(k.label)+'</div><div class="v">'+esc(v==null?"—":(k.fmt?tpl(k.fmt):v))+'</div></div>';}).join("");
  var list=flatSteps(),done=list.filter(function(x){return S.done[x.s.id];}).length;
  $("#startBody").innerHTML=
    '<div class="card hero" style="--ph:'+phColor(0)+'"><div class="chips"><span class="cue">'+esc(G.category)+'</span><span class="cue">'+esc(G.difficulty)+'</span><span class="cue">'+esc(G.time)+'</span></div><p class="lede">'+tpl(G.summary)+'</p>'+
      '<div class="btnrow"><button class="btn primary" data-start>'+(done?"Resume the tutorial":"Start the tutorial")+'</button><button class="btn" data-tab="tools">Tools &amp; shopping list</button></div></div>'+
    (G.safety?note("warn","Safety",tpl(G.safety)):"")+
    (G.pro?note("info","Call a pro when",tpl(G.pro)):"")+
    (qs?'<div class="card"><div class="eyebrow">About your project</div>'+qs+'</div>':"")+
    (stats?'<div class="card"><div class="eyebrow">Your numbers</div><div class="stats">'+stats+'</div>'+(G.calcNote?'<p class="muted small">'+tpl(G.calcNote)+'</p>':'')+'</div>':"")+
    (G.overviewFig?figsFor(G.overviewFig):"")+
    '<div class="card"><div class="eyebrow">What you\'ll do</div><ol class="ovl">'+phases().map(function(p,pi){return '<li style="--ph:'+phColor(pi)+'"><b>'+esc(p.name)+'</b> <span class="muted small">'+p.steps.length+' step'+(p.steps.length>1?"s":"")+'</span></li>';}).join("")+'</ol></div>';
}

/* ---------- player ---------- */
function needHTML(ids){
  if(!ids||!ids.length) return "";var cat={};tools().forEach(function(i){cat[i.id]=i;});
  var it=ids.filter(function(id){return cat[id];}).map(function(id){var i=cat[id],st=S.tools[id];return '<li class="need'+(st?' st-'+st:'')+'"><span class="nd"></span><span>'+esc(i.n)+(i.qty?' <span class="q">'+esc(i.qty)+'</span>':'')+'</span><span class="ns">'+(st==="have"?"have":st==="need"?"to buy":"")+'</span></li>';});
  return it.length?'<div class="needs"><div class="eyebrow">Have these within reach</div><ul>'+it.join("")+'</ul></div>':"";
}
function cueHTML(s){var c=[];(s.ppe||[]).forEach(function(p){c.push('<span class="cue ppe">Wear: '+esc(p)+'</span>');});if(s.wait) c.push('<span class="cue wait">Wait: '+esc(tpl(s.wait))+'</span>');return c.length?'<div class="cues">'+c.join("")+'</div>':"";}
function helpCard(id){var h=(G.help||{})[id];if(!h) return "";return '<details class="qh"><summary><span class="qhi">?</span>'+esc(h.t)+'</summary><div class="qhb">'+figsFor(h.fig)+tpl(h.b)+'</div></details>';}
function stepExtras(s){
  var hs=(s.help||[]).map(helpCard).join("");
  var fq=(s.faq||[]).map(function(q){return '<details class="faq"><summary>'+esc(q[0])+'</summary><p>'+tpl(q[1])+'</p></details>';}).join("");
  var tm=(s.timers||[]).length?'<div class="hsec"><div class="eyebrow">Timers</div><div class="btnrow">'+s.timers.map(function(t){var l=t[1]>=60?(Math.round(t[1]/6)/10)+" hr":t[1]+" min";return '<button class="btn sm" data-timer="'+esc(t[0])+'|'+t[1]+'">Start '+l+': '+esc(t[0])+'</button>';}).join("")+'</div></div>':"";
  return tm+(hs?'<div class="hsec"><div class="eyebrow">Quick help</div>'+hs+'</div>':'')+(fq?'<div class="hsec"><div class="eyebrow">Questions beginners ask</div>'+fq+'</div>':'');
}
var CHECK='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var SKIPI='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4l5 4-5 4zM9 4l5 4-5 4z" fill="currentColor"/></svg>';
var PLAYI='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3l9 5-9 5z" fill="currentColor"/></svg>';
function indexHTML(list,cur){
  var html="",lastP=-1;
  list.forEach(function(x,i){
    if(x.pi!==lastP){if(lastP>=0) html+='</div>';var ph=list.filter(function(y){return y.pi===x.pi;}),d=ph.filter(function(y){return S.done[y.s.id];}).length;
      html+='<div class="iphase" style="--ph:'+phColor(x.pi)+'"><div class="iph"><span class="pn">PHASE '+(x.pi+1)+'</span><b>'+esc(x.phase)+'</b><span class="pc">'+d+'/'+ph.length+'</span></div>';lastP=x.pi;}
    var st=stepState(x.s.id),isCur=i===cur;
    html+='<button class="irow '+st+(isCur?" cur":"")+'" data-go="'+x.s.id+'"><span class="ist">'+(st==="done"?CHECK:st==="skip"?SKIPI:isCur?PLAYI:'<i>'+(i+1)+'</i>')+'</span><span class="it">'+esc(tpl(x.s.t))+(st==="skip"?' <span class="tagsk">skipped</span>':'')+'</span><span class="time">'+esc(x.s.time||"")+'</span></button>';
  });
  return html+(lastP>=0?'</div>':'');
}
function daysHTML(){
  var list=flatSteps(),by={};list.forEach(function(x,i){by[x.s.id]={x:x,i:i};});var first=-1;
  return '<p class="muted small">The job grouped into work sessions, each ending at a natural stopping point or wait.</p>'+(G.days||[]).map(function(d,di){
    var ids=d.ids.filter(function(id){return by[id];});if(!ids.length) return "";
    var complete=ids.every(function(id){return stepState(id)!=="todo";});if(!complete&&first<0) first=di;
    var next=ids.find(function(id){return stepState(id)==="todo";})||ids[0];
    return '<div class="card day'+(complete?" dayok":"")+(di===first?" daynext":"")+'" style="--ph:'+phColor(by[ids[0]].x.pi)+'"><div class="dayhd"><span class="dayn">Session '+(di+1)+'</span>'+(complete?'<span class="cue okc">Done</span>':di===first?'<span class="cue wait">Up next</span>':'')+'</div><h3>'+esc(d.t)+'</h3><ul class="daysteps">'+ids.map(function(id){var st=stepState(id);return '<li class="'+st+'"><button class="linkbtn" data-go="'+id+'">'+(by[id].i+1)+'. '+esc(tpl(by[id].x.s.t))+'</button>'+(st==="done"?' ✓':st==="skip"?' (skipped)':'')+'</li>';}).join("")+'</ul>'+(d.wait?'<p class="small"><span class="cue wait">Then: '+esc(d.wait)+'</span></p>':'')+(complete?'':'<div class="btnrow"><button class="btn '+(di===first?"primary":"")+'" data-go="'+next+'">Start this session</button></div>')+'</div>';
  }).join("");
}
function renderSteps(){
  calc();
  var list=flatSteps(),total=list.length,done=list.filter(function(x){return S.done[x.s.id];}).length,skipped=list.filter(function(x){return S.skipped[x.s.id];}).length;
  updateProgress();
  if(!total) return;
  var ri=resumeIndex(list),cx=list.findIndex(function(x){return x.s.id===S.cur;});if(cx<0) cx=ri;
  var r=list[ri],last=S.lastAt?new Date(S.lastAt):null;
  $("#resume").style.setProperty("--ph",phColor(r.pi));
  $("#resume").innerHTML=(done===total?'<div class="eyebrow">All steps done</div><h2>Finished. Nice work.</h2>':'<div class="eyebrow">'+(done||skipped?"Pick up where you left off":"Ready when you are")+(last?' · last worked '+last.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}):'')+'</div><h2>Step '+(ri+1)+': '+esc(tpl(r.s.t))+'</h2><p class="muted small"><span class="phdot"></span>Phase '+(r.pi+1)+' · '+esc(r.phase)+' · '+done+' done'+(skipped?', '+skipped+' skipped':'')+'</p>')+
    '<div class="btnrow"><button class="btn primary" data-go="'+r.s.id+'">'+(done||skipped?"Resume":"Start the tutorial")+'</button><button class="btn" data-open-index>Index</button></div>';
  $("#modeDays").hidden=!(G.days&&G.days.length);
  if(S.listMode==="days"&&!(G.days&&G.days.length)) S.listMode="steps";
  $$("[data-listmode]").forEach(function(b){b.setAttribute("aria-pressed",String(S.listMode===b.getAttribute("data-listmode")));});
  $("#stepIndex").hidden=S.listMode!=="steps";$("#days").hidden=S.listMode!=="days";$("#photoView").hidden=S.listMode!=="photos";
  if(S.listMode==="steps") $("#stepIndex").innerHTML=indexHTML(list,cx);
  if(S.listMode==="days") $("#days").innerHTML=daysHTML();
  var pl=$("#player");
  if(S.stepMode!=="player"){stopSpeaking();pl.hidden=true;$("#stepIndexWrap").hidden=false;$("#resume").hidden=false;syncWake();if(S.listMode==="photos") fillPhotoView();return;}
  pl.hidden=false;$("#stepIndexWrap").hidden=true;$("#resume").hidden=true;
  var x=list[cx],s=x.s,st=stepState(s.id);
  var segs=list.map(function(y,i){return '<i class="'+stepState(y.s.id)+(i===cx?" cur":"")+(y.pi!==(list[i-1]||{}).pi&&i?" gap":"")+'" style="--ph:'+phColor(y.pi)+'"></i>';}).join("");
  stopSpeaking();freeURLs();
  pl.style.setProperty("--ph",phColor(x.pi));
  pl.innerHTML='<div class="ptop"><button class="btn ghost sm" data-mode="index">← All steps</button><div class="btnrow"><button class="btn sm" data-speak>Read aloud</button><button class="btn sm" data-bigmode aria-pressed="'+(!!S.bigMode)+'">'+(S.bigMode?"Normal text":"Big text")+'</button></div></div>'+
    '<div class="segs" aria-hidden="true">'+segs+'</div>'+
    '<div><div class="phchip">Phase '+(x.pi+1)+' · '+esc(x.phase)+'</div><div class="eyebrow">Step '+(x.si+1)+' of '+x.pn+' in this phase · '+(cx+1)+' of '+total+' overall</div></div>'+
    '<h2 class="ptitle">'+esc(tpl(s.t))+'</h2>'+
    '<div class="pmeta">'+(s.time?'<span class="cue time">Time: '+esc(s.time)+'</span>':'')+(st==="done"?'<span class="cue okc">Done</span>':st==="skip"?'<span class="cue sk">Skipped</span>':'')+'</div>'+
    (s.idea?'<div class="big"><b class="tag">The idea</b><p>'+esc(tpl(s.idea))+'</p></div>':'')+
    (s.stop?note("warn","Stop and check",tpl(s.stop)):"")+
    cueHTML(s)+figsFor(s.fig)+needHTML(s.need)+'<div class="body">'+tpl(s.b)+'</div>'+stepExtras(s)+photoBlock(s.id)+
    '<div class="pnav"><button class="btn" data-nav="prev"'+(cx===0?' disabled':'')+'>Back</button>'+
      (st==="done"?'<button class="btn ghost" data-nav="undo">Mark not done</button>':st==="skip"?'<button class="btn ghost" data-nav="unskip">Unskip</button>':'<button class="btn ghost" data-nav="skip">Skip</button>')+
      '<button class="btn '+(st==="done"?"primary":"good")+'" data-nav="'+(st==="done"?"next":"done")+'">'+(cx===total-1?(st==="done"?"Finish":"Done, finish"):(st==="done"?"Next step":"Done, next step"))+'</button></div>';
  fillStepPhotos(s.id);syncWake();
}
function updateProgress(){var l=flatSteps(),t=l.length,d=l.filter(function(x){return S.done[x.s.id];}).length,pct=t?Math.round(d/t*100):0;$("#progTxt").textContent=d+" of "+t+" steps";$("#progBar").style.width=pct+"%";$("#nSteps").textContent=pct+"%";}
function goStep(id){S.cur=id;S.stepMode="player";save();closeSheet();show("steps");}
function navStep(a){
  var list=flatSteps(),i=list.findIndex(function(x){return x.s.id===S.cur;});if(i<0) i=resumeIndex(list);
  var id=list[i].s.id,pi0=list[i].pi,was=phaseDone(pi0);
  if(a==="done"){S.done[id]=true;delete S.skipped[id];S.lastAt=Date.now();}
  if(a==="skip"){S.skipped[id]=true;S.lastAt=Date.now();}
  if(a==="undo") delete S.done[id];
  if(a==="unskip") delete S.skipped[id];
  if(a==="prev"&&i>0) i--;
  else if(a==="done"||a==="skip"||a==="next"){if(i<list.length-1) i++;else S.stepMode="index";}
  S.cur=list[i].s.id;save();renderSteps();window.scrollTo(0,0);
  if((a==="done"||a==="skip")&&!was&&phaseDone(pi0)){var ph=phases(),nx=ph[pi0+1];celebrate(pi0,ph[pi0].name,nx?nx.name:null);}
}

/* ---------- sheets ---------- */
function openIndex(){var l=flatSteps(),i=l.findIndex(function(x){return x.s.id===S.cur;});$("#sheetTitle").textContent="Index";$("#sheetList").innerHTML=indexHTML(l,i<0?resumeIndex(l):i);$("#sheet").hidden=false;var c=$("#sheetList .irow.cur");if(c) c.scrollIntoView({block:"center"});}
function openHelp(){$("#sheetTitle").textContent="Help";$("#sheetList").innerHTML='<p class="muted small">How-to cards for skills used in this job. They also appear on the steps that need them.</p>'+Object.keys(G.help||{}).map(helpCard).join("")+((G.glossary||[]).length?'<h3 style="margin-top:18px">Words you\'ll see</h3><dl class="gloss">'+G.glossary.map(function(g){return '<dt>'+esc(g[0])+'</dt><dd>'+esc(g[1])+'</dd>';}).join("")+'</dl>':'');$("#sheet").hidden=false;$("#sheet .sheet-in").scrollTop=0;}
function closeSheet(){$("#sheet").hidden=true;}
function celebrate(pi,name,next){
  var c=$("#cele"),bits="";if(!REDUCED) for(var i=0;i<24;i++) bits+='<i style="left:'+(4+Math.random()*92)+'%;animation-delay:'+(Math.random()*0.6).toFixed(2)+'s;background:'+PH_COLORS[i%PH_COLORS.length]+'"></i>';
  c.innerHTML='<div class="celein" style="--ph:'+phColor(pi)+'">'+bits+'<div class="celecard"><div class="eyebrow">Phase '+(pi+1)+' complete</div><h2>'+esc(name)+': done</h2>'+(next?'<p>Next up: <b>'+esc(next)+'</b></p>':'<p>That was the last phase. Nice work.</p>')+'<button class="btn primary" data-cele-close>Keep going</button></div></div>';c.hidden=false;
}

/* ---------- timers ---------- */
var audioCtx=null;
function beep(){try{if(audioCtx){var t=audioCtx.currentTime;[0,0.35,0.7].forEach(function(d){var o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=880;o.connect(g);g.connect(audioCtx.destination);g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(0.4,t+d+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+d+0.25);o.start(t+d);o.stop(t+d+0.3);});}}catch(e){}try{if(navigator.vibrate) navigator.vibrate([300,150,300]);}catch(e){}}
function startTimer(label,min){try{if(!audioCtx){var AC=window.AudioContext||window.webkitAudioContext;if(AC) audioCtx=new AC();}if(audioCtx&&audioCtx.state==="suspended") audioCtx.resume();}catch(e){}
  S.timers=S.timers.filter(function(t){return t.label!==label;});S.timers.push({id:String(Date.now()),label:label,end:Date.now()+min*60000,fired:false});save();renderTimers();toast("Timer started: "+label);}
function fmtLeft(ms){if(ms<=0) return "done";var s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;if(h>=3) return "ready "+new Date(Date.now()+ms).toLocaleString(undefined,{weekday:"short",hour:"numeric",minute:"2-digit"});return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(sec).padStart(2,"0");}
function renderTimers(){var bar=$("#timerBar");bar.hidden=!S.timers.length;bar.innerHTML=S.timers.map(function(t){var l=t.end-Date.now();return '<div class="tm'+(l<=0?" due":"")+'"><span class="tml">'+esc(t.label)+'</span><span class="tmv">'+fmtLeft(l)+'</span><button class="btn sm ghost" data-timer-cancel="'+t.id+'">'+(l<=0?"OK":"Cancel")+'</button></div>';}).join("");}
setInterval(function(){var ch=false;S.timers.forEach(function(t){if(!t.fired&&t.end<=Date.now()){t.fired=true;ch=true;beep();toast("Time's up: "+t.label);}});if(ch) save();if(S.timers.length) renderTimers();},1000);

/* ---------- read aloud / wake lock / big text ---------- */
var speaking=false;
function speakStep(){try{var syn=window.speechSynthesis;if(!syn){toast("Read-aloud isn't available in this browser.");return;}if(speaking){syn.cancel();speaking=false;renderSpeak();return;}
  var p=$("#player"),parts=[$(".ptitle",p),$(".big p",p),$(".body",p)].filter(Boolean).map(function(el){return el.innerText;});
  var u=new SpeechSynthesisUtterance(parts.join(". ").replace(/"/g," inch").replace(/×/g," by "));u.rate=0.95;u.onend=u.onerror=function(){speaking=false;renderSpeak();};syn.cancel();syn.speak(u);speaking=true;renderSpeak();}catch(e){toast("Read-aloud isn't available here.");}}
function stopSpeaking(){try{if(window.speechSynthesis) window.speechSynthesis.cancel();}catch(e){}speaking=false;}
function renderSpeak(){var b=$("[data-speak]");if(b) b.textContent=speaking?"Stop reading":"Read aloud";}
var wakeLock=null;
function syncWake(){try{var want=S.tab==="steps"&&S.stepMode==="player"&&!document.hidden;if(want&&!wakeLock&&navigator.wakeLock){navigator.wakeLock.request("screen").then(function(l){wakeLock=l;l.addEventListener("release",function(){wakeLock=null;});}).catch(function(){});}else if(!want&&wakeLock){wakeLock.release().catch(function(){});wakeLock=null;}}catch(e){}}
document.addEventListener("visibilitychange",syncWake);
function applyBig(){document.body.classList.toggle("jobsite",!!S.bigMode);}

/* ---------- photos (IndexedDB, this device only) ---------- */
var pdb=null,urls=[];
function openPhotos(){return new Promise(function(res,rej){if(pdb) return res(pdb);try{var r=indexedDB.open("pbPhotos",1);r.onupgradeneeded=function(){var db=r.result;if(!db.objectStoreNames.contains("p")) db.createObjectStore("p",{keyPath:"id",autoIncrement:true});};r.onsuccess=function(){pdb=r.result;res(pdb);};r.onerror=function(){rej(r.error);};}catch(e){rej(e);}});}
function allPhotos(){return openPhotos().then(function(db){return new Promise(function(res,rej){var out=[],c=db.transaction("p").objectStore("p").openCursor();c.onsuccess=function(e){var k=e.target.result;if(k){if(k.value.guide===G.slug) out.push(k.value);k.continue();}else res(out);};c.onerror=function(){rej(c.error);};});});}
function shrink(file){return new Promise(function(res){var img=new Image(),u=URL.createObjectURL(file);img.onload=function(){var k=Math.min(1,1600/Math.max(img.width,img.height)),cv=document.createElement("canvas");cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);URL.revokeObjectURL(u);cv.toBlob(function(b){res(b||file);},"image/jpeg",0.82);};img.onerror=function(){URL.revokeObjectURL(u);res(file);};img.src=u;});}
function addPhoto(step,file){return shrink(file).then(function(blob){return openPhotos().then(function(db){return new Promise(function(res,rej){var t=db.transaction("p","readwrite");t.objectStore("p").add({guide:G.slug,step:step,ts:Date.now(),blob:blob});t.oncomplete=res;t.onerror=function(){rej(t.error);};});});});}
function delPhoto(id){return openPhotos().then(function(db){return new Promise(function(res){var t=db.transaction("p","readwrite");t.objectStore("p").delete(Number(id));t.oncomplete=res;t.onerror=res;});});}
function thumb(p,label){var u=URL.createObjectURL(p.blob);urls.push(u);return '<figure class="ph"><img src="'+u+'" alt="Progress photo"><figcaption>'+(label?esc(label)+' · ':'')+new Date(p.ts).toLocaleDateString(undefined,{month:"short",day:"numeric"})+'<button class="linkbtn" data-del-photo="'+p.id+'">Delete</button></figcaption></figure>';}
function freeURLs(){urls.forEach(function(u){try{URL.revokeObjectURL(u);}catch(e){}});urls=[];}
function photoBlock(id){return '<div class="hsec"><div class="eyebrow">Progress photos</div><div class="phs" id="stepPhotos"><span class="muted small">Loading…</span></div><label class="btn sm phadd"><input type="file" accept="image/*" capture="environment" data-photo-step="'+id+'" hidden>Add a photo of this step</label><p class="muted small">Photos stay on this phone only.</p></div>';}
function fillStepPhotos(id){var b=$("#stepPhotos");if(!b) return;allPhotos().then(function(ps){ps=ps.filter(function(p){return p.step===id;});b.innerHTML=ps.length?ps.map(function(p){return thumb(p);}).join(""):'<span class="muted small">No photos yet.</span>';}).catch(function(){b.innerHTML='<span class="muted small">Photos aren\'t available in this browser mode.</span>';});}
function fillPhotoView(){var b=$("#photoView");if(!b) return;freeURLs();var names={};flatSteps().forEach(function(x,i){names[x.s.id]=(i+1)+". "+tpl(x.s.t);});allPhotos().then(function(ps){ps.sort(function(a,c){return a.ts-c.ts;});b.innerHTML=ps.length?'<div class="phs grid">'+ps.map(function(p){return thumb(p,names[p.step]||p.step);}).join("")+'</div>':'<div class="card"><h3>No photos yet</h3><p class="muted">Open any step and tap "Add a photo of this step".</p></div>';}).catch(function(){b.innerHTML='<p class="muted">Photos aren\'t available in this browser mode.</p>';});}

/* ---------- tabs + events ---------- */
function show(tab){S.tab=tab;save();stopSpeaking();
  $$("section[data-view]").forEach(function(s){s.hidden=s.getAttribute("data-view")!==tab;});
  $$("nav.tabs button").forEach(function(b){b.setAttribute("aria-selected",String(b.getAttribute("data-tab")===tab));});
  calc();updateProgress();
  if(tab==="start") renderStart();if(tab==="tools") renderTools();if(tab==="steps") renderSteps();syncWake();window.scrollTo(0,0);}
document.addEventListener("click",function(e){
  if(e.target.id==="sheet"){closeSheet();return;}
  if(e.target.id==="cele"||(e.target.closest&&e.target.closest(".celein")&&!e.target.closest(".celecard"))){$("#cele").hidden=true;return;}
  var t=e.target.closest("button");if(!t) return;
  if(t.hasAttribute("data-qid")){var q=(G.questions||[]).find(function(x){return x.id===t.getAttribute("data-qid");}),v=t.getAttribute("data-v"),o=q&&q.options.find(function(x){return String(x.v)===v;});S.answers[q.id]=o?o.v:v;save();renderStart();return;}
  if(t.hasAttribute("data-start")){var l=flatSteps();goStep(l[resumeIndex(l)].s.id);return;}
  if(t.hasAttribute("data-tab")){show(t.getAttribute("data-tab"));return;}
  if(t.hasAttribute("data-go")){goStep(t.getAttribute("data-go"));return;}
  if(t.hasAttribute("data-nav")){navStep(t.getAttribute("data-nav"));return;}
  if(t.hasAttribute("data-mode")){S.stepMode=t.getAttribute("data-mode");save();renderSteps();window.scrollTo(0,0);return;}
  if(t.hasAttribute("data-listmode")){S.listMode=t.getAttribute("data-listmode");save();renderSteps();return;}
  if(t.hasAttribute("data-open-index")){openIndex();return;}
  if(t.hasAttribute("data-open-help")){openHelp();return;}
  if(t.hasAttribute("data-close-sheet")){closeSheet();return;}
  if(t.hasAttribute("data-cele-close")){$("#cele").hidden=true;return;}
  if(t.hasAttribute("data-speak")){speakStep();return;}
  if(t.hasAttribute("data-bigmode")){S.bigMode=!S.bigMode;save();applyBig();renderSteps();return;}
  if(t.hasAttribute("data-timer")){var tp=t.getAttribute("data-timer").split("|");startTimer(tp[0],+tp[1]);return;}
  if(t.hasAttribute("data-timer-cancel")){var tid=t.getAttribute("data-timer-cancel");S.timers=S.timers.filter(function(x){return x.id!==tid;});save();renderTimers();return;}
  if(t.hasAttribute("data-q")){var qq=t.getAttribute("data-q"),id=t.getAttribute("data-id");if(qq==="have"||qq==="need"){S.tools[id]=qq;delete S.quizSkip[id];}else if(qq==="skip") S.quizSkip[id]=true;else if(qq==="unskip") S.quizSkip={};else if(qq==="reset"){S.tools={};S.quizSkip={};}save();renderTools();return;}
  if(t.hasAttribute("data-set")){var i2=t.getAttribute("data-id"),v2=t.getAttribute("data-set");if(S.tools[i2]===v2) delete S.tools[i2];else S.tools[i2]=v2;save();renderTools();return;}
  if(t.hasAttribute("data-del-photo")){if(t.getAttribute("data-armed")){delPhoto(t.getAttribute("data-del-photo")).then(function(){if(S.stepMode==="player"&&S.tab==="steps") fillStepPhotos(S.cur);else fillPhotoView();toast("Photo deleted");});}else{t.setAttribute("data-armed","1");t.textContent="Tap again to delete";setTimeout(function(){if(t.isConnected){t.removeAttribute("data-armed");t.textContent="Delete";}},3000);}return;}
  if(t.id==="copyShop"){var ta=$("#shopTxt"),p=navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(ta.value):Promise.reject();p.then(function(){toast("Copied");},function(){ta.focus();ta.select();toast("Selected. Use Copy from the menu.");});}
});
document.addEventListener("input",function(e){var el=e.target;if(!el.hasAttribute||!el.hasAttribute("data-qnum")) return;var v=parseFloat(el.value);if(!isFinite(v)) return;S.answers[el.getAttribute("data-qnum")]=v;save();calc();
  var stats=$$("#startBody .stat .v"),ks=(G.calcs||[]).filter(function(k){return k.label&&on(k);});stats.forEach(function(n,i){var k=ks[i];if(k) n.textContent=C[k.id]==null?"—":(k.fmt?tpl(k.fmt):C[k.id]);});});
document.addEventListener("change",function(e){var el=e.target;if(!el.hasAttribute||!el.hasAttribute("data-photo-step")||!el.files||!el.files[0]) return;var st=el.getAttribute("data-photo-step");toast("Saving photo…");addPhoto(st,el.files[0]).then(function(){el.value="";fillStepPhotos(st);toast("Photo saved");}).catch(function(){toast("Couldn't save the photo in this browser mode.");});});

document.title=G.title;
$("#gTitle").textContent=G.title;$("#gEyebrow").textContent=G.eyebrow||G.category;
applyBig();renderTimers();calc();
var start=(location.hash||"").replace("#","");
if(["start","tools","steps"].indexOf(start)<0) start=S.tab;
show(start);
window.__pb={G:G,figHTML:figHTML,goStep:goStep,flatSteps:flatSteps};
})();
