/**
 * Curated city plate pairings from Sanzo Wada's 348 combinations.
 *
 * Maps a city's environmental character and its tension to a historic plate.
 * A city without a pairing here defaults to Plate 002 (Yellow Orange / Dark
 * Tyrian Blue) — the plate the whole interface was drawn around.
 *
 * Kept apart from the catalogue so the pairing is testable without the JSON
 * catalogue, and so the choice of plate is a statement about the city rather
 * than a detail buried in a colour module.
 */
export const CITY_DEFAULT_PLATES: Record<string, number> = {
  bangkok: 2,        // Yellow Orange (#f99d1b) + Dark Tyrian Blue (#12354e) — Shadow population / electric contrast
  'chiang-mai': 30,  // Pompeian Red (#ab2439) + Mineral Gray (#a2b0ad) — Mountain valley / seasonal haze
  phuket: 1,         // English Red (#d96629) + Cerulian Blue (#0093a5) — Island heat & deep sea pressure
  singapore: 5,      // Cossack Green (#437742) + Vandar Poel's Blue (#064f6e) — Garden city & maritime strait
  ljubljana: 12,     // Isabella Color (#c5a56e) + Green Blue (#00867a) — Alpine emerald & historic stone
  kranj: 23,         // Cinnamon Buff (#fdc57e) + Light Mauve (#9a72aa) — Sava riverbed & transitional economy
}

/** The plate the interface was designed around, and the fallback. */
export const DEFAULT_PLATE_ID = 2
