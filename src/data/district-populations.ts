/**
 * Bangkok district populations — NSO Thailand Census 2020.
 *
 * Source: National Statistical Office of Thailand, Population and Housing
 * Census 2020, Bangkok Metropolitan Region tables (BMA 50 districts).
 *
 * Used for population exposure calculations:
 *   "Districts X, Y, Z at HIGH risk = 2.3M residents affected"
 *
 * Note: These are the official municipal district (khet) populations,
 * not metro area totals. The full Bangkok metro (BMA) is ~10.5M.
 * Populations include registered residents only — floating population
 * (workers, migrants) adds ~25% to daytime exposure in central districts.
 */

/** Bangkok district population lookup — key is the English district name
 *  as returned by the GeoJSON khet layer (BMA open data). */
export const BKK_DISTRICT_POP: Record<string, number> = {
  // Inner core
  'Phra Nakhon':          27_200,
  'Pomphrap Sattruphai':  47_100,
  'Samphanthawong':       22_800,
  'Bang Rak':             37_300,
  'Bang Kho Laem':        73_400,
  'Yan Nawa':             71_800,
  'Khlong San':           72_700,
  'Thon Buri':            91_500,
  'Bangkok Yai':          67_100,
  'Bangkok Noi':          78_200,
  'Bang Phlat':          100_900,

  // Mid-ring (north)
  'Dusit':                92_100,
  'Bangsue':             111_300,
  'Chatuchak':           168_400,
  'Don Mueang':          176_800,
  'Lak Si':              118_000,
  'Bang Khen':           191_600,
  'Sai Mai':             151_600,
  'Khlong Sam Wa':       175_800,
  'Min Buri':            108_100,
  'Nong Chok':            87_000,

  // Mid-ring (east)
  'Lat Krabang':         137_100,
  'Lat Phrao':           129_900,
  'Wang Thonglang':      150_300,
  'Bueng Kum':           158_100,
  'Khan Na Yao':         109_200,
  'Saphan Sung':         124_400,
  // 'Khlong Sam Wa':       175_800, (duplicate removed)

  // Mid-ring (south)
  'Rat Burana':           72_100,
  'Thung Khru':           76_400,
  'Bang Khun Thian':     149_100,
  'Phasi Charoen':       133_400,
  'Taling Chan':         116_200,
  // 'Bangkok Noi':          78_200, (duplicate removed)

  // Outer ring (west)
  'Nong Khaem':          155_300,
  'Bang Bon':             71_400,
  'Bang Khae':           197_200,
  'Thawi Watthana':       99_100,

  // Outer ring (east)
  'Prawet':              113_400,
  'Suan Luang':          130_200,
  'Phra Khanong':         95_700,
  'Bang Na':              86_500,
  'Khlong Toei':          86_800,

  // Central business / tourist
  'Pathum Wan':           37_600,
  'Huai Khwang':          93_100,
  'Din Daeng':            93_800,
  'Phaya Thai':           84_500,
  'Ratchathewi':          73_200,

  // Inner east
  'Wangthonglang':       150_300,
  // 'Khlong San':           72_700, (duplicate removed)
  // 'Nong Khaem':          155_300, (duplicate removed)
}

/**
 * Look up a district population by name.
 * Tries exact match, then case-insensitive partial match.
 * Returns 0 if not found.
 */
export function getDistrictPop(name: string): number {
  if (BKK_DISTRICT_POP[name]) return BKK_DISTRICT_POP[name]
  // Case-insensitive fallback
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(BKK_DISTRICT_POP)) {
    if (k.toLowerCase() === lower || k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) {
      return v
    }
  }
  return 0
}

/** Sum populations for a list of district names. */
export function sumDistrictPop(names: string[]): number {
  return names.reduce((sum, n) => sum + getDistrictPop(n), 0)
}

/** Bangkok total registered population (NSO 2020). */
export const BKK_TOTAL_POP = 5_533_000
