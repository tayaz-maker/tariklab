/**
 * Card-art release pointer. A theme switches to new art only as one atomic,
 * fully accepted 300/300 release; until then the production art stays live
 * (code-drawn VETO/GETT WebP, DARBE SVG) and no deck ever mixes old and new.
 *
 * Release files live under an immutable, content-addressed directory
 * (/games/<theme>/assets/card-art-releases/<id>/<CARD>.webp, id = hash of all
 * 300 file hashes), so a URL never changes bytes: the service worker's
 * per-URL cache cannot serve an old image for new art or vice versa, and an
 * offline client running a cached module keeps resolving the URLs it cached.
 *
 * Only scripts/card-art-gate/release.mjs writes the entries below, after the
 * 300/300 gate and a human visual-QA sign-off. Card data, saves and rules
 * never reference these paths; saves store card ids only.
 */
export const RELEASE_CARD_COUNT = 300;

export const ART_RELEASES = Object.freeze({
  "veto-h": null,
  "gett-oh": null,
  "darbe-h": null,
});

const RELEASE_ID = /^r[0-9a-f]{12}$/;

export function acceptedRelease(theme, releases = ART_RELEASES) {
  const release = Object.prototype.hasOwnProperty.call(releases, theme) ? releases[theme] : null;
  if (!release) return null;
  if (
    release.status !== "accepted" ||
    release.count !== RELEASE_CARD_COUNT ||
    !RELEASE_ID.test(release.id) ||
    release.kind !== "webp" ||
    !(release.width > 0 && release.height > 0)
  ) {
    return null;
  }
  return release;
}

export function releaseCardPath(theme, releaseId, cardId) {
  return `/games/${theme}/assets/card-art-releases/${releaseId}/${cardId}.webp`;
}

/** Production art: what every theme shows until its release is accepted. */
export function legacyCardArt(theme, card, art) {
  const ext = art.kind === "svg" ? "svg" : "webp";
  return {
    src: `/games/${theme}/assets/cards/${card.id}.${ext}`,
    width: art.width,
    height: art.height,
  };
}

export function resolveCardArt(theme, card, art, releases = ART_RELEASES) {
  const release = acceptedRelease(theme, releases);
  if (!release) return legacyCardArt(theme, card, art);
  return {
    src: releaseCardPath(theme, release.id, card.id),
    width: release.width,
    height: release.height,
  };
}
