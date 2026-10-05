"""Build optional whole-body 3D system samples from attributed source archives.

Usage: python3 scripts/atlas-3d-expand.py BODY_PARTS_SOURCE HRA_FEMALE_GLB
The two downloaded inputs are not committed. Output is indexed, gzip-compressed
geometry in the same format as the existing proof, with explicit source hashes.
No synthetic anatomy or geometry from another atlas UI is used.
"""
import gzip
import hashlib
import json
import math
import struct
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
body_source = Path(sys.argv[1])
female_source = Path(sys.argv[2])
out = root / "public/atlas/3d/models/expansion"
out.mkdir(parents=True, exist_ok=True)
digest = lambda data: hashlib.sha256(data).hexdigest()

# IDs are from the official BodyParts3D element map. They deliberately span the
# whole body; a system is not described as complete when its source is partial.
male = [
    ("FMA7163", "Deri", "Skin", "surface", "surface"),
    ("FMA46565", "Kafatası", "Skull", "skeleton", "skull"),
    ("FMA13478", "Omurga", "Vertebral column", "skeleton", "spine"),
    ("FMA16581", "Pelvis", "Pelvic girdle", "skeleton", "pelvis"),
    ("FMA7185", "Sağ kol ve el", "Right upper limb", "skeleton", "upper-limbs"),
    ("FMA7186", "Sol kol ve el", "Left upper limb", "skeleton", "upper-limbs"),
    ("FMA7187", "Sağ bacak ve ayak", "Right lower limb", "skeleton", "lower-limbs"),
    ("FMA7188", "Sol bacak ve ayak", "Left lower limb", "skeleton", "lower-limbs"),
    ("FMA50801", "Beyin", "Brain", "nervous", "brain"),
    ("FMA7647", "Omurilik", "Spinal cord", "nervous", "spine"),
    ("FMA3734", "Aort", "Aorta", "circulatory", "heart"),
    ("FMA4720", "Üst ana toplardamar", "Superior vena cava", "circulatory", "heart"),
    ("FMA10951", "Alt ana toplardamar", "Inferior vena cava", "circulatory", "heart"),
    ("FMA7200", "İnce bağırsak", "Small intestine", "digestive", None),
    ("FMA7201", "Kalın bağırsak", "Large intestine", "digestive", None),
    ("FMA7198", "Pankreas", "Pancreas", "digestive", None),
    ("FMA15900", "Mesane", "Urinary bladder", "urinary", None),
    ("FMA7394", "Soluk borusu", "Trachea", "respiratory", "lungs"),
    ("FMA9607", "Timus", "Thymus", "lymphatic", None),
    ("FMA13373", "Sağ göğüs kası", "Right pectoralis major", "muscular", None),
    ("FMA13374", "Sol göğüs kası", "Left pectoralis major", "muscular", None),
    ("FMA86917", "Karın kas grubu", "Abdominal musculature", "muscular", None),
]

def pack(group, vertices, indices, suffix, source_items):
    assert vertices and indices and len(vertices) % 3 == 0
    assert all(math.isfinite(value) for value in vertices)
    assert max(indices) < len(vertices) // 3
    raw = (struct.pack("<II", len(vertices) // 3, len(indices))
           + struct.pack(f"<{len(vertices)}f", *vertices)
           + struct.pack(f"<{len(indices)}I", *indices))
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    name = f"{suffix}.bin.gz"
    (out / name).write_bytes(packed)
    return {
        "id": group[0], "name": group[1], "english": group[2],
        "system": group[3], "twoD": group[4],
        "file": f"models/expansion/{name}", "bytes": len(packed),
        "decodedBytes": len(raw), "sha256": digest(packed),
        "vertices": len(vertices) // 3, "triangles": len(indices) // 3,
        "bounds": [[min(vertices[axis::3]) for axis in range(3)],
                   [max(vertices[axis::3]) for axis in range(3)]],
        "sources": source_items,
    }

mapping = {}
for line in (body_source / "elements.txt").read_text().splitlines()[1:]:
    cid, _, fid = line.split("\t")
    mapping.setdefault(cid, set()).add(fid)
archive = zipfile.ZipFile(body_source / "parts.zip")
source_paths = {Path(name).stem: name for name in archive.namelist() if name.endswith(".obj")}
male_structures = []
for group in male:
    vertices, indices, origins = [], [], []
    for fid in sorted(mapping[group[0]]):
        raw = archive.read(source_paths[fid])
        offset = len(vertices) // 3
        local = []
        faces = []
        for line in raw.decode().splitlines():
            parts = line.split()
            if not parts: continue
            if parts[0] == "v":
                x, y, z = map(float, parts[1:4])
                local.extend((x / 1000, z / 1000, -y / 1000))
            elif parts[0] == "f":
                face = [int(token.split("/")[0]) for token in parts[1:]]
                face = [v - 1 if v > 0 else len(local) // 3 + v for v in face]
                for k in range(1, len(face) - 1):
                    faces.extend((face[0] + offset, face[k] + offset, face[k + 1] + offset))
        vertices.extend(local)
        indices.extend(faces)
        origins.append({"id": fid, "sha256": digest(raw)})
    male_structures.append(pack(group, vertices, indices, f"male-{group[0]}", origins))

# HRA v1.5 has a full female skin surface and selected organs/systems. Some
# skeletal and muscular regions are absent in this source. The manifest keeps
# that distinction instead of inventing female anatomy or relabeling male data.
female_groups = [
    (2, "Deri", "Skin", "surface", "surface"),
    (3, "Meme bezleri", "Mammary glands", "reproductive", None),
    (23, "Gözler", "Eyes", "nervous", None),
    (81, "Beyin", "Brain", "nervous", "brain"),
    (367, "Omurilik", "Spinal cord", "nervous", "spine"),
    (398, "Göz kasları", "Ocular muscles", "muscular", None),
    (413, "Diz kası örnekleri", "Knee muscle examples", "muscular", None),
    (433, "Fallop tüpleri", "Fallopian tubes", "reproductive", None),
    (468, "Yumurtalıklar", "Ovaries", "reproductive", None),
    (471, "Rahim", "Uterus", "reproductive", None),
    (486, "Kalın bağırsak", "Colon", "digestive", None),
    (497, "İnce bağırsak", "Small intestine", "digestive", None),
    (520, "Karaciğer", "Liver", "digestive", "liver"),
    (553, "Pankreas", "Pancreas", "digestive", None),
    (559, "Safra kesesi", "Gallbladder", "digestive", None),
    (563, "Böbrekler", "Kidneys", "urinary", "kidneys"),
    (624, "Üreterler", "Ureters", "urinary", None),
    (664, "Mesane", "Urinary bladder", "urinary", None),
    (673, "Kalp", "Heart", "circulatory", "heart"),
    (799, "Kalp damarları", "Heart vasculature", "circulatory", None),
    (849, "Akciğerler", "Lungs", "respiratory", "lungs"),
    (884, "Gırtlak", "Larynx", "respiratory", None),
    (895, "Soluk borusu ve bronşlar", "Tracheobronchial tree", "respiratory", None),
    (944, "Dalak", "Spleen", "lymphatic", None),
    (950, "Timus", "Thymus", "lymphatic", None),
    (962, "Pelvis", "Pelvis", "skeleton", "pelvis"),
    (986, "Bacak kemikleri", "Lower limb bones", "skeleton", "lower-limbs"),
    (1047, "Omurga", "Vertebrae", "skeleton", "spine"),
]
glb = female_source.read_bytes()
assert glb[:4] == b"glTF" and struct.unpack_from("<I", glb, 8)[0] == len(glb)
json_len, json_type = struct.unpack_from("<II", glb, 12)
assert json_type == 0x4e4f534a
data = json.loads(glb[20:20 + json_len])
binary_header = 20 + json_len
binary_len, binary_type = struct.unpack_from("<II", glb, binary_header)
assert binary_type == 0x004e4942
binary_start = binary_header + 8
nodes = data["nodes"]

def descendants(index):
    node = nodes[index]
    result = [index] if "mesh" in node else []
    for child in node.get("children", []):
        result.extend(descendants(child))
    return result

def accessor(index):
    item = data["accessors"][index]
    view = data["bufferViews"][item["bufferView"]]
    count = item["count"]
    components = {"SCALAR": 1, "VEC3": 3}[item["type"]]
    kind = {5123: "H", 5125: "I", 5126: "f"}[item["componentType"]]
    size = struct.calcsize("<" + kind) * components
    stride = view.get("byteStride", size)
    start = binary_start + view.get("byteOffset", 0) + item.get("byteOffset", 0)
    assert start + (count - 1) * stride + size <= binary_start + binary_len
    return [value for i in range(count)
            for value in struct.unpack_from("<" + kind * components, glb, start + i * stride)]

female_structures = []
used = set()
for index, tr, en, system, two_d in female_groups:
    vertices, indices, origins = [], [], []
    for node_index in descendants(index):
        if node_index in used: continue
        used.add(node_index)
        node = nodes[node_index]
        primitive = data["meshes"][node["mesh"]]["primitives"][0]
        if primitive.get("mode", 4) != 4: continue
        local = accessor(primitive["attributes"]["POSITION"])
        faces = accessor(primitive["indices"])
        offset = len(vertices) // 3
        # The HRA model is in metres with its vertical axis already Y. Shift
        # the reference floor to y=0; preserve source x/z and all relationships.
        vertices.extend(v + .9 if axis % 3 == 1 else v for axis, v in enumerate(local))
        indices.extend(i + offset for i in faces)
        origins.append({"node": node_index, "name": node.get("name"),
                        "ontologyId": node.get("extras", {}).get("ontologyid")})
    if vertices:
        group = (f"HRA{index}", tr, en, system, two_d)
        female_structures.append(pack(group, vertices, indices, f"female-{index}", origins))

manifest = {
    "schema": 1, "reviewStatus": "not-reviewed",
    "male": {
        "dataset": "BodyParts3D 4.0 PART-OF 99% archive",
        "source": "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip",
        "sourceSha256": digest((body_source / "parts.zip").read_bytes()),
        "license": "CC-BY-4.0",
        "attribution": "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
        "transform": "(x,y,z) millimetres -> (x,z,-y) metres",
        "structures": male_structures,
    },
    "female": {
        "dataset": "HRA 3D Reference Object Library, united-female v1.5",
        "source": "https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb",
        "sourceSha256": digest(glb),
        "license": "CC-BY-4.0",
        "attribution": "Browne K, Cross LE, Herr II BW, Record EG, Quardokus EM, Bueckle A, Börner K. HuBMAP CCF 3D Reference Object Library (2020); adapted from united-female v1.5",
        "transform": "Source metres and orientation retained, y + 0.9 m for display",
        "limitations": "Female v1.5 lacks upper-limb/skull/rib skeleton and most limb/trunk muscles; not a complete anatomy model.",
        "structures": female_structures,
    },
}
(out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
print(json.dumps({sex: {"structures": len(entry["structures"]),
                        "bytes": sum(s["bytes"] for s in entry["structures"]),
                        "triangles": sum(s["triangles"] for s in entry["structures"])}
                  for sex, entry in (("male", manifest["male"]), ("female", manifest["female"]))}))
