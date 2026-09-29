import pymupdf
d=pymupdf.open('/root/.claude/uploads/2aaa8590-4a45-5909-a053-8f7e4d82cd7a/766e9f72-Brand_Guidelines.pdf')
p=d[7]
clip=pymupdf.Rect(135,200,310,262)
def hexc(c): return '#%02x%02x%02x'%tuple(int(round(x*255)) for x in c)
def f(pt,ox,oy): return f'{pt.x-ox:.3f} {pt.y-oy:.3f}'
def pathd(dr,ox,oy):
    s='';cur=None
    for it in dr['items']:
        k=it[0]
        if k=='re':
            q=it[1]; s+=f'M{q.x0-ox:.3f} {q.y0-oy:.3f}H{q.x1-ox:.3f}V{q.y1-oy:.3f}H{q.x0-ox:.3f}Z'; cur=None; continue
        if k=='qu':
            q=it[1]; s+=f'M{f(q.ul,ox,oy)}L{f(q.ur,ox,oy)}L{f(q.lr,ox,oy)}L{f(q.ll,ox,oy)}Z'; cur=None; continue
        a=it[1]
        if cur is None or abs(cur.x-a.x)>1e-3 or abs(cur.y-a.y)>1e-3:
            if cur is not None: s+='Z'
            s+='M'+f(a,ox,oy)
        if k=='l': s+='L'+f(it[2],ox,oy); cur=it[2]
        elif k=='c': s+='C'+f(it[2],ox,oy)+' '+f(it[3],ox,oy)+' '+f(it[4],ox,oy); cur=it[4]
    return s+'Z'
drs=[dr for dr in p.get_drawings() if clip.contains(dr['rect']) and dr.get('fill')]
def svg(sel,name,recolor):
    bb=None
    for dr in sel: bb=dr['rect'] if bb is None else bb|dr['rect']
    ox,oy=bb.x0,bb.y0
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {bb.width:.3f} {bb.height:.3f}">']
    for dr in sel:
        c=recolor.get(hexc(dr['fill']),hexc(dr['fill']))
        fr=' fill-rule="evenodd"' if dr.get('even_odd') else ''
        out.append(f'<path fill="{c}"{fr} d="{pathd(dr,ox,oy)}"/>')
    out.append('</svg>')
    open(name,'w').write('\n'.join(out)); print(name,bb)
rev={'#55575a':'#ffffff','#14b3e3':'#00b2e3'}
svg(drs,'logo-full-color.svg',{'#14b3e3':'#00b2e3','#55575a':'#53575a'})
svg(drs,'logo-reverse.svg',rev)
word=[dr for dr in drs if dr['rect'].y1<243]
svg(word,'logo-wordmark-reverse.svg',rev)
mark=[dr for dr in drs if dr['rect'].x1<182 and dr['rect'].y1<243]
svg(mark,'aplus-mark-reverse.svg',rev)
plus=[dr for dr in drs if hexc(dr['fill'])=='#14b3e3' and dr['rect'].y1<243]
svg(plus,'plus.svg',rev)
aonly=[dr for dr in drs if dr['rect'].x1<171 and dr['rect'].y1<243]
svg(aonly,'a-glyph.svg',rev)
