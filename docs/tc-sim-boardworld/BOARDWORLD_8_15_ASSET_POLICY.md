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

## User-authorized budget override — 2026-11-14

The user explicitly approved controlled expansion headroom for the existing
Living Cities & Underworld mission. This replaces the old expansion and combined
ceilings; it does not authorize increasing Gold or initial-load budgets.

| Measured gzip boundary | Previous limit (bytes) | Current required limit (bytes) |
| --- | ---: | ---: |
| Gold aggregate | 301,836 | 301,836 (unchanged) |
| Initial Turkish load | 205,874 | 205,874 (unchanged) |
| Optional expansion | 40,217 | 96,000 |
| Combined emitted package | 342,048 | 400,000 |

Only the two authorized size thresholds change in
`scripts/boardworld-build-assets.test.mjs`. Measurement, all emitted assets and
forwarders, partition sums, every functional assertion, the initial static graph,
preview isolation, source/packed replay and mixed-core rejection remain checked.
The initial graph cannot download optional city/organization/legal modules.
The expansion must share the existing Gold engine instance. No content is moved
into Gold to hide its size. Continue measuring complete emitted output after
meaningful integration batches so new systems stay within the running budget.

The earlier 40,217/342,048 policy was based on the first partitioned reference.
Old failed test reports retain those historical limits and failures; the explicit
user override supersedes their release-blocking size conclusion, not their
functional evidence. A passing updated package gate is not final feature or
production acceptance. One final PR, protected merge and Cloudflare Git production
release still require the complete candidate and all mandatory checks.

The UX/depth candidate may combine the six activated expansion modules into a
content-hashed `expansion-runtime-*.mjs`, retaining stable forwarding modules.
The hashed module and every forwarder count toward the existing deferred and
combined ceilings. Preview and persistence remain separate, and opening an
opt-in explanation cannot import the simulation bundle. Gold and expansion
continue to share one engine instance; a cached mismatched core fails safely.
