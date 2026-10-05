"""Reproducible BodyParts3D 4.0 subset. Usage: python3 scripts/atlas-3d-convert.py SOURCE_DIR.
Original mesh identities and hashes retained; only axis/unit conversion, indexing and gzip.
No geometry from the reference Human Atlas implementation is copied.
"""
import sys,json,zipfile,struct,gzip,hashlib,math
from pathlib import Path
src=Path(sys.argv[1]); out=Path(__file__).resolve().parents[1]/"public/atlas/3d/models"
out.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
selection=[("FMA7480","Göğüs kafesi","Rib cage","iskelet"),("FMA7088","Kalp","Heart","organ"),("FMA7309","Sağ akciğer","Right lung","organ"),("FMA7310","Sol akciğer","Left lung","organ"),("FMA7197","Karaciğer","Liver","organ"),("FMA7148","Mide","Stomach","organ"),("FMA7204","Sağ böbrek","Right kidney","organ"),("FMA7205","Sol böbrek","Left kidney","organ"),("FMA13295","Diyafram","Diaphragm","kas")]
mapping={}
for line in (src/"elements.txt").read_text().splitlines()[1:]:
    cid,name,fid=line.split("\t");mapping.setdefault(cid,[]).append(fid)
archive=zipfile.ZipFile(src/"parts.zip"); files={Path(n).stem:n for n in archive.namelist() if n.endswith(".obj")}
manifest={"schema":1,"dataset":"BodyParts3D 4.0 PART-OF 99% archive","sex":"adult-male-reference","source":"https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip","archiveSha256":sha((src/"parts.zip").read_bytes()),"mappingSha256":sha((src/"elements.txt").read_bytes()),"license":"CC-BY-4.0","licenseUrl":"https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html","accessedAt":"2026-10-05","transform":"(x,y,z) millimetres -> (x,z,-y) metres; source spatial alignment retained; normals recomputed from indexed faces; no extra simplification","reviewStatus":"not-reviewed","structures":[]}
seen=set()
for cid,tr,en,system in selection:
    vertices=[];indices=[];sources=[]
    for fid in sorted(set(mapping[cid])):
        assert fid not in seen, "duplicate anatomical source mesh"
        seen.add(fid); raw=archive.read(files[fid]); offset=len(vertices)//3;local=[];faces=[]
        for line in raw.decode().splitlines():
            a=line.split()
            if not a:continue
            if a[0]=="v":
                x,y,z=map(float,a[1:4]);local.extend((x/1000,z/1000,-y/1000))
            if a[0]=="f":
                f=[int(t.split("/")[0]) for t in a[1:]];f=[v-1 if v>0 else len(local)//3+v for v in f]
                for k in range(1,len(f)-1):faces.extend((f[0]+offset,f[k]+offset,f[k+1]+offset))
        assert local and faces and all(math.isfinite(v) for v in local)
        vertices.extend(local);indices.extend(faces);sources.append({"id":fid,"sha256":sha(raw),"vertices":len(local)//3,"triangles":len(faces)//3})
    assert max(indices)<len(vertices)//3
    binary=struct.pack("<II",len(vertices)//3,len(indices))+struct.pack("<%sf"%len(vertices),*vertices)+struct.pack("<%sI"%len(indices),*indices)
    packed=gzip.compress(binary,compresslevel=9,mtime=0);name=cid+".bin.gz";(out/name).write_bytes(packed)
    manifest["structures"].append({"id":cid,"name":tr,"english":en,"system":system,"file":"models/"+name,"bytes":len(packed),"decodedBytes":len(binary),"sha256":sha(packed),"vertices":len(vertices)//3,"triangles":len(indices)//3,"bounds":[[min(vertices[i::3]) for i in range(3)],[max(vertices[i::3]) for i in range(3)]],"sources":sources})
manifest["meshCount"]=len(seen);manifest["geometryBytes"]=sum(s["bytes"] for s in manifest["structures"])
assert manifest["geometryBytes"]<6*1024*1024,"proof geometry budget 6MiB"
(out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,separators=(",",":"))+"\n")
print(json.dumps({"groups":len(selection),"meshes":len(seen),"geometryBytes":manifest["geometryBytes"],"triangles":sum(s["triangles"] for s in manifest["structures"])}))
