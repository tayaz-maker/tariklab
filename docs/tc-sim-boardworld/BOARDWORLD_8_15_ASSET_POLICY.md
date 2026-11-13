# Boardworld 8.15 asset budget decision

Production keeps the Gold runtime and the opt-in expansion on separate module
boundaries. Expansion modules import the same Gold engine instance; they must
not bundle a second copy. The initial static import graph must not request an
expansion module. Locale files remain deferred as before.

Gzip measurements are the sum of the individually gzipped emitted assets,
including HTML, CSS, SVG and all module files. Gold consists of every asset
except the `expansion*.mjs` modules. Expansion is the sum of those modules;
combined is Gold plus expansion. Initial Turkish excludes both deferred locale
and expansion files. No emitted file is omitted from the combined total.

The existing Gold ceilings remain 301,836 bytes total and 205,874 bytes
initial. The first passing partitioned build measured 40,217 deferred bytes;
its ceiling is frozen at 40,217, compared with the 37,528-byte increment implied by the original
339,364-byte combined reference and the Gold ceiling. The combined ceiling is
342,048 bytes, that measured reference total and the sum of its Gold output
(301,831) and expansion output. This is 2,684 bytes (0.79%) above the original
combined reference, reflecting the independently compressed module boundaries
and explicit loading/recovery code. Later reductions do not increase either
ceiling. All emitted files are counted. The package test
checks each ceiling and the partition sum independently.
