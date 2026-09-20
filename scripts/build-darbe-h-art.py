#!/usr/bin/env python3
"""DARBE-H! crisis-desk SVG batch. Identity: telex / dossier / stamp. No mechanics."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/games/darbe-h/source-cards.json"
OUT_SVG = ROOT / "public/games/darbe-h/assets/cards"

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
<rect width="400" height="560" fill="#141c28"/>
<rect x="10" y="10" width="380" height="540" fill="#1a2433" stroke="{tint}" stroke-width="{heavy}"/>
<rect x="10" y="10" width="380" height="18" fill="{tint}"/>
<text x="24" y="54" fill="{kcol}" font-family="ui-monospace,monospace" font-size="13" letter-spacing="2">{klabel}</text>
<text x="376" y="54" text-anchor="end" fill="#8a93a3" font-family="ui-monospace,monospace" font-size="13">{esc(label)}</text>
<text x="200" y="96" text-anchor="middle" fill="#e8dcc4" font-family="Georgia,serif" font-size="22">{cid}</text>
{pips(level, tint)}
<rect x="36" y="118" width="328" height="268" fill="#243044" stroke="#2e3d52" stroke-width="1"/>
{motif(motif_id)}
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
    for c in cards:
        cid = c["id"]
        (OUT_SVG / f"{cid}.svg").write_text(card_svg(c), encoding="utf-8")
    print(f"wrote {len(cards)} svg -> {OUT_SVG}")


if __name__ == "__main__":
    main()
