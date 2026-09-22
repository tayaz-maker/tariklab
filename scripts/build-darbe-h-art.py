#!/usr/bin/env python3
"""Package original editorial scene plates into DARBE's existing SVG contract.

No runtime generation, remote assets, or game-data mutation. The sixty authored
noir plates are retained locally; five deterministic camera editions cover all
300 IDs. SVG is a transport/frame, not a procedural scene generator. Names,
series, kind and tier remain sourced from the unchanged card catalogue.
"""
from __future__ import annotations
import base64
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'public/games/darbe-h/source-cards.json'
ASSETS = ROOT / 'public/games/darbe-h/assets'
OUT_SVG = ASSETS / 'cards'
MANIFEST = ASSETS / 'art-manifest.json'
SCENES = [
 'evidence-desk', 'command-room', 'ministry-corridor', 'archive-aisle', 'telex-macro', 'radio-console',
 'committee-table', 'sealed-envelope', 'typewriter-carriage', 'map-table', 'filing-drawer', 'doorway',
 'waiting-room', 'operational-board', 'blind-shadow', 'vaulted-records', 'after-hours-office', 'red-lamp',
 'spiral-stairwell', 'glass-partition', 'radio-mast', 'projector-beam', 'dispatch-case', 'press-lectern',
 'switchboard-room', 'rain-window', 'wax-seal', 'pneumatic-dispatch', 'library-ladder', 'printing-press',
 'broken-telephone', 'mail-cubbies', 'steel-safe', 'tape-recorder', 'redacted-folder', 'chamber-balcony',
 'door-gap', 'basement', 'clockwork', 'sealed-cases', 'vehicle-hatch', 'checkpoint',
 'map-fragments', 'under-desk', 'pipe-tunnel', 'microphone', 'fenced-board', 'fan-switchboard',
 'scales', 'stair-landing', 'monitors', 'empty-coat', 'floor-lamp-map', 'frosted-council',
 'ink-spill', 'car-interior', 'train-compartment', 'stone-entrance', 'carbon-paper', 'daylit-records',
]
CAMERAS = [(0, 0, 400, 560), (-22, -18, 446, 606), (-42, -28, 454, 620), (-8, -45, 434, 630), (-18, -8, 438, 590)]
INK = {'unit':'#aa9164', 'spell':'#6f998d', 'trap':'#b37870'}
KIND = {'unit':'GÖREVLİ', 'spell':'EMİRNAME', 'trap':'İHTAR'}

def series_key(raw: str) -> str:
    return (raw.split('—')[-1] if raw else 'Dosya').strip()

def card_svg(card: dict) -> str:
    cid = card['id']; n = int(cid.split('-')[-1]) - 1
    edition = n // len(SCENES); scene = (n + edition * 17) % len(SCENES)
    plate = ASSETS / 'plates' / f'scene-{scene+1:02d}.webp'
    encoded = base64.b64encode(plate.read_bytes()).decode('ascii')
    sid = series_key(card.get('series', '')); kind = card['kind']
    level = int(card.get('level') or 0); aux = card.get('deckLocation') == 'auxiliary'
    tier = 'aux' if aux else 'high' if level >= 7 else 'mid' if level >= 5 else 'low'
    x, y, w, h = CAMERAS[edition]
    colour = INK[kind]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="400" height="560">
<title>{html.escape(card['name'])} · {html.escape(sid)} · {cid}</title>
<desc>Original fictional editorial illustration: {SCENES[scene]}. Not historical evidence.</desc>
<defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#07100e" stop-opacity=".05"/><stop offset=".72" stop-color="#07100e" stop-opacity="0"/><stop offset="1" stop-color="#07100e" stop-opacity=".92"/></linearGradient></defs>
<rect width="400" height="560" fill="#0c1410"/>
<g data-series="{html.escape(sid)}" data-kind="{kind}" data-subtype="{html.escape(card.get('subtype') or 'normal')}" data-tier="{tier}" data-aux="{int(aux)}" data-scene="{SCENES[scene]}" data-edition="{edition}" data-card="{cid}">
<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice" href="data:image/webp;base64,{encoded}"/>
<rect width="400" height="560" fill="url(#shade)"/>
<path d="M18 18H54M18 18V54M382 18H346M382 18V54" fill="none" stroke="{colour}" stroke-opacity=".62"/>
<path d="M20 511H380" stroke="{colour}" stroke-opacity=".6"/>
<text x="21" y="536" fill="#e5d7b8" font-family="Georgia,serif" font-size="15" letter-spacing="1.3">{html.escape(sid.upper())}</text>
<text x="379" y="536" text-anchor="end" fill="{colour}" font-family="monospace" font-size="11">{cid} · {KIND[kind]}</text>
<!--well-end--></g></svg>
'''

def main() -> None:
    cards = json.loads(SRC.read_text())
    assert len(cards) == 300 and len(SCENES) == 60
    OUT_SVG.mkdir(parents=True, exist_ok=True)
    entries = {}; hashes = []; sizes = []
    for card in cards:
        cid = card['id']; svg = card_svg(card); data = svg.encode()
        (OUT_SVG / f'{cid}.svg').write_bytes(data)
        digest = hashlib.sha256(data).hexdigest(); hashes.append(digest); sizes.append(len(data))
        entries[cid] = {'path':f'/games/darbe-h/assets/cards/{cid}.svg','width':400,'height':560,'bytes':len(data),'sha256':digest}
    ordered = sorted(sizes)
    summary = {'coverage':len(cards),'totalBytes':sum(sizes),'averageBytes':round(sum(sizes)/len(sizes)),
       'p95Bytes':ordered[int(len(ordered)*.95)-1],'maxBytes':max(sizes),
       'duplicateHashes':len(hashes)-len(set(hashes)),'duplicateWells':len(hashes)-len(set(hashes)),
       'dimensions':[400,560],'kind':'svg'}
    MANIFEST.write_text(json.dumps({'summary':summary,'cards':entries},ensure_ascii=False,indent=2)+'\n')
    print(f'Packaged {len(cards)} cards / {len(SCENES)} original scene plates / {sum(sizes):,} bytes')

if __name__ == '__main__':
    main()
