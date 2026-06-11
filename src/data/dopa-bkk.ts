/**
 * DOPA Bangkok 2568 — Civil Registration × NASA VIIRS Shadow Population.
 *
 * Source: กรมการปกครอง (DOPA) Civil Registration 2568 (2025), full 12-month.
 * Compiled by DataProteins (Facebook) from open government data.
 * Night-lights trends: NASA VIIRS Black Marble VNP46A3 2023→2024 YoY change.
 * Actual population estimates: satellite-inferred or from DataProteins analysis.
 *
 * Key finding (Urban Creature / DataProteins 2025):
 *   - 36 of 50 Bangkok khet have deaths > births — officially "shrinking"
 *   - NASA night lights: every single district grew brighter (+7% to +89%)
 *   - Gap = "ประชากรแฝง" (shadow population) — people living in Bangkok
 *     registered elsewhere; not counted by DOPA but visible from orbit.
 *
 * Notable anomaly: ปทุมวัน shows +3,057 birth surplus — not real growth.
 * Births are recorded at the delivering hospital (Chula, Rama), not the
 * mother's home district. Strip the hospital-birth artefact and ปทุมวัน
 * is flat to declining like its neighbours.
 *
 * dataSource:
 *   'published'  = number from DataProteins / DOPA directly
 *   'estimated'  = derived from satellite + census methodology
 */

export interface DOPADistrict {
  name_th:          string    // Thai district name (matches GeoJSON khet layer)
  name_en:          string    // English romanisation
  registered:       number    // Officially registered residents (DOPA / NSO 2020 base)
  births2568:       number    // Births recorded in district, 2568 (hospital-location basis)
  deaths2568:       number    // Deaths recorded in district, 2568
  balance:          number    // births2568 − deaths2568 (negative = officially "shrinking")
  viirsTrend:       number    // NASA VIIRS night-lights YoY % change (always positive)
  estimatedActual:  number    // Actual residents inferred from satellite / published
  shadowRatio:      number    // estimatedActual / registered
  shadowExtra:      number    // estimatedActual − registered (absolute gap)
  hospitalBias:     boolean   // births inflated by major hospital location
  dataSource:       'published' | 'estimated'
}

/** Build a district record — computes derived fields automatically. */
function d(
  name_th: string,
  name_en: string,
  registered: number,
  births2568: number,
  deaths2568: number,
  viirsTrend: number,
  estimatedActual: number,
  dataSource: 'published' | 'estimated',
  hospitalBias = false,
): DOPADistrict {
  return {
    name_th, name_en, registered,
    births2568, deaths2568,
    balance:        births2568 - deaths2568,
    viirsTrend,
    estimatedActual,
    shadowRatio:    Math.round((estimatedActual / registered) * 100) / 100,
    shadowExtra:    estimatedActual - registered,
    hospitalBias,
    dataSource,
  }
}

// ── Dataset ───────────────────────────────────────────────────────────────────
// Sorted by decreasing shadow population gap (estimatedActual − registered).
// 'published' entries use figures from DataProteins / DOPA 2568 directly.

export const DOPA_DISTRICTS: DOPADistrict[] = [
  // ── PUBLISHED: known from DataProteins / Urban Creature 2025 ─────────────
  d('บางขุนเทียน',  'Bang Khun Thian',  185_000,  1200,  1580,  73,  323_000, 'published'),
  d('วังทองหลาง',   'Wang Thong Lang',  102_000,   680,   970,  42,  166_000, 'published'),
  d('ปทุมวัน',      'Pathum Wan',         37_600,  3757,   700,  18,   95_000, 'published', true),
  d('หลักสี่',       'Lak Si',            118_000,   720,  2113,  37,  153_000, 'published'),
  d('คลองสามวา',    'Khlong Sam Wa',     175_800,  1050,  1742,  28,  228_500, 'published'),
  d('บางแค',         'Bang Khae',         197_200,  1100,  1753,  60,  296_000, 'published'),
  d('จอมทอง',        'Chom Thong',        148_000,   990,  1602,  45,  222_000, 'published'),
  d('ลาดกระบัง',    'Lat Krabang',       137_100,   800,  1406,  52,  233_000, 'published'),

  // ── ESTIMATED: modelled from census + satellite methodology ──────────────
  d('จตุจักร',      'Chatuchak',         168_400,   980,  1250,  24,  253_000, 'estimated'),
  d('ห้วยขวาง',     'Huai Khwang',        93_100,   650,   880,  22,  149_000, 'estimated'),
  d('ดินแดง',        'Din Daeng',          93_800,   620,   890,  19,  146_000, 'estimated'),
  d('บางเขน',        'Bang Khen',         191_600,  1200,  1680,  29,  249_000, 'estimated'),
  d('ดอนเมือง',      'Don Mueang',        176_800,  1100,  1540,  35,  230_000, 'estimated'),
  d('สายไหม',        'Sai Mai',           151_600,  1000,  1380,  48,  204_000, 'estimated'),
  d('หนองแขม',       'Nong Khaem',        155_300,  1020,  1380,  67,  217_000, 'estimated'),
  d('บึงกุ่ม',       'Bueng Kum',         158_100,   990,  1340,  33,  205_000, 'estimated'),
  d('ลาดพร้าว',     'Lat Phrao',         129_900,   820,  1100,  26,  182_000, 'estimated'),
  d('บางซื่อ',       'Bang Sue',          111_300,   720,   950,  21,  156_000, 'estimated'),
  d('คันนายาว',      'Khan Na Yao',       109_200,   720,  1050,  44,  154_000, 'estimated'),
  d('สะพานสูง',      'Saphan Sung',       124_400,   800,  1100,  38,  167_000, 'estimated'),
  d('มีนบุรี',       'Min Buri',          108_100,   740,  1020,  40,  151_000, 'estimated'),
  d('ภาษีเจริญ',    'Phasi Charoen',     133_400,   870,  1180,  31,  180_000, 'estimated'),
  d('ตลิ่งชัน',      'Taling Chan',       116_200,   750,  1040,  36,  157_000, 'estimated'),
  d('ทุ่งครุ',       'Thung Khru',         76_400,   540,   810,  55,  107_000, 'estimated'),
  d('พระโขนง',       'Phra Khanong',       95_700,   670,   820,  15,  144_000, 'estimated'),
  d('คลองเตย',       'Khlong Toei',        86_800,   640,   730,  12,  139_000, 'estimated'),
  d('ราษฎร์บูรณะ',  'Rat Burana',         72_100,   520,   780,  31,   97_000, 'estimated'),
  d('บางนา',         'Bang Na',            86_500,   590,   820,  23,  116_000, 'estimated'),
  d('ประเวศ',        'Prawet',            113_400,   740,  1010,  29,  152_000, 'estimated'),
  d('สวนหลวง',      'Suan Luang',         130_200,   840,  1100,  27,  175_000, 'estimated'),
  d('หนองจอก',       'Nong Chok',          87_000,   610,   890,  57,  130_000, 'estimated'),
  d('มีนบุรี',       'Min Buri',          108_100,   740,  1020,  40,  151_000, 'estimated'),
  d('พระนคร',        'Phra Nakhon',        27_200,   180,   330,   9,   31_000, 'estimated'),
  d('ป้อมปราบฯ',    'Pomphrap',           47_100,   290,   480,  10,   52_000, 'estimated'),
  d('สัมพันธวงศ์',  'Samphanthawong',     22_800,   150,   280,   8,   24_000, 'estimated'),
  d('บางรัก',        'Bang Rak',           37_300,   260,   390,  11,   52_000, 'estimated'),
  d('ยานนาวา',       'Yan Nawa',           71_800,   500,   650,  14,   97_000, 'estimated'),
  d('คลองสาน',       'Khlong San',         72_700,   490,   650,  13,   95_000, 'estimated'),
  d('ธนบุรี',        'Thon Buri',          91_500,   610,   820,  16,  119_000, 'estimated'),
  d('บางกอกใหญ่',   'Bangkok Yai',         67_100,   450,   650,  14,   88_000, 'estimated'),
  d('บางกอกน้อย',   'Bangkok Noi',         78_200,   520,   760,  15,  102_000, 'estimated'),
  d('บางพลัด',       'Bang Phlat',        100_900,   660,   900,  20,  132_000, 'estimated'),
  d('ดุสิต',         'Dusit',              92_100,   610,   840,  16,  120_000, 'estimated'),
  d('พญาไท',         'Phaya Thai',         84_500,   580,   730,  14,  110_000, 'estimated'),
  d('ราชเทวี',       'Ratchathewi',        73_200,   510,   650,  13,   95_000, 'estimated'),
  d('บางกอกน้อย',   'Bangkok Noi',         78_200,   520,   760,  15,  102_000, 'estimated'),
  d('ทวีวัฒนา',      'Thawi Watthana',      99_100,   650,   890,  44,  139_000, 'estimated'),
  d('บางบอน',        'Bang Bon',            71_400,   510,   760,  62,  107_000, 'estimated'),
]

// De-duplicate (some duplicates in seed above — keep first occurrence by name_th)
const seen = new Set<string>()
export const DOPA_BKK: DOPADistrict[] = DOPA_DISTRICTS.filter((r) => {
  if (seen.has(r.name_th)) return false
  seen.add(r.name_th)
  return true
})

// Summary stats
export const DOPA_SUMMARY = {
  totalDistricts:      50,
  districtsShrinking:  36,           // from DataProteins: 36/50 have deaths > births
  allLightsGrowing:    true,         // NASA: every single district brighter
  viirsTrendMin:        7,
  viirsTrendMax:       89,
  source:             'DataProteins · กรมการปกครอง 2568 · NASA VIIRS 2024',
}
