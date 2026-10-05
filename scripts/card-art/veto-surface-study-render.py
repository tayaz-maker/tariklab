"""Rasterize the authored SVG with system librsvg/Cairo; no downloaded input.

This renders review files only. PNG and WebP outputs are not production assets.
"""
import ctypes as C
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/card-realism/veto-surface-study'
rsvg = C.CDLL('librsvg-2.so.2')
cairo = C.CDLL('libcairo.so.2')
gobject = C.CDLL('libgobject-2.0.so.0')

class Rectangle(C.Structure):
    _fields_ = [('x', C.c_double), ('y', C.c_double),
                ('width', C.c_double), ('height', C.c_double)]

rsvg.rsvg_handle_new_from_file.argtypes = [C.c_char_p, C.c_void_p]
rsvg.rsvg_handle_new_from_file.restype = C.c_void_p
rsvg.rsvg_handle_render_document.argtypes = [C.c_void_p, C.c_void_p, C.POINTER(Rectangle), C.c_void_p]
rsvg.rsvg_handle_render_document.restype = C.c_int
cairo.cairo_image_surface_create.argtypes = [C.c_int, C.c_int, C.c_int]
cairo.cairo_image_surface_create.restype = C.c_void_p
cairo.cairo_create.argtypes = [C.c_void_p]
cairo.cairo_create.restype = C.c_void_p
cairo.cairo_surface_write_to_png.argtypes = [C.c_void_p, C.c_char_p]
cairo.cairo_surface_write_to_png.restype = C.c_int
cairo.cairo_destroy.argtypes = [C.c_void_p]
cairo.cairo_surface_destroy.argtypes = [C.c_void_p]
gobject.g_object_unref.argtypes = [C.c_void_p]

handle = rsvg.rsvg_handle_new_from_file(bytes(OUT/'SND-001-study.svg'), None)
if not handle:
    raise RuntimeError('librsvg did not parse authored SVG')
try:
    for width in (1152, 576, 288, 192):
        height = width * 2 // 3
        surface = cairo.cairo_image_surface_create(0, width, height)
        ctx = cairo.cairo_create(surface)
        try:
            if not rsvg.rsvg_handle_render_document(handle, ctx, C.byref(Rectangle(0,0,width,height)), None):
                raise RuntimeError('librsvg render failed')
            dest = OUT / f'SND-001-{width}.png'
            if cairo.cairo_surface_write_to_png(surface, bytes(dest)) != 0:
                raise RuntimeError('Cairo PNG write failed')
            if width == 576:
                Image.open(dest).convert('RGB').save(OUT/'SND-001-review.webp', quality=90, method=6)
        finally:
            cairo.cairo_destroy(ctx)
            cairo.cairo_surface_destroy(surface)
finally:
    gobject.g_object_unref(handle)
print('Rendered original SVG at 1152, 576, 288, 192 px; review WebP at quality 90.')
