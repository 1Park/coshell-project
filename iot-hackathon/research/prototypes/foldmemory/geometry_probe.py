"""Geometry-only feasibility probe for FoldMemory; no vision or hardware execution.
Run: python3 research/prototypes/foldmemory/geometry_probe.py
Outputs are synthetic fixtures, never measurements of a real postcard or cutter.
"""
import json
import math
from pathlib import Path

S = 40.0
TAB = 7.0
EPS = 1e-7
OUT = Path(__file__).resolve().parent

def add(a, b):
    return tuple(x+y for x,y in zip(a,b))

def mul(a, k):
    return tuple(x*k for x in a)

def dot(a, b):
    return sum(x*y for x,y in zip(a,b))

def world(face, q):
    origin,u,v = face["frame"]
    return add(origin, add(mul(u,q[0]), mul(v,q[1])))

def invert_corner(p):
    return (S-p[1], S-p[0], S-p[2])

def rotate_vector(p):
    return (-p[1], -p[0], -p[2])

faces = [
    {"name":"top","piece":"A","xy":(0,0),"frame":((0,0,S),(1,0,0),(0,1,0))},
    {"name":"front","piece":"A","xy":(0,S),"frame":((0,S,S),(1,0,0),(0,0,-1))},
    {"name":"right","piece":"A","xy":(S,S),"frame":((S,S,S),(0,-1,0),(0,0,-1))},
]
for source,name in zip(list(faces),["bottom","left","back"]):
    o,u,v=source["frame"]
    faces.append({"name":name,"piece":"B","xy":source["xy"],
                  "frame":(invert_corner(o),rotate_vector(u),rotate_vector(v))})

square=[(0,0),(S,0),(S,S),(0,S)]
edges={}
face_polys={}
for f in faces:
    face_polys[f["name"]]=[add(f["xy"],p) for p in square]
    for i in range(4):
        p,q=square[i],square[(i+1)%4]
        key=tuple(sorted([world(f,p),world(f,q)]))
        edges.setdefault(key,[]).append({"face":f["name"],"piece":f["piece"],
                                        "p":add(f["xy"],p),"q":add(f["xy"],q)})
assert len(edges)==12 and all(len(x)==2 for x in edges.values())

def interior_overlap(a,b):
    """SAT for convex polygons. Shared boundaries alone are permitted."""
    for poly in (a,b):
        for p,q in zip(poly,poly[1:]+poly[:1]):
            axis=(q[1]-p[1],p[0]-q[0])
            aa=[dot(v,axis) for v in a];bb=[dot(v,axis) for v in b]
            if min(max(aa),max(bb))-max(min(aa),min(bb))<=EPS:
                return False
    return True

def flap(edge):
    p,q=edge["p"],edge["q"]
    d=((q[0]-p[0])/S,(q[1]-p[1])/S)
    out=(d[1],-d[0])
    return [p,q,add(add(q,mul(d,-TAB)),mul(out,TAB)),
            add(add(p,mul(d,TAB)),mul(out,TAB))]

hinges=[];seams=[]
for pair in edges.values():
    a,b=pair
    if a["piece"]==b["piece"] and {a["p"],a["q"]}=={b["p"],b["q"]}:
        hinges.append(a)
    else:
        options=[]
        for e in pair:
            poly=flap(e)
            if not any(interior_overlap(poly,face_polys[f["name"]])
                       for f in faces if f["piece"]==e["piece"]):
                options.append({**e,"poly":poly})
        seams.append({"pair":pair,"options":options})
assert len(hinges)==4 and len(seams)==8

def select_tabs(i,selected):
    if i==len(seams): return selected
    for option in seams[i]["options"]:
        if any(option["piece"]==old["piece"] and
               interior_overlap(option["poly"],old["poly"]) for old in selected):
            continue
        answer=select_tabs(i+1,selected+[option])
        if answer is not None:return answer
    return None

tabs=select_tabs(0,[])
assert tabs is not None, "No collision-free tab assignment for this net"

def rotate(p,k):
    x,y=p
    for _ in range(k):x,y=-y,x
    return (x,y)

def bounds(poly):
    xs,ys=zip(*poly)
    return min(xs),min(ys),max(xs),max(ys)

def transform(poly,k,tx,ty):
    return [(rotate(p,k)[0]+tx,rotate(p,k)[1]+ty) for p in poly]

def inside(region,face,margin=2.0):
    x0,y0,x1,y1=region; a,b,c,d=bounds(face)
    return x0>=a+margin-EPS and y0>=b+margin-EPS and x1<=c-margin+EPS and y1<=d-margin+EPS

# Synthetic semantic outputs. No claim that an OCR or face model produced these.
fixture={
 "paper_mm":[148,105],
 "A":[{"role":"photo","required_face":"top","rect":[25,18,43,34]},
      {"role":"event_name","required_face":"front","rect":[22,61,47,67]},
      {"role":"date","required_face":"front","rect":[22,70,45,75]}],
 "B":[{"role":"destination","required_face":"left","rect":[22,61,47,67]},
      {"role":"date","required_face":"left","rect":[22,70,45,75]}],
}

def solve_piece(piece,requirements):
    polys=[face_polys[f["name"]] for f in faces if f["piece"]==piece]
    polys += [t["poly"] for t in tabs if t["piece"]==piece]
    for k in range(4):
        all_points=[rotate(p,k) for poly in polys for p in poly]
        x0,y0,x1,y1=bounds(all_points)
        for tx in range(math.ceil(-x0),math.floor(fixture["paper_mm"][0]-x1)+1):
            for ty in range(math.ceil(-y0),math.floor(fixture["paper_mm"][1]-y1)+1):
                transformed={f["name"]:transform(face_polys[f["name"]],k,tx,ty)
                             for f in faces if f["piece"]==piece}
                if all(inside(r["rect"],transformed[r["required_face"]]) for r in requirements):
                    return {"rotation_quarters":k,"translation_mm":[tx,ty],"faces":transformed}
    return None

placements={p:solve_piece(p,fixture[p]) for p in ["A","B"]}
assert all(placements.values())
# An impossible source location must be rejected, not silently cropped.
impossible=[{"role":"too_wide","required_face":"top","rect":[0,0,100,20]}]
assert solve_piece("A",impossible) is None

report={
 "evidence_level":"synthetic_geometry_only_no_AI_no_hardware",
 "cube_edge_mm":S,"paper_mm":fixture["paper_mm"],
 "world_edge_pairs":len(edges),"hinges":len(hinges),"glued_seams":len(seams),
 "tab_face_and_tab_tab_overlap":False,
 "impossible_fixture_rejected":True,
 "placements":placements,
 "inputs":fixture,
 "limits":["No OCR or face model was run.","No paper was cut or folded.",
           "No material thickness, blade offset, kerf, glue strength or cutting tolerance was modeled.",
           "No comparison of user effort or product value was performed.",
           "Synthetic rectangles omit text orientation; readable orientation requires further constraints.",
           "This shows a feasible two-piece cube, not a general unfolding or nesting solution."]
}
(OUT/"geometry_report.json").write_text(json.dumps(report,indent=2)+"\n")

def points(poly,dx=0):
    return " ".join(f"{x+dx:.2f},{y:.2f}" for x,y in poly)
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 326 150" width="978" height="450">',
 '<rect width="326" height="150" fill="#faf9f5"/>',
 '<style>text{font-family:Arial,sans-serif;fill:#253247;font-size:4px}.face{fill:none;stroke:#253247;stroke-width:.4}.fold{stroke:#3273b8;stroke-width:.5;stroke-dasharray:2 1}.tab{fill:#e2e8f0;stroke:#253247;stroke-width:.35}.region{fill:#94d4b3;fill-opacity:.45;stroke:#2a7c59;stroke-width:.35}</style>',
 '<text x="8" y="8" style="font-size:5px">FoldMemory: synthetic geometry probe</text>',
 '<text x="8" y="15">No camera/model/cutter tested. Dark edges are panel outlines, not a production toolpath.</text>']
for piece,dx in [("A",8),("B",170)]:
    placement=placements[piece];k=placement["rotation_quarters"];tx,ty=placement["translation_mm"]
    svg.append(f'<g transform="translate({dx},25)">')
    svg.append('<rect width="148" height="105" fill="white" stroke="#bbb" stroke-width=".4"/>')
    for tab in tabs:
        if tab["piece"]==piece:
            svg.append(f'<polygon points="{points(transform(tab["poly"],k,tx,ty))}" class="tab"/>')
    for name,poly in placement["faces"].items():
        svg.append(f'<polygon points="{points(poly)}" class="face"/>')
        x0,y0,x1,y1=bounds(poly)
        svg.append(f'<text x="{x0+2}" y="{y0+5}">{name}</text>')
    for hinge in hinges:
        if hinge["piece"]==piece:
            a,b=transform([hinge["p"],hinge["q"]],k,tx,ty)
            svg.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" class="fold"/>')
    for reg in fixture[piece]:
        x0,y0,x1,y1=reg["rect"]
        svg.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" class="region"/>')
        svg.append(f'<text x="{x0}" y="{y0-1}">{reg["role"]}</text>')
    svg.append(f'<text x="0" y="112">Card {piece}: 148 x 105 mm</text></g>')
svg.append('</svg>')
(OUT/"layout.svg").write_text("\n".join(svg)+"\n")
print(json.dumps({k:report[k] for k in ["evidence_level","world_edge_pairs","hinges","glued_seams","impossible_fixture_rejected"]}))
