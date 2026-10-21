/* layout.js — positions every card of a page and the connector lines between them.
   The old builder drew connectors with CSS borders and then tried to "fix" them after the browser laid things out,
   which is why lines broke, charts clipped and printing drifted. Here the geometry is computed once, in chart units,
   and the same numbers drive the screen, the exported HTML, print/PDF, PNG and PowerPoint.

   layout(tree, opts) -> { w, h, cards: [{ node, x, y }], segs: [[x1, y1, x2, y2]] }

   Arrangements for a manager's reports:
     horizontal  one row under a bus line
     vertical    a stacked column hanging off a spine (indented list)
     grid        rows of a balanced width; each row's bus joins a rail on the left, so no line crosses a card
     auto        managers side by side + individual contributors as one stacked column (grid when there are
                 no sub-managers and more than four reports) */
OC.layout = (() => {
  const SIZES = {
    comfortable: { CW: 212, CH: 86, HG: 22, VG: 46, IND: 24, SG: 12, RG: 34 },
    compact: { CW: 184, CH: 64, HG: 16, VG: 36, IND: 20, SG: 9, RG: 26 },
  };

  /* Columns for a grid of n reports. "wide" (the top of a page) favours rows; deeper teams favour compact columns so
     a department with several teams stays closer to the shape of a screen or a landscape sheet. */
  function gridCols(n, maxCols = 6, wide = true) {
    if (!wide) { if (n <= 3) return n; if (n <= 8) return 2; if (n <= 15) return 3; }
    if (n <= 4) return n;
    const maxc = Math.min(maxCols, Math.ceil(Math.sqrt(n * 2)));
    const rows = Math.ceil(n / maxc);
    return Math.ceil(n / rows);
  }

  function layout(tree, { density = "comfortable", maxCols = 6 } = {}) {
    const S = SIZES[density] || SIZES.comfortable;
    const { CW, CH, HG, VG, IND, SG, RG } = S;

    // A block is a laid-out subtree in local coordinates: card at (cx - CW/2, 0).
    function block(node) {
      const kids = node.kids || [];
      if (!kids.length) return { w: CW, h: CH, cx: CW / 2, cards: [{ node, x: 0, y: 0 }], segs: [] };
      let mode = node.layout || "auto";
      const blocks = kids.map(block);
      const mgrs = kids.filter((k) => k.kids && k.kids.length);
      const top = (node.level || 0) === 0;
      if (mode === "auto") {
        if (!mgrs.length) mode = kids.length <= 3 || (top && kids.length <= 4) ? "horizontal" : "grid";
        else if (mgrs.length === kids.length) mode = kids.length <= 5 ? "horizontal" : "grid";
        else return mixed(node, kids, blocks);
      }
      // Stacking only makes sense for people without their own team: anyone with a team stays side by side.
      if (mode === "vertical") return mgrs.length ? (mgrs.length === kids.length ? row(node, blocks) : mixed(node, kids, blocks)) : stack(node, blocks);
      if (mode === "grid") return grid(node, blocks, gridCols(blocks.length, maxCols, top || mgrs.length > 0));
      return row(node, blocks);
    }

    function shift(b, dx, dy) {
      return { cards: b.cards.map((c) => ({ node: c.node, x: c.x + dx, y: c.y + dy })), segs: b.segs.map((s) => [s[0] + dx, s[1] + dy, s[2] + dx, s[3] + dy]) };
    }
    function merge(out, b, dx, dy) { const s = shift(b, dx, dy); out.cards.push(...s.cards); out.segs.push(...s.segs); }

    // Lay blocks left-to-right; returns positions (local x of each block) and the row's width/height.
    function lineUp(blocks) {
      let x = 0; const xs = [];
      blocks.forEach((b, i) => { xs.push(x); x += b.w + (i < blocks.length - 1 ? HG : 0); });
      return { xs, w: x, h: Math.max(...blocks.map((b) => b.h)) };
    }

    function row(node, blocks) {
      const L = lineUp(blocks);
      const first = L.xs[0] + blocks[0].cx, last = L.xs[blocks.length - 1] + blocks[blocks.length - 1].cx;
      let pcx = (first + last) / 2;
      let off = 0; // shift the row right if the parent card would stick out on the left
      if (pcx - CW / 2 < 0) off = CW / 2 - pcx;
      pcx += off;
      const w = Math.max(L.w + off, pcx + CW / 2);
      const top = CH + VG, bus = CH + VG / 2;
      const out = { w, h: top + L.h, cx: pcx, cards: [{ node, x: pcx - CW / 2, y: 0 }], segs: [] };
      out.segs.push([pcx, CH, pcx, bus]);
      if (blocks.length > 1 || Math.abs(first + off - pcx) > 0.5) out.segs.push([Math.min(first + off, pcx), bus, Math.max(last + off, pcx), bus]);
      blocks.forEach((b, i) => {
        const bx = L.xs[i] + off;
        out.segs.push([bx + b.cx, bus, bx + b.cx, top]);
        merge(out, b, bx, top);
      });
      return out;
    }

    function stack(node, blocks) {
      const spine = IND, kx = IND * 2;
      const out = { w: CW, h: CH, cx: CW / 2, cards: [{ node, x: 0, y: 0 }], segs: [] };
      let y = CH + SG + 4, lastMid = CH;
      blocks.forEach((b) => {
        const cardLeft = kx + b.cx - CW / 2, mid = y + CH / 2;
        out.segs.push([spine, mid, kx + b.cx - CW / 2, mid]);
        merge(out, b, kx, y);
        lastMid = mid;
        out.w = Math.max(out.w, kx + b.w);
        y += b.h + SG;
        void cardLeft;
      });
      out.segs.push([spine, CH, spine, lastMid]);
      out.h = y - SG;
      return out;
    }

    function grid(node, blocks, cols) {
      const rows = [];
      for (let i = 0; i < blocks.length; i += cols) rows.push(blocks.slice(i, i + cols));
      const lines = rows.map(lineUp);
      const gridW = Math.max(...lines.map((l) => l.w));
      const rail = 0, left = HG; // rail on the left, rows start after it
      const innerW = left + gridW;
      let pcx = left + gridW / 2;
      if (rows.length === 1) return row(node, blocks);
      const w = Math.max(innerW, pcx + CW / 2);
      const out = { w, h: 0, cx: pcx, cards: [{ node, x: pcx - CW / 2, y: 0 }], segs: [] };
      const rowX = lines.map((L) => left + (gridW - L.w) / 2); // center each row
      // A trunk straight down the middle reads best, but only if it passes between the blocks of every row it crosses;
      // otherwise the rows hang off a rail on the left.
      const clear = rows.slice(0, -1).every((r, ri) => r.every((b, i) => { const bx = rowX[ri] + lines[ri].xs[i]; return pcx < bx - 4 || pcx > bx + b.w + 4; }));
      let y = CH + VG;
      const buses = [];
      rows.forEach((r, ri) => {
        const L = lines[ri], rx = rowX[ri];
        const bus = y - (ri === 0 ? VG / 2 : RG / 2);
        const first = rx + L.xs[0] + r[0].cx, last = rx + L.xs[r.length - 1] + r[r.length - 1].cx;
        buses.push(bus);
        if (clear) out.segs.push([Math.min(first, pcx), bus, Math.max(last, pcx), bus]);
        else {
          out.segs.push([ri === 0 ? Math.min(first, pcx) : rail, bus, Math.max(last, ri === 0 ? pcx : last), bus]);
          if (ri === 0) out.segs.push([rail, bus, Math.min(first, pcx), bus]);
        }
        r.forEach((b, i) => {
          const bx = rx + L.xs[i];
          out.segs.push([bx + b.cx, bus, bx + b.cx, y]);
          merge(out, b, bx, y);
        });
        y += L.h + RG;
      });
      if (clear) out.segs.push([pcx, CH, pcx, buses[buses.length - 1]]);
      else { out.segs.push([pcx, CH, pcx, buses[0]]); out.segs.push([rail, buses[0], rail, buses[buses.length - 1]]); }
      out.h = y - RG;
      return out;
    }

    function mixed(node, kids, blocks) {
      const mgrBlocks = [], leafBlocks = [];
      kids.forEach((k, i) => (k.kids && k.kids.length ? mgrBlocks : leafBlocks).push(blocks[i]));
      // The individual contributors become one "stack" block hanging from its own drop line.
      const sk = { w: IND + CW, h: 0, cx: 0, cards: [], segs: [] };
      let y = 0, lastMid = 0;
      leafBlocks.forEach((b) => { const mid = y + CH / 2; sk.segs.push([0, mid, IND, mid]); merge(sk, b, IND, y); lastMid = mid; y += b.h + SG; });
      sk.segs.push([0, 0, 0, lastMid]);
      sk.h = y - SG;
      return row(node, [...mgrBlocks, sk]);
    }

    // ---- page: context chain above the root(s); several roots sit side by side without connectors
    const roots = tree.roots || [];
    const ctx = tree.context || [];
    const page = { w: 0, h: 0, cards: [], segs: [] };
    if (!roots.length) return { w: CW, h: CH, cards: [], segs: [], S };
    const rb = roots.map(block);
    const L = lineUp(rb);
    const gap = HG * 3;
    let x = 0; const xs = [];
    rb.forEach((b, i) => { xs.push(x); x += b.w + (i < rb.length - 1 ? gap : 0); });
    const rootsW = x;
    let top = 0;
    if (ctx.length && rb.length === 1) {
      const cx = xs[0] + rb[0].cx;
      const left = Math.min(0, cx - CW / 2);
      const dx = -left;
      ctx.forEach((n, i) => {
        page.cards.push({ node: n, x: cx - CW / 2 + dx, y: top });
        page.segs.push([cx + dx, top + CH, cx + dx, top + CH + VG * 0.6]);
        top += CH + VG * 0.6;
        void i;
      });
      rb.forEach((b, i) => merge(page, b, xs[i] + dx, top));
      page.w = Math.max(rootsW + dx, cx + dx + CW / 2);
    } else {
      rb.forEach((b, i) => merge(page, b, xs[i], top));
      page.w = rootsW;
    }
    page.h = top + L.h;
    page.S = S;
    return page;
  }

  /* Connector segments -> one SVG path (rounded to half pixels so 1.5px lines stay crisp). */
  function pathOf(segs) {
    const r = (v) => Math.round(v * 2) / 2;
    return segs.map((s) => `M${r(s[0])} ${r(s[1])}L${r(s[2])} ${r(s[3])}`).join("");
  }

  return { layout, pathOf, SIZES, gridCols };
})();
