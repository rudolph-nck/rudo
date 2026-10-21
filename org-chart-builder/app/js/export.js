/* export.js — files for people who don't use the builder.
   • Interactive HTML: one self-contained file (pages, search, click a person for contact details, fits any screen,
     prints one page per sheet). This is also what Publish saves as the official chart.
   • Print / PDF: the same document with only the chosen pages, each scaled to one landscape sheet.
   • PNG of a page and PowerPoint (one slide per page), drawn from the same layout numbers. */
OC.exporter = (() => {
  const { h, esc, toast, modal, slug, fmtDate, fmtLong, now, plural } = OC.u;
  const M = () => OC.model, S = () => OC.store;
  const P = () => S().doc;

  let fontB64 = null;
  async function fontData() {
    if (fontB64 !== null) return fontB64;
    try {
      const buf = await (await fetch("app/fonts/OpenSans-Variable.woff2")).arrayBuffer();
      let s = ""; const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      fontB64 = btoa(s);
    } catch { fontB64 = ""; } // opened as a file: exports fall back to Calibri/Segoe UI
    return fontB64;
  }

  const EXPORT_CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{font-family:"Open Sans",Calibri,"Segoe UI",Arial,sans-serif;color:#45494c;background:#f3f4f5;-webkit-font-smoothing:antialiased}
.x-top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:16px;padding:10px 18px;background:#53575a;color:#fff;border-bottom:4px solid #00b2e3}
.x-brand{display:flex;align-items:center;gap:12px;min-width:0}
.x-plus{font-weight:800;font-size:30px;line-height:1;color:#00b2e3}
.x-brand b{display:block;font-size:17px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x-brand div span{display:block;font-size:12px;opacity:.8}
.x-sp{flex:1}
.x-search{position:relative;width:min(380px,45vw)}
.x-search input{width:100%;font:inherit;font-size:14px;padding:8px 12px;border-radius:7px;border:0;outline:none}
.x-results{position:absolute;left:0;right:0;top:calc(100% + 4px);background:#fff;color:#45494c;border-radius:8px;box-shadow:0 14px 40px rgba(0,0,0,.25);max-height:60vh;overflow:auto;display:none}
.x-results.on{display:block}
.x-r{display:block;width:100%;text-align:left;border:0;background:none;font:inherit;padding:8px 12px;cursor:pointer;border-bottom:1px solid #eef0f1}
.x-r:hover,.x-r.on{background:#e0f5fc}.x-r b{display:block;color:#53575a}.x-r span{font-size:12px;color:#767b7e}
.x-draft{background:#f6bf26;color:#3a2c00;text-align:center;font-weight:800;padding:6px;font-size:13px;letter-spacing:.04em}
.x-body{display:flex;align-items:flex-start}
.x-nav{position:sticky;top:62px;width:250px;flex:none;max-height:calc(100vh - 62px);overflow:auto;padding:14px 10px 30px;font-size:13px}
.x-nav a{display:block;padding:4px 10px;color:#45494c;text-decoration:none;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x-nav a:hover{background:#e3e5e6}.x-nav a.d{margin-top:12px;font-weight:800;color:#53575a;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
.x-nav a.on{background:#e0f5fc;color:#00538b;font-weight:700}
.x-main{flex:1;min-width:0;padding:18px 22px 60px}
.x-page{background:#fff;border-radius:6px;box-shadow:0 1px 2px rgba(83,87,90,.08),0 4px 14px rgba(83,87,90,.06);margin:0 0 22px;padding:22px 24px 26px;scroll-margin-top:78px;position:relative}
.x-page::before{content:"";position:absolute;left:0;top:22px;width:6px;height:58px;background:#00b2e3}
.x-label{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#00a0cc}
.x-page h2{margin:2px 0 4px;font-size:26px;font-weight:800;color:#53575a}
.x-page p{margin:0 0 16px;color:#767b7e}
.x-frame{position:relative;overflow:hidden}
.x-frame.full{overflow:auto}
.x-chart{position:relative;transform-origin:0 0}
.x-zoom{position:absolute;right:12px;top:18px;font:inherit;font-size:12px;font-weight:700;border:1px solid #cfd2d3;background:#fff;color:#53575a;border-radius:6px;padding:4px 10px;cursor:pointer}
.x-page.div{padding:0;background:none;box-shadow:none}.x-page.div::before{display:none}
.x-pop{position:fixed;z-index:30;background:#fff;border-radius:8px;box-shadow:0 14px 40px rgba(0,0,0,.25);padding:14px 16px;width:280px;font-size:13px;border-top:4px solid #00b2e3}
.x-pop b{display:block;font-size:15px;color:#53575a}.x-pop .t{color:#45494c;margin-bottom:6px}.x-pop div{margin-top:3px}.x-pop a{color:#00538b}
.x-pop .k{color:#8b9093;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.x-foot{color:#8b9093;font-size:12px;text-align:center;padding:10px 0 30px}
@media (max-width:900px){.x-nav{display:none}.x-main{padding:10px}}
@media print{
  @page{size:11in 8.5in;margin:.35in}
  body{background:#fff}.x-top,.x-nav,.x-zoom,.x-draft-screen,.x-pop,.x-foot{display:none!important}
  .x-main{padding:0}.x-page{box-shadow:none;margin:0;padding:0 0 0 18px;break-after:page;page-break-after:always;height:7.75in;overflow:hidden}
  .x-page:last-child{break-after:auto;page-break-after:auto}
  .x-page::before{top:4px}
  .x-frame{overflow:visible!important}
  .oc-card{box-shadow:none!important}
  .x-print-draft{display:block!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
.x-print-draft{display:none;position:absolute;right:0;top:0;font-weight:800;color:#d7372a;font-size:12px;letter-spacing:.1em}
`;

  /* Behaviour inside the exported file (kept small and dependency-free). */
  const EXPORT_JS = `
(function(){
var D=window.OC_DATA,frames=[].slice.call(document.querySelectorAll('.x-frame'));
function fit(){frames.forEach(function(f){var c=f.firstElementChild,w=+c.dataset.w,h=+c.dataset.h;if(f.classList.contains('full')){c.style.transform='none';f.style.height=(h+20)+'px';return}
 var s=Math.min(1,(f.clientWidth-2)/w);c.style.transform='scale('+s+')';c.style.marginLeft=Math.max(0,(f.clientWidth-w*s)/2)+'px';f.style.height=Math.ceil(h*s+14)+'px';
 var z=f.parentNode.querySelector('.x-zoom');if(z)z.style.display=s<0.98?'':'none'})}
window.addEventListener('resize',fit);fit();
document.addEventListener('click',function(e){var z=e.target.closest('.x-zoom');if(z){var f=z.parentNode.querySelector('.x-frame');f.classList.toggle('full');z.textContent=f.classList.contains('full')?'Fit to screen':'Actual size';fit();return}
 var c=e.target.closest('.oc-card');closePop();if(c&&D.people[c.dataset.id])pop(c)});
var popEl=null;function closePop(){if(popEl){popEl.remove();popEl=null}}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function pop(c){var x=D.people[c.dataset.id],r=c.getBoundingClientRect();popEl=document.createElement('div');popEl.className='x-pop';
 popEl.innerHTML='<b>'+esc(x[0]||'Vacant position')+'</b><div class="t">'+esc(x[1])+'</div>'+(x[2]?'<div><span class="k">Department</span><br>'+esc(x[2])+'</div>':'')+(x[5]?'<div><span class="k">Reports to</span><br>'+esc(x[5])+'</div>':'')+(x[3]?'<div><a href="mailto:'+esc(x[3])+'">'+esc(x[3])+'</a></div>':'')+(x[4]?'<div>'+esc(x[4])+'</div>':'');
 document.body.appendChild(popEl);var l=Math.min(innerWidth-296,Math.max(8,r.left+r.width/2-140)),t=r.bottom+8;if(t+popEl.offsetHeight>innerHeight-8)t=Math.max(8,r.top-popEl.offsetHeight-8);popEl.style.left=l+'px';popEl.style.top=t+'px'}
window.addEventListener('scroll',closePop,{passive:true});
var q=document.getElementById('xq'),res=document.getElementById('xr'),items=[],act=0;
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')}
if(q){q.addEventListener('input',function(){var v=norm(q.value).trim();res.innerHTML='';items=[];act=0;if(!v){res.classList.remove('on');return}
 var w=v.split(/\\s+/);D.index.forEach(function(it){var x=D.people[it[0]];if(!x)return;var hay=norm(x[0]+' '+x[1]+' '+x[2]);if(w.every(function(k){return hay.indexOf(k)>=0}))items.push(it)});
 items=items.slice(0,40);items.forEach(function(it,i){var x=D.people[it[0]],b=document.createElement('button');b.className='x-r'+(i?'':' on');b.innerHTML='<b>'+esc(x[0]||'Vacant')+'</b><span>'+esc([x[1],x[2]].filter(Boolean).join(' · '))+'</span>';b.onmousedown=function(e){e.preventDefault();go(it)};res.appendChild(b)});
 if(!items.length)res.innerHTML='<div class="x-r"><span>No matches</span></div>';res.classList.add('on')});
 q.addEventListener('keydown',function(e){var bs=res.querySelectorAll('.x-r');if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();act=Math.max(0,Math.min(items.length-1,act+(e.key==='ArrowDown'?1:-1)));bs.forEach(function(b,i){b.classList.toggle('on',i===act)})}else if(e.key==='Enter'&&items[act]){go(items[act])}else if(e.key==='Escape'){q.value='';res.classList.remove('on')}});
 q.addEventListener('blur',function(){setTimeout(function(){res.classList.remove('on')},150)})}
function go(it){res.classList.remove('on');q.blur();var sec=document.getElementById(it[1]);if(!sec)return;var c=sec.querySelector('.oc-card[data-id="'+it[0]+'"]');sec.scrollIntoView({behavior:'smooth',block:'start'});
 if(c){setTimeout(function(){var r=c.getBoundingClientRect();if(r.top>innerHeight-80||r.top<70)window.scrollBy({top:r.top-innerHeight/2.5,behavior:'smooth'});c.classList.remove('hit');void c.offsetWidth;c.classList.add('hit')},450)}}
var links=[].slice.call(document.querySelectorAll('.x-nav a[href^="#"]'));
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+en.target.id)})}})},{rootMargin:'-80px 0px -70% 0px'});document.querySelectorAll('.x-page').forEach(function(s){io.observe(s)})}
// print: each page scaled to fit one landscape sheet (width AND height), restored afterwards
var PW=10.3*96-24,PH=7.75*96;
function beforePrint(){frames.forEach(function(f){var c=f.firstElementChild,w=+c.dataset.w,h=+c.dataset.h,sec=f.parentNode,head=0;[].forEach.call(sec.children,function(k){if(k!==f&&k.offsetHeight&&!k.classList.contains('x-zoom'))head+=k.offsetHeight+6});
 var s=Math.min(1,PW/w,(PH-head-10)/h);c.style.transform='scale('+s+')';c.style.marginLeft=Math.max(0,(PW-w*s)/2)+'px';f.style.height=Math.ceil(h*s+4)+'px'})}
window.addEventListener('beforeprint',beforePrint);window.addEventListener('afterprint',fit);
if(window.matchMedia){var mq=matchMedia('print');if(mq.addEventListener)mq.addEventListener('change',function(e){e.matches?beforePrint():fit()})}
if(D.autoprint){setTimeout(function(){beforePrint();window.print()},400)}
})();`;

  /* Build the document. opts: { pageIds (null = all visible), autoprint, status } */
  async function buildHtml({ pageIds = null, autoprint = false, forPublish = false } = {}) {
    const p = P();
    const font = await fontData();
    let pages = M().pages(p, { includeHidden: false });
    if (pageIds) pages = M().pages(p).filter((pg) => pageIds.includes(pg.id));
    const ix = M().index(p);
    const draft = !forPublish && S().dirty();
    const pub = p.published;
    const statusLine = forPublish ? `Published ${fmtLong(now())}` : draft ? `Draft — ${fmtLong(now())}` : pub ? `Published v${pub.version} · ${fmtLong(pub.at)}` : fmtLong(now());
    const peopleOut = {}, index = [];
    const secs = [], nav = [];
    for (const pg of pages) {
      const sid = "p-" + slug(pg.id);
      if (pg.kind === "divider") {
        secs.push(`<section class="x-page div" id="${sid}">${OC.chart.dividerMarkup(pg)}</section>`);
        nav.push(`<a class="d" href="#${sid}">${esc(pg.title)}</a>`);
        continue;
      }
      const m = OC.chart.pageMarkup(p, pg, { collapsible: false, static: true });
      m.L.cards.forEach((c) => {
        const x = c.node.p;
        if (!peopleOut[c.node.id]) {
          const mg = !x.isExtra && ix.byId.get(x.managerId);
          peopleOut[c.node.id] = [x.type === "vacant" ? (x.name ? `Vacant · ${x.name}` : "") : x.name, x.title || "", x.department || "", x.email || "", x.phone || "", mg ? mg.name : ""];
        }
        if (!c.node.context && !(pg.members && !pg.members.has(c.node.id) && M().homePage(p, c.node.id) && M().homePage(p, c.node.id).id !== pg.id)) index.push([c.node.id, sid]);
      });
      const html = m.html.replace(/<button type="button" class="oc-tog[^>]*>[^<]*<\/button>/g, "");
      secs.push(`<section class="x-page" id="${sid}"><span class="x-print-draft">${draft ? "DRAFT" : ""}</span><div class="x-label">${esc(pg.label || "")}</div><h2>${esc(pg.title)}</h2>${pg.subtitle ? `<p>${esc(pg.subtitle)}</p>` : ""}<button class="x-zoom" type="button">Actual size</button><div class="x-frame"><div class="x-chart" data-w="${m.w}" data-h="${m.h}" style="width:${m.w}px;height:${m.h}px">${html}</div></div></section>`);
      nav.push(`<a href="#${sid}">${esc(pg.title)}</a>`);
    }
    // de-duplicate the search index: first page that lists a person wins (their home page comes first in the order)
    const seen = new Set();
    const idx = [];
    const homeFirst = (id) => { const hp = M().homePage(p, id); return hp ? "p-" + slug(hp.id) : null; };
    index.forEach(([id, sid]) => { if (seen.has(id)) return; const hs = homeFirst(id); if (hs && index.some((e) => e[0] === id && e[1] === hs)) { idx.push([id, hs]); } else idx.push([id, sid]); seen.add(id); });
    const data = { people: peopleOut, index: idx, autoprint };
    const fontCss = font ? `@font-face{font-family:"Open Sans";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:300 800;font-style:normal}` : "";
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}${draft ? " (Draft)" : ""}</title>
<meta name="generator" content="Org Chart Builder ${esc(window.OC_BUILD)}">
<style>${fontCss}${OC.chartStyle.CSS}${EXPORT_CSS}</style></head>
<body class="${p.settings.theme === "classic" ? "theme-classic" : ""}">
<header class="x-top"><div class="x-brand"><span class="x-plus">+</span><div><b>${esc(p.title)}</b><span>${esc(statusLine)}</span></div></div><div class="x-sp"></div>
<div class="x-search"><input id="xq" type="search" placeholder="Find a person, title or department…" autocomplete="off"><div class="x-results" id="xr"></div></div></header>
${draft ? '<div class="x-draft x-draft-screen">DRAFT — not the official organizational chart</div>' : ""}
<div class="x-body"><nav class="x-nav">${nav.join("")}</nav><main class="x-main">${secs.join("\n")}<div class="x-foot">${esc(p.organization)} · ${plural(M().stats(p).people, "person", "people")} · ${esc(statusLine)}</div></main></div>
<script>window.OC_DATA=${JSON.stringify(data).replace(/</g, "\\u003c")};</script>
<script>${EXPORT_JS}</script>
</body></html>`;
  }

  const fileName = (ext, suffix = "") => {
    const p = P();
    const draft = S().dirty();
    return `${slug(p.organization).replace(/(^|-)([a-z])/g, (m, a, b) => b.toUpperCase())}OrgChart${draft ? "_Draft" : ""}${suffix}_${fmtDate(now())}.${ext}`;
  };
  async function downloadHtml() {
    const html = await buildHtml();
    OC.u.download(fileName("html"), html, "text/html");
    if (S().dirty()) toast("Downloaded as a DRAFT — publish to make it official", "info", 4500);
  }

  async function printDialog(pageId) {
    const p = P();
    const all = M().pages(p, { includeHidden: false });
    const cur = M().pageById(p, pageId);
    let area = null;
    if (cur) { const i = all.indexOf(cur); for (let j = i; j >= 0; j--) if (all[j].kind === "divider" && all[j].id.startsWith("div:area:")) { area = all[j]; break; } }
    const areaPages = area ? (() => { const out = []; for (let j = all.indexOf(area); j < all.length; j++) { if (j > all.indexOf(area) && all[j].kind === "divider" && all[j].id.startsWith("div:")) break; out.push(all[j].id); } return out; })() : null;
    let choice = cur && cur.kind === "chart" ? "this" : "all";
    const opt = (v, t, n) => h("label.choice", h("input", { type: "radio", name: "pr", checked: choice === v, onchange: () => (choice = v) }), h("div", h("b", t), h("div.muted.small", n)));
    const v = await modal({ title: "Print or save as PDF", size: "sm", body: h("div",
      cur ? opt("this", "This page", cur.title) : null,
      areaPages ? opt("area", `${area.title}'s area`, plural(areaPages.length, "page")) : null,
      opt("all", "The whole chart", `${plural(all.length, "page")}, as published`),
      h("p.muted.small", "Each page is scaled to fit one landscape sheet. In the print window choose “Save as PDF” as the printer to get a PDF.")),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Open print view", kind: "primary", value: "ok" }] });
    if (v !== "ok") return;
    const ids = choice === "this" ? [cur.id] : choice === "area" ? areaPages : all.map((x) => x.id);
    const w = window.open("", "_blank");
    if (!w) return toast("The browser blocked the print window — allow pop-ups for this site", "err", 6000);
    w.document.write("<p style='font-family:sans-serif;padding:20px'>Preparing…</p>");
    const html = await buildHtml({ pageIds: ids, autoprint: true });
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ---------------------------------------------------------------- canvas rendering (PNG, PowerPoint) */
  function roundRect(ctx, x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + "…").width <= maxW) lo = mid; else hi = mid - 1; }
    return text.slice(0, lo).trimEnd() + "…";
  }
  function wrap2(ctx, text, maxW) {
    const words = String(text || "").split(/\s+/); const lines = [""];
    for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (ctx.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); }
    if (lines.length > 2) { lines.length = 2; lines[1] = fitText(ctx, lines[1] + "…", maxW); }
    return lines.map((l) => fitText(ctx, l, maxW));
  }
  async function pageCanvas(pg, { scale = 2, maxPx = 12000 } = {}) {
    const p = P();
    await document.fonts.ready;
    const tree = M().pageTree(p, pg);
    const L = OC.layout.layout(tree, { density: p.settings.cardDensity });
    const SZ = L.S;
    const classic = p.settings.theme === "classic";
    const pad = 36, headH = 96;
    const W = Math.max(L.w + pad * 2, 900), H = L.h + pad * 2 + headH;
    const s = Math.min(scale, maxPx / Math.max(W, H));
    const c = document.createElement("canvas");
    c.width = Math.ceil(W * s); c.height = Math.ceil(H * s);
    const ctx = c.getContext("2d");
    ctx.scale(s, s);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    const F = (wgt, size) => `${wgt} ${size}px "Open Sans", Calibri, "Segoe UI", Arial, sans-serif`;
    // header: blue line + label + title + description
    ctx.fillStyle = "#00b2e3"; ctx.fillRect(pad - 18, pad - 4, 6, 64);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = "#00a0cc"; ctx.font = F(800, 12); ctx.fillText(String(pg.label || "").toUpperCase(), pad, pad + 10);
    ctx.fillStyle = "#53575a"; ctx.font = F(800, 28); ctx.fillText(pg.title, pad, pad + 42);
    if (pg.subtitle) { ctx.fillStyle = "#767b7e"; ctx.font = F(400, 14); ctx.fillText(fitText(ctx, pg.subtitle, W - pad * 2), pad, pad + 64); }
    const ox = pad + Math.max(0, (W - pad * 2 - L.w) / 2), oy = pad + headH;
    // lines
    ctx.strokeStyle = classic ? "#0e5a73" : "#a3a8ab"; ctx.lineWidth = 1.6; ctx.beginPath();
    L.segs.forEach((g) => { ctx.moveTo(ox + g[0], oy + g[1]); ctx.lineTo(ox + g[2], oy + g[3]); });
    ctx.stroke();
    // cards
    for (const cd of L.cards) {
      const n = cd.node, x = n.p, X = ox + cd.x, Y = oy + cd.y, w = SZ.CW, hh = SZ.CH;
      const passive = n.style === "passive", vac = x.type === "vacant", top = n.level === 0 && !n.context && !passive;
      let bg = "#fff", border = "#d6d9db", nameC = "#53575a", textC = "#45494c", deptC = "#8b9093", dash = false, bar = !classic;
      if (classic) { bg = passive || vac ? "#fff" : top ? "#0a4558" : "#0e5a73"; border = "#0e5a73"; nameC = textC = passive || vac ? "#0e5a73" : "#fff"; deptC = passive || vac ? "#4d7d8c" : "#bfe0ea"; dash = vac; }
      else if (passive) { border = "#b4b9bb"; nameC = "#6f7477"; textC = "#767b7e"; dash = true; bar = false; }
      else if (vac) { bg = "#f3fbfe"; border = "#7fd3ee"; nameC = "#00538b"; dash = true; }
      else if (top) { bg = "#53575a"; border = "#53575a"; nameC = textC = "#fff"; deptC = "#cfd2d3"; }
      roundRect(ctx, X, Y, w, hh, 5); ctx.fillStyle = bg; ctx.fill();
      ctx.setLineDash(dash ? [5, 4] : []); ctx.strokeStyle = border; ctx.lineWidth = passive ? 1.5 : 1; ctx.stroke(); ctx.setLineDash([]);
      if (bar) { ctx.save(); roundRect(ctx, X, Y, w, hh, 5); ctx.clip(); ctx.fillStyle = "#00b2e3"; ctx.fillRect(X, Y, w, 4); ctx.restore(); }
      ctx.textAlign = "center";
      const name = vac ? (x.name ? `Vacant · ${x.name}` : "Vacant position") : x.name;
      ctx.font = F(vac ? "italic 800" : 800, 13.5);
      const titleLines = (() => { ctx.font = F(400, 11.8); return wrap2(ctx, x.title, w - 20); })();
      const showDept = p.settings.showDept && x.department;
      const blockH = 17 + titleLines.length * 15 + (showDept ? 15 : 0);
      let ty = Y + 2 + (hh - blockH) / 2 + 13;
      ctx.fillStyle = nameC; ctx.font = F(vac ? "italic 800" : 800, 13.5); ctx.fillText(fitText(ctx, name, w - 20), X + w / 2, ty);
      ctx.fillStyle = textC; ctx.font = F(400, 11.8); titleLines.forEach((l) => { ty += 15; ctx.fillText(l, X + w / 2, ty); });
      if (showDept) { ty += 15; ctx.fillStyle = deptC; ctx.font = F(700, 9.6); ctx.fillText(fitText(ctx, x.department.toUpperCase(), w - 20), X + w / 2, ty); }
      if (vac && !classic) { ctx.font = F(800, 9.5); const bw = ctx.measureText("Vacant").width + 12; roundRect(ctx, X + w - bw - 6, Y - 8, bw, 15, 7); ctx.fillStyle = "#00b2e3"; ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText("Vacant", X + w - bw / 2 - 6, Y + 3); }
      ctx.textAlign = "left";
    }
    return c;
  }
  async function pagePng(pg) {
    try {
      const c = await pageCanvas(pg);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      OC.u.download(fileName("png", "_" + slug(pg.title)), blob);
    } catch (e) { toast("Couldn't draw this page: " + e.message, "err"); }
  }

  /* ---------------------------------------------------------------- PowerPoint: one picture slide per chart page */
  async function pptx() {
    const p = P();
    const pages = M().pages(p, { includeHidden: false }).filter((pg) => pg.kind === "chart");
    if (!pages.length) return toast("No chart pages to export", "info");
    toast(`Drawing ${plural(pages.length, "slide")}…`, "info", 2500);
    const SW = 12192000, SH = 6858000, EMU = 9525; // 16:9, EMU per px at 96 dpi
    const files = [], slides = [];
    for (let i = 0; i < pages.length; i++) {
      const c = await pageCanvas(pages[i], { scale: 1.5, maxPx: 5000 });
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      const data = new Uint8Array(await blob.arrayBuffer());
      files.push({ name: `ppt/media/image${i + 1}.png`, data });
      const margin = 0.25 * 914400;
      const sc = Math.min((SW - margin * 2) / (c.width * EMU), (SH - margin * 2) / (c.height * EMU));
      const w = Math.round(c.width * EMU * sc), hh = Math.round(c.height * EMU * sc);
      slides.push({ w, hh, x: Math.round((SW - w) / 2), y: Math.round((SH - hh) / 2), title: pages[i].title });
    }
    const X = OC.sheet.xe;
    const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    files.push({ name: "[Content_Types].xml", data: `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>` });
    files.push({ name: "_rels/.rels", data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` });
    files.push({ name: "ppt/presentation.xml", data: `${head}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${SW}" cy="${SH}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>` });
    files.push({ name: "ppt/_rels/presentation.xml.rels", data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>${slides.map((_, i) => `<Relationship Id="rId${i + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>` });
    const spTree = (inner = "") => `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${inner}</p:spTree></p:cSld>`;
    files.push({ name: "ppt/slideMasters/slideMaster1.xml", data: `${head}<p:sldMaster ${NS}>${spTree()}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>` });
    files.push({ name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>` });
    files.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: `${head}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
    files.push({ name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` });
    const clr = (n, v) => `<a:${n}><a:srgbClr val="${v}"/></a:${n}>`;
    files.push({ name: "ppt/theme/theme1.xml", data: `${head}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Brand"><a:themeElements><a:clrScheme name="Brand"><a:dk1><a:srgbClr val="45494C"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>${clr("dk2", "53575A")}${clr("lt2", "CFD2D3")}${clr("accent1", "00B2E3")}${clr("accent2", "53575A")}${clr("accent3", "6ABF4B")}${clr("accent4", "00538B")}${clr("accent5", "CFD2D3")}${clr("accent6", "F6BF26")}${clr("hlink", "00538B")}${clr("folHlink", "53575A")}</a:clrScheme><a:fontScheme name="Brand"><a:majorFont><a:latin typeface="Open Sans ExtraBold"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Open Sans"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Brand"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>` });
    slides.forEach((s, i) => {
      const pic = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="${X(s.title)}" descr="${X(s.title)} organizational chart"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${s.x}" y="${s.y}"/><a:ext cx="${s.w}" cy="${s.hh}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
      files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: `${head}<p:sld ${NS}>${spTree(pic)}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>` });
      files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.png"/></Relationships>` });
    });
    OC.u.download(fileName("pptx"), OC.sheet.zip(files, "application/vnd.openxmlformats-officedocument.presentationml.presentation"));
  }

  return { buildHtml, downloadHtml, printDialog, pagePng, pageCanvas, pptx, fileName, h };
})();
