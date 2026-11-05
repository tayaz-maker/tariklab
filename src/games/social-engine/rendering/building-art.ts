/** Render-only building height; authoritative footprints and navigation stay unchanged. */
export function visualBuildingHeight(kind: string, physicalHeight: number): number {
  return physicalHeight + (kind === "home" ? 2.1 : kind === "office" ? 1.35 : 0);
}
