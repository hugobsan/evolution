#!/usr/bin/env python3
"""Converte o dump XML do SWF (gerado uma única vez pelo JPEXS FFDec, só em build)
em public/assets/swf.json + bitmaps/sons, consumidos pelo motor TS em runtime.

Uso: python3 tools/extract.py extracted/swf.xml extracted public/assets
"""
import json
import os
import shutil
import sys
import xml.etree.ElementTree as ET

TW = 20.0


def num(v, d=0.0):
    return float(v) if v is not None else d


def fmt(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def matrix(el, scale_all=False):
    """SWF MATRIX -> [a,b,c,d,tx,ty] em pixels."""
    if el is None:
        return [1, 0, 0, 1, 0, 0]
    a = num(el.get('scaleX'), 1.0) if el.get('hasScale') == 'true' else 1.0
    d = num(el.get('scaleY'), 1.0) if el.get('hasScale') == 'true' else 1.0
    b = num(el.get('rotateSkew0')) if el.get('hasRotate') == 'true' else 0.0
    c = num(el.get('rotateSkew1')) if el.get('hasRotate') == 'true' else 0.0
    tx = num(el.get('translateX')) / TW
    ty = num(el.get('translateY')) / TW
    if scale_all:
        a, b, c, d = a / TW, b / TW, c / TW, d / TW
    return [round(a, 6), round(b, 6), round(c, 6), round(d, 6), round(tx, 3), round(ty, 3)]


def rgba(el):
    if el is None:
        return [0, 0, 0, 255]
    return [int(el.get('red', 0)), int(el.get('green', 0)), int(el.get('blue', 0)), int(el.get('alpha', 255))]


def cxform(el):
    """CXFORM -> [rm,gm,bm,am,ra,ga,ba,aa] (mult 0..1, add -255..255) ou None."""
    if el is None:
        return None
    m = [1.0, 1.0, 1.0, 1.0]
    a = [0, 0, 0, 0]
    if el.get('hasMultTerms') == 'true':
        m = [num(el.get(k + 'MultTerm'), 256) / 256 for k in ('red', 'green', 'blue', 'alpha')]
    if el.get('hasAddTerms') == 'true':
        a = [int(num(el.get(k + 'AddTerm'))) for k in ('red', 'green', 'blue', 'alpha')]
    if m == [1.0, 1.0, 1.0, 1.0] and a == [0, 0, 0, 0]:
        return None
    return [round(x, 4) for x in m] + a


def rect(el):
    return [num(el.get('Xmin')) / TW, num(el.get('Ymin')) / TW, num(el.get('Xmax')) / TW, num(el.get('Ymax')) / TW]


def items(el):
    return [] if el is None else list(el)


# ---------------------------------------------------------------- shapes

def fill_style(fs):
    t = int(fs.get('fillStyleType'))
    if t == 0:
        return {'t': 0, 'c': rgba(fs.find('color'))}
    if t in (16, 18, 19):
        g = fs.find('gradient')
        stops = [[int(r.get('ratio')) / 255] + rgba(r.find('color')) for r in items(g.find('gradientRecords'))]
        out = {'t': t, 'm': matrix(fs.find('gradientMatrix')), 's': stops}
        if t == 19:
            out['fp'] = num(g.get('focalPoint'))
        return out
    if t in (64, 65, 66, 67):
        bid = int(fs.get('bitmapId'))
        if bid == 65535:
            return None
        return {'t': t, 'b': bid, 'm': matrix(fs.find('bitmapMatrix'), scale_all=True)}
    return None


def line_style(ls):
    w = num(ls.get('width')) / TW
    if ls.get('hasFillFlag') == 'true':
        f = fill_style(ls.find('fillType'))
        c = f['c'] if f and f['t'] == 0 else [0, 0, 0, 255]
    else:
        c = rgba(ls.find('color'))
    o = {'w': w, 'c': c}
    if ls.get('noHScaleFlag') == 'true' or ls.get('noVScaleFlag') == 'true':
        o['ns'] = 1  # traço que não escala com o objeto
    return o


def styles_of(container):
    fills = [fill_style(f) for f in items(container.find('fillStyles/fillStyles'))] if container.find('fillStyles') is not None else []
    lsel = container.find('lineStyles')
    lines = []
    if lsel is not None:
        for sub in lsel:
            lines += [line_style(l) for l in items(sub)]
    return fills, lines


def path_from_edges(edges, close):
    """edges: lista de (x0,y0,x1,y1,cx,cy|None). Encadeia em subpaths."""
    out = []
    if close:
        # encadeia por ponto inicial
        by_start = {}
        for i, e in enumerate(edges):
            by_start.setdefault((round(e[0], 3), round(e[1], 3)), []).append(i)
        used = [False] * len(edges)
        for i in range(len(edges)):
            if used[i]:
                continue
            used[i] = True
            e = edges[i]
            sx, sy = e[0], e[1]
            seg = ['M', fmt(e[0]), fmt(e[1])]
            cur = e
            while True:
                if cur[4] is None:
                    seg += ['L', fmt(cur[2]), fmt(cur[3])]
                else:
                    seg += ['Q', fmt(cur[4]), fmt(cur[5]), fmt(cur[2]), fmt(cur[3])]
                key = (round(cur[2], 3), round(cur[3], 3))
                if key == (round(sx, 3), round(sy, 3)):
                    break
                nxt = None
                for j in by_start.get(key, []):
                    if not used[j]:
                        nxt = j
                        break
                if nxt is None:
                    break
                used[nxt] = True
                cur = edges[nxt]
            seg.append('Z')
            out += seg
    else:
        lx = ly = None
        for e in edges:
            if lx is None or abs(e[0] - lx) > 1e-6 or abs(e[1] - ly) > 1e-6:
                out += ['M', fmt(e[0]), fmt(e[1])]
            if e[4] is None:
                out += ['L', fmt(e[2]), fmt(e[3])]
            else:
                out += ['Q', fmt(e[4]), fmt(e[5]), fmt(e[2]), fmt(e[3])]
            lx, ly = e[2], e[3]
    return ' '.join(out)


def convert_records(records, fills, lines):
    """Converte shapeRecords em camadas [{f:fill,d} | {l:line,d}] na ordem de desenho do Flash."""
    layers = []
    x = y = 0.0
    f0 = f1 = ln = 0
    fill_edges = {}
    line_edges = {}

    def flush():
        for idx in sorted(fill_edges):
            st = fills[idx - 1] if 0 < idx <= len(fills) else None
            if st is not None and fill_edges[idx]:
                layers.append({'f': st, 'd': path_from_edges(fill_edges[idx], True)})
        for idx in sorted(line_edges):
            st = lines[idx - 1] if 0 < idx <= len(lines) else None
            if st is not None and line_edges[idx]:
                layers.append({'l': st, 'd': path_from_edges(line_edges[idx], False)})
        fill_edges.clear()
        line_edges.clear()

    def add(e):
        if f1:
            fill_edges.setdefault(f1, []).append(e)
        if f0:
            r = (e[2], e[3], e[0], e[1], e[4], e[5])
            fill_edges.setdefault(f0, []).append(r)
        if ln:
            line_edges.setdefault(ln, []).append(e)

    for r in records:
        t = r.get('type')
        if t == 'StyleChangeRecord':
            if r.get('stateNewStyles') == 'true':
                flush()
                fills, lines = styles_of(r)
                f0 = f1 = ln = 0
            if r.get('stateMoveTo') == 'true':
                x = num(r.get('moveDeltaX')) / TW
                y = num(r.get('moveDeltaY')) / TW
            if r.get('stateFillStyle0') == 'true':
                f0 = int(r.get('fillStyle0'))
            if r.get('stateFillStyle1') == 'true':
                f1 = int(r.get('fillStyle1'))
            if r.get('stateLineStyle') == 'true':
                ln = int(r.get('lineStyle'))
        elif t == 'StraightEdgeRecord':
            if r.get('generalLineFlag') == 'true':
                dx, dy = num(r.get('deltaX')), num(r.get('deltaY'))
            elif r.get('vertLineFlag') == 'true':
                dx, dy = 0.0, num(r.get('deltaY'))
            else:
                dx, dy = num(r.get('deltaX')), 0.0
            nx, ny = x + dx / TW, y + dy / TW
            add((x, y, nx, ny, None, None))
            x, y = nx, ny
        elif t == 'CurvedEdgeRecord':
            cx = x + num(r.get('controlDeltaX')) / TW
            cy = y + num(r.get('controlDeltaY')) / TW
            nx = cx + num(r.get('anchorDeltaX')) / TW
            ny = cy + num(r.get('anchorDeltaY')) / TW
            add((x, y, nx, ny, cx, cy))
            x, y = nx, ny
    flush()
    return layers


def convert_shape(tag):
    sh = tag.find('shapes')
    fills, lines = styles_of(sh)
    layers = convert_records(items(sh.find('shapeRecords')), fills, lines)
    return {'type': 'shape', 'bounds': rect(tag.find('shapeBounds')), 'layers': layers}


def glyph_path(shape_el):
    layers = convert_records(items(shape_el.find('shapeRecords')), [{'t': 0, 'c': [0, 0, 0, 255]}], [])
    return ' '.join(l['d'] for l in layers if 'f' in l)


# ---------------------------------------------------------------- display list

def filters(el):
    out = []
    for f in items(el):
        t = f.get('type')
        if t == 'DROPSHADOWFILTER':
            out.append({'t': 'shadow', 'c': rgba(f.find('dropShadowColor')), 'bx': num(f.get('blurX')), 'by': num(f.get('blurY')),
                        'a': num(f.get('angle')), 'd': num(f.get('distance')), 's': num(f.get('strength'), 1), 'in': f.get('innerShadow') == 'true',
                        'ko': f.get('knockout') == 'true'})
        elif t == 'GLOWFILTER':
            out.append({'t': 'glow', 'c': rgba(f.find('glowColor')), 'bx': num(f.get('blurX')), 'by': num(f.get('blurY')),
                        's': num(f.get('strength'), 1), 'in': f.get('innerGlow') == 'true', 'ko': f.get('knockout') == 'true'})
    return out


def place(tag):
    p = {}
    if tag.get('placeFlagHasCharacter') == 'true':
        p['c'] = int(tag.get('characterId'))
    if tag.get('placeFlagMove') == 'true':
        p['mv'] = 1
    if tag.get('placeFlagHasMatrix') == 'true':
        p['m'] = matrix(tag.find('matrix'))
    if tag.get('placeFlagHasColorTransform') == 'true':
        p['cx'] = cxform(tag.find('colorTransform')) or [1, 1, 1, 1, 0, 0, 0, 0]
    if tag.get('placeFlagHasName') == 'true':
        p['n'] = tag.get('name')
    if tag.get('placeFlagHasClipDepth') == 'true':
        p['cd'] = int(tag.get('clipDepth'))
    if tag.get('placeFlagHasRatio') == 'true':
        p['r'] = int(tag.get('ratio'))
    if tag.get('placeFlagHasFilterList') == 'true':
        p['f'] = filters(tag.find('surfaceFilterList'))
    if tag.get('placeFlagHasBlendMode') == 'true':
        p['bm'] = int(tag.get('blendMode'))
    if tag.get('placeFlagHasVisible') == 'true':
        p['v'] = int(tag.get('visible', 1))
    return p


def timeline(subtags):
    frames = [[]]
    labels = {}
    for t in subtags:
        ty = t.get('type')
        cur = frames[-1]
        if ty in ('PlaceObject2Tag', 'PlaceObject3Tag'):
            cur.append(['p', int(t.get('depth')), place(t)])
        elif ty == 'PlaceObjectTag':
            cur.append(['p', int(t.get('depth')), {'c': int(t.get('characterId')), 'm': matrix(t.find('matrix'))}])
        elif ty in ('RemoveObject2Tag', 'RemoveObjectTag'):
            cur.append(['r', int(t.get('depth'))])
        elif ty == 'StartSoundTag':
            si = t.find('soundInfo')
            cur.append(['s', int(t.get('soundId')), 1 if si is not None and si.get('syncStop') == 'true' else 0])
        elif ty == 'FrameLabelTag':
            labels[t.get('name')] = len(frames)
        elif ty == 'ShowFrameTag':
            frames.append([])
    if not frames[-1]:
        frames.pop()
    return {'frames': frames, 'labels': labels}


# ---------------------------------------------------------------- texts

def edit_text(t):
    g = t.get
    o = {
        'type': 'edittext', 'bounds': rect(t.find('bounds')),
        'var': g('variableName') or '', 'html': g('html') == 'true',
        'text': g('initialText') if g('hasText') == 'true' else '',
        'multiline': g('multiline') == 'true', 'wordWrap': g('wordWrap') == 'true',
        'readOnly': g('readOnly') == 'true', 'noSelect': g('noSelect') == 'true',
        'border': g('border') == 'true', 'autoSize': g('autoSize') == 'true',
        'outlines': g('useOutlines') == 'true', 'password': g('password') == 'true',
    }
    if g('hasFont') == 'true':
        o['font'] = int(g('fontId'))
        o['size'] = num(g('fontHeight')) / TW
    if g('hasTextColor') == 'true':
        o['color'] = rgba(t.find('textColor'))
    if g('hasMaxLength') == 'true':
        o['maxLength'] = int(g('maxLength'))
    if g('hasLayout') == 'true':
        o['align'] = int(g('align'))
        o['leftMargin'] = num(g('leftMargin')) / TW
        o['rightMargin'] = num(g('rightMargin')) / TW
        o['indent'] = num(g('indent')) / TW
        o['leading'] = num(g('leading')) / TW
    return o


def static_text(t):
    recs = []
    font = None
    color = [0, 0, 0, 255]
    h = 12
    x = y = 0.0
    for r in items(t.find('textRecords')):
        if r.get('styleFlagsHasFont') == 'true':
            font = int(r.get('fontId'))
            h = num(r.get('textHeight')) / TW
        if r.get('styleFlagsHasColor') == 'true':
            color = rgba(r.find('textColor'))
        if r.get('styleFlagsHasXOffset') == 'true':
            x = num(r.get('xOffset')) / TW
        if r.get('styleFlagsHasYOffset') == 'true':
            y = num(r.get('yOffset')) / TW
        glyphs = [[int(gl.get('glyphIndex')), num(gl.get('glyphAdvance')) / TW] for gl in items(r.find('glyphEntries'))]
        recs.append({'font': font, 'h': h, 'c': color, 'x': x, 'y': y, 'g': glyphs})
        x += sum(gl[1] for gl in glyphs)
    return {'type': 'text', 'bounds': rect(t.find('textBounds')), 'm': matrix(t.find('textMatrix')), 'recs': recs}


def font(t):
    glyphs = [glyph_path(s) for s in items(t.find('glyphShapeTable'))]
    codes = [int(c.text) for c in items(t.find('codeTable'))]
    adv = [num(a.text) / TW for a in items(t.find('fontAdvanceTable'))]
    name = (t.get('fontName') or '').replace('\\u0000', '').replace('\x00', '')
    o = {'type': 'font', 'name': name, 'glyphs': glyphs, 'codes': codes, 'adv': adv,
         'bold': t.get('fontFlagsBold') == 'true', 'italic': t.get('fontFlagsItalic') == 'true'}
    if t.get('fontAscent') is not None:
        o['ascent'] = num(t.get('fontAscent')) / TW
        o['descent'] = num(t.get('fontDescent')) / TW
        o['leading'] = num(t.get('fontLeading')) / TW
    return o


def button(t):
    recs = []
    for r in items(t.find('characters')):
        states = ''.join(k for k, f in (('u', 'buttonStateUp'), ('o', 'buttonStateOver'), ('d', 'buttonStateDown'), ('h', 'buttonStateHitTest'))
                         if r.get(f) == 'true')
        recs.append({'s': states, 'c': int(r.get('characterId')), 'depth': int(r.get('placeDepth')),
                     'm': matrix(r.find('placeMatrix')), 'cx': cxform(r.find('colorTransform'))})
    return {'type': 'button', 'recs': recs}


# ---------------------------------------------------------------- main

def main(xml_path, extracted_dir, out_dir):
    root = ET.parse(xml_path).getroot()
    tags = root.find('tags')
    chars = {}
    exports = {}
    grids = {}
    for t in tags:
        ty = t.get('type')
        if ty in ('DefineShapeTag', 'DefineShape2Tag', 'DefineShape3Tag', 'DefineShape4Tag'):
            chars[int(t.get('shapeId'))] = convert_shape(t)
        elif ty == 'DefineSpriteTag':
            d = timeline(items(t.find('subTags')))
            d['type'] = 'sprite'
            d['count'] = int(t.get('frameCount'))
            chars[int(t.get('spriteId'))] = d
        elif ty == 'DefineEditTextTag':
            chars[int(t.get('characterID'))] = edit_text(t)
        elif ty in ('DefineTextTag', 'DefineText2Tag'):
            chars[int(t.get('characterID'))] = static_text(t)
        elif ty in ('DefineFont2Tag', 'DefineFont3Tag'):
            chars[int(t.get('fontID'))] = font(t)
        elif ty == 'DefineButton2Tag':
            chars[int(t.get('buttonId'))] = button(t)
        elif ty in ('DefineBitsJPEG2Tag', 'DefineBitsJPEG3Tag', 'DefineBitsLossless2Tag', 'DefineBitsLosslessTag', 'DefineBitsTag'):
            chars[int(t.get('characterID'))] = {'type': 'bitmap'}
        elif ty == 'DefineSoundTag':
            chars[int(t.get('soundId'))] = {'type': 'sound'}
        elif ty == 'DefineScalingGridTag':
            grids[int(t.get('characterId'))] = rect(t.find('splitter'))
        elif ty == 'ExportAssetsTag':
            for cid, name in zip(items(t.find('tags')), items(t.find('names'))):
                exports[name.text] = int(cid.text)
    main_tl = timeline([t for t in tags])
    for cid, g in grids.items():
        chars[cid]['grid'] = g

    os.makedirs(os.path.join(out_dir, 'img'), exist_ok=True)
    os.makedirs(os.path.join(out_dir, 'snd'), exist_ok=True)
    for fn in os.listdir(os.path.join(extracted_dir, 'images')):
        cid = int(fn.split('.')[0].split('_')[0])
        if cid in chars:
            shutil.copy(os.path.join(extracted_dir, 'images', fn), os.path.join(out_dir, 'img', fn))
            chars[cid]['src'] = 'img/' + fn
    for fn in os.listdir(os.path.join(extracted_dir, 'sounds')):
        try:
            cid = int(fn.split('.')[0].split('_')[0])
        except ValueError:
            continue
        if cid in chars:
            ext = fn.rsplit('.', 1)[1]
            shutil.copy(os.path.join(extracted_dir, 'sounds', fn), os.path.join(out_dir, 'snd', '%d.%s' % (cid, ext)))
            chars[cid]['src'] = 'snd/%d.%s' % (cid, ext)

    hdr = root.attrib
    data = {
        'width': 640, 'height': 480, 'frameRate': num(hdr.get('frameRate'), 30),
        'chars': {str(k): v for k, v in chars.items()},
        'exports': exports, 'root': main_tl,
    }
    with open(os.path.join(out_dir, 'swf.json'), 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print('chars', len(chars), 'exports', len(exports), 'root frames', len(main_tl['frames']))


if __name__ == '__main__':
    main(*sys.argv[1:4])
