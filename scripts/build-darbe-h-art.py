#!/usr/bin/env python3
"""DARBE-H! crisis-desk SVG batch. Identity: telex / dossier / stamp. No mechanics."""
from __future__ import annotations

import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/games/darbe-h/source-cards.json"
OUT_SVG = ROOT / "public/games/darbe-h/assets/cards"
MANIFEST = ROOT / "public/games/darbe-h/assets/art-manifest.json"

SERIES = {
    "Dosya": ("#3d5a73", "DOSYA", "folder"),
    "Paraf": ("#5a6e4e", "PARAF", "stamp"),
    "Heyet": ("#6b4e6e", "HEYET", "table"),
    "Karargah": ("#4a5568", "KARARGAH", "desk"),
    "Telex": ("#8a6a3a", "TELEX", "telex"),
    "Muhtira": ("#7a3d3d", "MUHTIRA", "memo"),
    "Zeyil": ("#3d6a6a", "ZEYIL", "annex"),
    "Brifing": ("#3d5e7a", "BRIFING", "brief"),
    "Kabine": ("#5a4a3a", "KABINE", "cabinet"),
    "Arsiv": ("#4a5a4a", "ARSIV", "box"),
    "Tebligat": ("#6a5a32", "TEBLIGAT", "envelope"),
    "Mesruiyet": ("#3a4a6a", "MESRUIYET", "seal"),
    "İhtar": ("#8a4a32", "IHTAR", "notice"),
    "Ihtar": ("#8a4a32", "IHTAR", "notice"),
}

KIND = {
    "unit": ("GÖREVLİ", "#c4a574"),
    "spell": ("EMİRNAME", "#d8c48a"),
    "trap": ("İHTAR", "#d07a4a"),
}


def series_key(raw: str) -> str:
    if not raw:
        return "Dosya"
    if "—" in raw:
        return raw.split("—")[-1].strip()
    if "-" in raw and raw.split("-")[-1].strip() in SERIES:
        return raw.split("-")[-1].strip()
    return raw.strip()


def esc(s: str) -> str:
    amp = chr(38)
    table = {
        "&": amp + "amp;",
        "<": amp + "lt;",
        ">": amp + "gt;",
        '"': amp + "quot;",
    }
    return "".join(table.get(ch, ch) for ch in str(s))


def motif(kind: str, cx=200, cy=250) -> str:
    ink = "#e8dcc4"
    gold = "#c4a574"
    if kind == "folder":
        return f'<rect x="{cx-70}" y="{cy-40}" width="140" height="90" fill="none" stroke="{ink}" stroke-width="3"/><path d="M{cx-70} {cy-40} h50 l12 -16 h78" fill="none" stroke="{gold}" stroke-width="3"/>'
    if kind == "stamp":
        return f'<circle cx="{cx}" cy="{cy}" r="54" fill="none" stroke="{gold}" stroke-width="4"/><circle cx="{cx}" cy="{cy}" r="38" fill="none" stroke="{ink}" stroke-width="2"/><text x="{cx}" y="{cy+8}" text-anchor="middle" fill="{gold}" font-family="Georgia,serif" font-size="18">P</text>'
    if kind == "table":
        return f'<rect x="{cx-80}" y="{cy-16}" width="160" height="12" fill="{gold}"/><rect x="{cx-70}" y="{cy-4}" width="10" height="50" fill="{ink}"/><rect x="{cx+60}" y="{cy-4}" width="10" height="50" fill="{ink}"/><circle cx="{cx-40}" cy="{cy-36}" r="10" fill="none" stroke="{ink}" stroke-width="2"/><circle cx="{cx}" cy="{cy-36}" r="10" fill="none" stroke="{ink}" stroke-width="2"/><circle cx="{cx+40}" cy="{cy-36}" r="10" fill="none" stroke="{ink}" stroke-width="2"/>'
    if kind == "desk":
        return f'<rect x="{cx-90}" y="{cy-30}" width="180" height="70" fill="none" stroke="{ink}" stroke-width="3"/><rect x="{cx-70}" y="{cy-50}" width="40" height="28" fill="none" stroke="{gold}" stroke-width="2"/><path d="M{cx+20} {cy-10} h50 v20 h-50z" fill="none" stroke="{gold}" stroke-width="2"/>'
    if kind == "telex":
        tape = "".join(
            f'<rect x="{cx-90+i*14}" y="{cy-8+(i%3)*4}" width="8" height="8" fill="{ink if i%2==0 else gold}"/>'
            for i in range(13)
        )
        return f'<rect x="{cx-100}" y="{cy-40}" width="200" height="80" fill="none" stroke="{gold}" stroke-width="3"/>{tape}'
    if kind == "memo":
        return f'<rect x="{cx-60}" y="{cy-70}" width="120" height="150" fill="none" stroke="{ink}" stroke-width="2"/><line x1="{cx-40}" y1="{cy-40}" x2="{cx+40}" y2="{cy-40}" stroke="{gold}" stroke-width="2"/><line x1="{cx-40}" y1="{cy-10}" x2="{cx+40}" y2="{cy-10}" stroke="{ink}" stroke-width="1.5"/><line x1="{cx-40}" y1="{cy+16}" x2="{cx+20}" y2="{cy+16}" stroke="{ink}" stroke-width="1.5"/>'
    if kind == "annex":
        return f'<rect x="{cx-80}" y="{cy-50}" width="160" height="110" fill="none" stroke="{ink}" stroke-width="2"/><rect x="{cx+40}" y="{cy-50}" width="18" height="110" fill="{gold}"/>'
    if kind == "brief":
        return f'<rect x="{cx-50}" y="{cy+10}" width="100" height="14" fill="{gold}"/><polygon points="{cx-30},{cy+10} {cx},{cy-50} {cx+30},{cy+10}" fill="none" stroke="{ink}" stroke-width="3"/>'
    if kind == "cabinet":
        return f'<rect x="{cx-70}" y="{cy-60}" width="40" height="120" fill="none" stroke="{ink}" stroke-width="3"/><rect x="{cx-20}" y="{cy-60}" width="40" height="120" fill="none" stroke="{gold}" stroke-width="3"/><rect x="{cx+30}" y="{cy-60}" width="40" height="120" fill="none" stroke="{ink}" stroke-width="3"/>'
    if kind == "box":
        return f'<rect x="{cx-70}" y="{cy-20}" width="140" height="70" fill="none" stroke="{ink}" stroke-width="3"/><path d="M{cx-70} {cy-20} L{cx} {cy-50} L{cx+70} {cy-20}" fill="none" stroke="{gold}" stroke-width="3"/>'
    if kind == "envelope":
        return f'<rect x="{cx-80}" y="{cy-40}" width="160" height="90" fill="none" stroke="{ink}" stroke-width="3"/><path d="M{cx-80} {cy-40} L{cx} {cy+10} L{cx+80} {cy-40}" fill="none" stroke="{gold}" stroke-width="3"/>'
    if kind == "seal":
        return f'<circle cx="{cx}" cy="{cy}" r="48" fill="none" stroke="{gold}" stroke-width="5"/><text x="{cx}" y="{cy+10}" text-anchor="middle" fill="{ink}" font-family="Georgia,serif" font-size="22">M</text>'
    # notice
    return f'<polygon points="{cx},{cy-60} {cx+62},{cy+48} {cx-62},{cy+48}" fill="none" stroke="{gold}" stroke-width="4"/><text x="{cx}" y="{cy+18}" text-anchor="middle" fill="{ink}" font-family="Georgia,serif" font-size="28">!</text>'


def scene(card: dict, motif_id: str, tint: str) -> str:
    """A small authored crisis-desk scene, deterministically varied per card identity."""
    number = int((card.get("id") or "DRB-001").split("-")[-1])
    variant = number % 12
    angle = (-7, -4, 3, 6)[number % 4]
    paper = ("#d2c4a3", "#c7b58f", "#ddd0ae")[number % 3]
    shadow = "#111720"
    grain = "".join(
        f'<path d="M{45 + ((number * 17 + i * 47) % 300)} {145 + i * 29} l{18 + i * 3} {-4 + i}" stroke="#eadfbe" opacity=".10"/>'
        for i in range(7)
    )
    common = f'<rect x="36" y="118" width="328" height="268" fill="#171b20"/><path d="M36 334 L364 291 V386 H36Z" fill="#3a2d24"/><path d="M36 337 L364 294" stroke="#8f7355" opacity=".45"/>{grain}'
    scenes = [
        f'<g transform="rotate({angle} 205 250)"><rect x="92" y="157" width="224" height="151" rx="2" fill="{paper}" stroke="#8b7657"/><path d="M112 185h145M112 203h176M112 221h132M112 255h162M112 273h101" stroke="#55483a" opacity=".7"/><rect x="245" y="235" width="52" height="35" fill="none" stroke="{tint}" stroke-width="5" transform="rotate(-8 271 252)"/><text x="271" y="258" text-anchor="middle" fill="{tint}" font-size="11" font-weight="700">GİZLİ</text></g>',
        f'<rect x="72" y="167" width="256" height="116" rx="8" fill="#2a3034" stroke="#8f816b"/><rect x="96" y="186" width="208" height="42" fill="{paper}"/><path d="M106 197h167M106 208h144M106 219h178" stroke="#51483b"/><g fill="#b7aa8d">' + ''.join(f'<circle cx="{105+i*23}" cy="254" r="6"/>' for i in range(9)) + '</g><path d="M285 283v38h47" fill="none" stroke="#b9aa87" stroke-width="4"/>',
        f'<path d="M72 169h238l24 154H57Z" fill="#bbaa83" stroke="#5e4b37"/><path d="M92 191l78 23 53-19 86 39-62 68-84-21-73 24Z" fill="#7e8b76" stroke="#4b5548"/><path d="M110 277c54-71 113-24 175-72" fill="none" stroke="{tint}" stroke-width="4"/><circle cx="188" cy="247" r="8" fill="#8c3e35"/><circle cx="260" cy="216" r="6" fill="#b99a54"/>',
        f'<rect x="72" y="176" width="86" height="117" fill="#222b2d" stroke="#9a896d"/><circle cx="115" cy="213" r="24" fill="none" stroke="#c2b18e" stroke-width="4"/><path d="M92 267h46M163 207c32-32 69-29 98-6M167 223c39-27 78-20 111 7" fill="none" stroke="{tint}" stroke-width="3"/><rect x="265" y="189" width="58" height="103" rx="8" fill="#171d20" stroke="#ad9a78"/><circle cx="294" cy="212" r="18" fill="#343f42"/><path d="M282 252h24" stroke="#c0ad88" stroke-width="5"/>',
        f'<rect x="67" y="163" width="120" height="159" fill="#5d4935" stroke="#a88c62"/><path d="M67 198h120M67 238h120M67 278h120" stroke="#261e19"/><g fill="{paper}"><rect x="78" y="174" width="83" height="15"/><rect x="91" y="207" width="78" height="22"/><rect x="76" y="247" width="96" height="21"/><rect x="96" y="287" width="73" height="24"/></g><path d="M214 315v-94c0-36 27-58 58-58s58 22 58 58v94" fill="#202629" stroke="#89775d"/><path d="M247 315v-80h50v80" fill="#15191b"/>',
        f'<ellipse cx="201" cy="252" rx="137" ry="66" fill="#4d392d" stroke="#aa8b61" stroke-width="4"/><ellipse cx="201" cy="252" rx="88" ry="35" fill="#302822"/><g fill="#11161a" stroke="#a89170">' + ''.join(f'<circle cx="{93+i*36}" cy="{218+(i%2)*70}" r="14"/>' for i in range(7)) + f'</g><rect x="175" y="224" width="54" height="40" fill="{paper}" transform="rotate({angle} 202 244)"/><path d="M184 237h34M184 247h28" stroke="#635442"/>',
        f'<path d="M65 305h270v30H65Z" fill="#4a3729"/><rect x="87" y="164" width="102" height="132" fill="#242a2b" stroke="#a18d6d"/><circle cx="138" cy="218" r="37" fill="#171b1d" stroke="#c0ae87"/><path d="M138 218l22-19M105 265h66" stroke="{tint}" stroke-width="3"/><path d="M213 181h93v112h-93Z" fill="{paper}" stroke="#806d52"/><path d="M226 202h68M226 218h51M226 234h66M226 250h45" stroke="#5d503e"/><path d="M242 281q22-28 48-3" fill="none" stroke="{tint}" stroke-width="4"/>',
        f'<rect x="74" y="161" width="252" height="158" fill="#29272a" stroke="#8d765d"/><path d="M92 180h216v120H92Z" fill="#334344"/><path d="M111 281l37-46 31 19 40-58 68 85" fill="none" stroke="#b2bfa6" stroke-width="3"/><path d="M111 221h176M111 246h176" stroke="#768c87" opacity=".5"/><circle cx="219" cy="196" r="7" fill="{tint}"/><rect x="279" y="145" width="34" height="42" fill="{paper}" transform="rotate(8 296 166)"/>',
        f'<path d="M80 173h102v145H80Z" fill="#725738" stroke="#b39468"/><path d="M92 185h78v31H92Z" fill="{paper}"/><path d="M92 228h78v31H92Z" fill="#aa9673"/><path d="M92 271h78v31H92Z" fill="#8f7d62"/><path d="M217 171h105v149H217Z" fill="#20282b" stroke="#9c896d"/><path d="M234 197h71M234 218h51M234 239h66" stroke="#d0c19d"/><circle cx="271" cy="282" r="23" fill="none" stroke="{tint}" stroke-width="5"/><path d="M257 282l9 10 20-24" fill="none" stroke="{tint}" stroke-width="4"/>',
        f'<path d="M73 298h252l-31-109H104Z" fill="#4b382b" stroke="#aa8b63"/><rect x="120" y="176" width="162" height="102" fill="{paper}" transform="rotate({angle} 201 227)"/><path d="M143 198h109M143 215h91M143 232h116M143 249h72" stroke="#5f503d"/><path d="M85 178q21-28 43 0v84q-22 24-43 0Z" fill="#1b2224" stroke="#b5a17c"/><path d="M94 194h25M94 209h25" stroke="{tint}"/><path d="M294 185v92M281 199h26" stroke="#b89f78" stroke-width="5"/>',
        f'<path d="M67 318V170h258v148" fill="#262526" stroke="#8c765d"/><path d="M82 188h70v112H82ZM165 188h70v112h-70ZM248 188h61v112h-61Z" fill="#15191b" stroke="#625748"/><g fill="#b9aa8b"><circle cx="117" cy="217" r="17"/><circle cx="200" cy="217" r="17"/><circle cx="278" cy="217" r="17"/></g><path d="M98 277q19-55 38 0M181 277q19-55 38 0M260 277q18-55 36 0" fill="#343a3a" stroke="{tint}"/>',
        f'<path d="M52 312h296v30H52Z" fill="#503a2a"/><path d="M89 311v-76h95v76M216 311v-111h101v111" fill="#202628" stroke="#a28b68"/><path d="M107 253h59v41h-59Z" fill="{paper}"/><path d="M230 218h73v75h-73Z" fill="#151a1c"/><circle cx="267" cy="252" r="24" fill="none" stroke="#b8a681" stroke-width="3"/><path d="M267 252l15-12" stroke="{tint}" stroke-width="3"/><path d="M105 187q35-40 70 0" fill="none" stroke="#d2bc8b" stroke-width="5"/><path d="M140 187v47" stroke="#d2bc8b" stroke-width="4"/>',
    ]
    ax = 74 + ((number * 37) % 236); ay = 315 + ((number * 11) % 35)
    artifacts = [
        f'<path d="M-17 4q17-22 34 0M-12 4v12M12 4v12" fill="none" stroke="{paper}" stroke-width="4"/>',
        f'<rect x="-17" y="-12" width="34" height="25" fill="{paper}" stroke="#6f5b43"/><circle cx="-5" cy="-2" r="5" fill="{tint}"/><path d="M2 7l7-8 7 8" fill="none" stroke="#6f5b43"/>',
        f'<circle r="15" fill="none" stroke="{paper}" stroke-width="4"/><path d="M11 11l16 16" stroke="{paper}" stroke-width="5"/>',
        f'<circle cx="-8" r="9" fill="none" stroke="{paper}" stroke-width="3"/><circle cx="12" r="9" fill="none" stroke="{paper}" stroke-width="3"/><path d="M1 0h2M-17 0h-9M21 0h9" stroke="{paper}" stroke-width="3"/>',
        f'<path d="M-13-10h24v22h-24zM11-5h7v12h-7" fill="none" stroke="{paper}" stroke-width="3"/><path d="M-8-15q7-7 14 0" fill="none" stroke="{paper}"/>',
        f'<circle r="15" fill="none" stroke="{tint}" stroke-width="4"/><text x="0" y="5" text-anchor="middle" fill="{tint}" font-size="12" font-weight="700">M</text>',
        f'<path d="M-24 9L17-10M-20 14L21-5" stroke="{paper}" stroke-width="4"/><path d="M18-12l8-4-3 9z" fill="{tint}"/>',
        f'<path d="M-18 10h36v8h-36zM-12 10v-23h24v23" fill="{paper}" stroke="#6f5b43"/><path d="M-7-6h14M-7 0h10" stroke="#6f5b43"/>',
        f'<path d="M-20-8h40v24h-40z" fill="#5d4731" stroke="{paper}"/><path d="M-20-8h14l5-8h21" fill="none" stroke="{paper}" stroke-width="3"/>',
        f'<circle r="17" fill="#20272a" stroke="{paper}" stroke-width="3"/><path d="M0 0l9-8M0 0v-11" stroke="{tint}" stroke-width="3"/>',
    ]
    artifact = artifacts[(number // 12) % len(artifacts)]
    return common + scenes[variant] + f'<g transform="translate({ax} {ay}) rotate({angle})">{artifact}</g><g opacity=".35" transform="scale(.5) translate(310 325)">{motif(motif_id, 200, 250)}</g>'


def pips(level: int, tint: str) -> str:
    n = max(0, min(int(level or 0), 8))
    if n == 0:
        return ""
    parts = []
    x0 = 200 - (n * 9)
    for i in range(n):
        parts.append(f'<circle cx="{x0 + i * 18}" cy="78" r="5" fill="{tint}"/>')
    return "".join(parts)


def card_svg(card: dict) -> str:
    sid = series_key(card.get("series") or "")
    tint, label, motif_id = SERIES.get(sid, SERIES["Dosya"])
    kind = card.get("kind") or "unit"
    klabel, kcol = KIND.get(kind, KIND["unit"])
    cid = esc(card.get("id") or "")
    name = esc(card.get("name") or "")
    atk = card.get("attack")
    df = card.get("defense")
    stats = "—" if kind != "unit" else f"{atk if atk is not None else '—'} / {df if df is not None else '—'}"
    loc = card.get("deckLocation") or "main"
    level = int(card.get("level") or 0)
    heavy = 5 if loc == "auxiliary" or level >= 7 else 3 if level >= 5 else 2
    aux = ""
    if loc == "auxiliary":
        aux = f'<circle cx="338" cy="128" r="22" fill="none" stroke="#c4a574" stroke-width="3"/><text x="338" y="134" text-anchor="middle" fill="#c4a574" font-family="Georgia,serif" font-size="11">YD</text>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="400" height="560">
<defs><clipPath id="scene"><rect x="36" y="118" width="328" height="268"/></clipPath></defs>
<rect width="400" height="560" fill="#141c28"/>
<rect x="10" y="10" width="380" height="540" fill="#1a2433" stroke="{tint}" stroke-width="{heavy}"/>
<rect x="10" y="10" width="380" height="18" fill="{tint}"/>
<text x="24" y="54" fill="{kcol}" font-family="ui-monospace,monospace" font-size="13" letter-spacing="2">{klabel}</text>
<text x="376" y="54" text-anchor="end" fill="#8a93a3" font-family="ui-monospace,monospace" font-size="13">{esc(label)}</text>
<text x="200" y="96" text-anchor="middle" fill="#e8dcc4" font-family="Georgia,serif" font-size="22">{cid}</text>
{pips(level, tint)}
<rect x="36" y="118" width="328" height="268" fill="#243044" stroke="#2e3d52" stroke-width="1"/>
<g clip-path="url(#scene)">{scene(card, motif_id, tint)}</g>
{aux}
<text x="200" y="430" text-anchor="middle" fill="#e8dcc4" font-family="Georgia,serif" font-size="20">{name}</text>
<text x="200" y="462" text-anchor="middle" fill="#c4a574" font-family="ui-monospace,monospace" font-size="13">{esc(sid.upper())}</text>
<rect x="36" y="484" width="328" height="44" fill="#121820"/>
<text x="200" y="514" text-anchor="middle" fill="#e8dcc4" font-family="ui-monospace,monospace" font-size="22">{stats}</text>
</svg>
'''


def main() -> None:
    cards = json.loads(SRC.read_text())
    OUT_SVG.mkdir(parents=True, exist_ok=True)
    entries = {}
    sizes = []
    hashes = []
    for c in cards:
        cid = c["id"]
        target = OUT_SVG / f"{cid}.svg"
        target.write_text(card_svg(c), encoding="utf-8")
        data = target.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        sizes.append(len(data)); hashes.append(digest)
        entries[cid] = {"path": f"/games/darbe-h/assets/cards/{cid}.svg", "width": 400, "height": 560, "bytes": len(data), "sha256": digest}
    ordered = sorted(sizes)
    manifest = {"summary": {"coverage": len(cards), "totalBytes": sum(sizes), "averageBytes": round(sum(sizes) / len(sizes)), "p95Bytes": ordered[max(0, int(len(ordered) * .95) - 1)], "maxBytes": max(sizes), "duplicateHashes": len(hashes) - len(set(hashes)), "dimensions": [400, 560], "kind": "svg"}, "cards": entries}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(cards)} svg -> {OUT_SVG}")


if __name__ == "__main__":
    main()
