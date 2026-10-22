export const archivedGameSlugs = ['tc-sim-devlet', 'kayip-telefon', 'son-100-gun', 'veto-h', 'gett-oh', 'satranc', 'amiral-batti', 'peg-solitaire', 'labirent'];
/** @param {string} pathname */
export function archivedPath(pathname) {
  return archivedGameSlugs.some(slug => pathname === `/oyna/${slug}` || pathname === `/oyna/${slug}/` || pathname === `/games/${slug}` || pathname.startsWith(`/games/${slug}/`));
}
