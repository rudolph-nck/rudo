/* chartstyle.js — the look of chart cards, connectors and divider pages, kept as one CSS string so the editor and every
   export (interactive HTML, print/PDF) use exactly the same rules. Brand: Anchor Gray #53575a, Vivid Blue #00b2e3, the blue
   line (top edge of every card), Open Sans ExtraBold names. "Classic" reproduces the teal cards of the old builder. */
OC.chartStyle = (() => {
  const CSS = `
.oc-canvas{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.oc-canvas.smooth{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.oc-lines{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.oc-lines path{stroke:var(--oc-line,#a3a8ab);stroke-width:1.6;fill:none;stroke-linecap:square}
.oc-card{position:absolute;box-sizing:border-box;background:var(--oc-card,#fff);border:1px solid var(--oc-card-border,#d6d9db);border-top:4px solid #00b2e3;border-radius:5px;padding:8px 10px 7px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1px;cursor:pointer;user-select:none;
  box-shadow:0 1px 2px rgba(83,87,90,.10),0 4px 12px rgba(83,87,90,.07);font-family:"Open Sans",Calibri,"Segoe UI",Arial,sans-serif;transition:box-shadow .15s,transform .15s}
.oc-card:hover{box-shadow:0 2px 4px rgba(83,87,90,.14),0 8px 20px rgba(83,87,90,.13)}
.oc-name{font-weight:800;color:var(--oc-name,#53575a);font-size:13.5px;line-height:1.22;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oc-title{font-size:11.8px;color:var(--oc-text,#45494c);line-height:1.25;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.oc-dept{font-size:9.6px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--oc-muted,#8b9093);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.oc-badges{position:absolute;top:-10px;right:6px;display:flex;gap:3px}
.ocb{font-size:9.5px;font-weight:800;line-height:15px;padding:0 6px;border-radius:99px;background:#e0f5fc;color:#00538b;border:1px solid #fff;white-space:nowrap}
.ocb-count{background:#53575a;color:#fff}
.ocb-vac{background:#00b2e3;color:#fff}
.ocb-leave{background:#fdf3d2;color:#8a6a12}
.ocb-con{background:#eceeef;color:#53575a}
.ocb-page{background:#fff;color:#767b7e;border-color:#cfd2d3}
.oc-tog{position:absolute;bottom:-11px;left:50%;transform:translateX(-50%);height:20px;min-width:26px;padding:0 7px;border-radius:99px;border:1px solid #cfd2d3;background:#fff;color:#53575a;
  font:800 11px/18px "Open Sans",Calibri,Arial,sans-serif;cursor:pointer;z-index:2}
.oc-tog:hover{border-color:#00b2e3;color:#00538b}
.oc-tog.less{opacity:0;transition:opacity .15s}
.oc-card:hover .oc-tog.less{opacity:1}
/* top of the page: Anchor Gray card */
.oc-card.lvl0.s-standard{background:#53575a;border-color:#53575a;border-top-color:#00b2e3}
.oc-card.lvl0.s-standard .oc-name,.oc-card.lvl0.s-standard .oc-title{color:#fff}
.oc-card.lvl0.s-standard .oc-dept{color:#cfd2d3}
/* context (management above the department) */
.oc-card.s-passive{background:var(--oc-card,#fff);border:1.5px dashed #b4b9bb;border-top:1.5px dashed #b4b9bb;box-shadow:none}
.oc-card.s-passive .oc-name{color:#6f7477}
.oc-card.s-passive .oc-title{color:#767b7e}
/* vacant */
.oc-card.t-vacant{background:#f3fbfe;border-style:dashed;border-color:#7fd3ee;border-top:4px solid #00b2e3}
.oc-card.t-vacant .oc-name{color:#00538b;font-style:italic}
.oc-card.t-leave{opacity:.9}
.oc-card.t-extra{border-style:dashed}
/* states (editor) */
.oc-card.selected{outline:3px solid #00b2e3;outline-offset:2px}
.oc-card.hit{animation:oc-hit 1.3s ease-out 3}
@keyframes oc-hit{0%{box-shadow:0 0 0 0 rgba(246,191,38,.95)}100%{box-shadow:0 0 0 18px rgba(246,191,38,0)}}
.oc-card.dragging{opacity:.45}
.oc-card.drop-ok{outline:3px solid #6abf4b;outline-offset:2px;transform:scale(1.03)}
.oc-card.drop-no{outline:3px solid #d7372a;outline-offset:2px;cursor:not-allowed}
.oc-empty{padding:40px;color:#767b7e;font-family:"Open Sans",Calibri,Arial,sans-serif}
/* classic teal theme (the old builder's look) */
.theme-classic .oc-card{border:1px solid #0e5a73;border-top:1px solid #0e5a73;background:#0e5a73;border-radius:2px}
.theme-classic .oc-card .oc-name,.theme-classic .oc-card .oc-title{color:#fff}
.theme-classic .oc-card .oc-dept{color:#bfe0ea}
.theme-classic .oc-card.lvl0.s-standard{background:#0a4558;border-color:#0a4558}
.theme-classic .oc-card.s-passive{background:#fff;border:2px solid #0e5a73}
.theme-classic .oc-card.s-passive .oc-name,.theme-classic .oc-card.s-passive .oc-title{color:#0e5a73}
.theme-classic .oc-card.s-passive .oc-dept{color:#4d7d8c}
.theme-classic .oc-card.t-vacant{background:#fff;border:2px dashed #0e5a73}
.theme-classic .oc-card.t-vacant .oc-name{color:#0e5a73}
.theme-classic .oc-lines path{stroke:#0e5a73}
/* divider pages: the blue line + the angled notch (one per piece) */
.oc-divider{display:flex;align-items:center;justify-content:center;height:100%;min-height:320px;padding:30px;box-sizing:border-box}
.oc-divider-inner{position:relative;max-width:820px;width:100%;padding:44px 48px 44px 60px;background:#53575a;color:#fff;
  clip-path:polygon(34px 0,100% 0,100% 100%,0 100%,0 58px);font-family:"Open Sans",Calibri,Arial,sans-serif}
.oc-divider-inner::before{content:"";position:absolute;left:30px;top:44px;bottom:44px;width:8px;background:#00b2e3}
.oc-divider-label{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#00b2e3}
.oc-divider-title{font-size:40px;font-weight:800;line-height:1.1;margin:6px 0 10px}
.oc-divider-sub{font-size:15px;color:#e5e7e8;max-width:620px}
`;
  function install() {
    if (document.getElementById("oc-chart-style")) return;
    const s = document.createElement("style"); s.id = "oc-chart-style"; s.textContent = CSS;
    document.head.appendChild(s);
  }
  return { CSS, install };
})();
