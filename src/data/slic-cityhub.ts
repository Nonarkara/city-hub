type SlicPillarId = 'pressure' | 'viability' | 'capability' | 'community' | 'creative'

export interface CityHubSlicScore {
  cityId: string
  displayName: string
  country: string
  region: string
  pressureScore: number
  viabilityScore: number
  capabilityScore: number
  communityScore: number
  creativeScore: number
  slicScore: number
  coverageGrade?: string
  overallWeightedCoverage?: number
  globalRank: number
  regionalRank: number
  regionalTotal: number
}

export interface CityHubSlicSnapshot {
  version: string
  updatedAt: string
  globalTotal: number
  canonicalWeights: Record<SlicPillarId, number>
  cities: CityHubSlicScore[]
}

export const CITY_HUB_SLIC: CityHubSlicSnapshot = {
  version: 'v3.4.0',
  updatedAt: '2026-05-26T18:39:04.797Z',
  globalTotal: 163,
  canonicalWeights: {
    pressure: 25,
    viability: 22,
    capability: 18,
    community: 15,
    creative: 20,
  },
  cities: [
    {
      cityId: 'th-bangkok',
      displayName: 'Bangkok',
      country: 'Thailand',
      region: 'Southeast Asia',
      pressureScore: 49.9,
      viabilityScore: 76.6,
      capabilityScore: 68.2,
      communityScore: 70.7,
      creativeScore: 44.5,
      slicScore: 58.5,
      coverageGrade: 'A',
      overallWeightedCoverage: 0.95,
      globalRank: 53,
      regionalRank: 2,
      regionalTotal: 16,
    },
    {
      cityId: 'th-chiang-mai',
      displayName: 'Chiang Mai',
      country: 'Thailand',
      region: 'Southeast Asia',
      pressureScore: 59.2,
      viabilityScore: 49.7,
      capabilityScore: 62.2,
      communityScore: 49,
      creativeScore: 28.8,
      slicScore: 47.3,
      coverageGrade: 'A',
      overallWeightedCoverage: 0.9,
      globalRank: 88,
      regionalRank: 10,
      regionalTotal: 16,
    },
    {
      cityId: 'th-phuket',
      displayName: 'Phuket',
      country: 'Thailand',
      region: 'Southeast Asia',
      pressureScore: 54.2,
      viabilityScore: 68,
      capabilityScore: 62.2,
      communityScore: 49,
      creativeScore: 28.8,
      slicScore: 49.3,
      coverageGrade: 'A',
      overallWeightedCoverage: 0.9,
      globalRank: 82,
      regionalRank: 8,
      regionalTotal: 16,
    },
    {
      cityId: 'sg-singapore',
      displayName: 'Singapore',
      country: 'Singapore',
      region: 'Southeast Asia',
      pressureScore: 41.3,
      viabilityScore: 90.4,
      capabilityScore: 94.1,
      communityScore: 38.4,
      creativeScore: 73.3,
      slicScore: 59.4,
      coverageGrade: 'A',
      overallWeightedCoverage: 0.91,
      globalRank: 50,
      regionalRank: 1,
      regionalTotal: 16,
    },
    {
      cityId: 'my-kuching',
      displayName: 'Kuching',
      country: 'Malaysia',
      region: 'Southeast Asia',
      pressureScore: 65.7,
      viabilityScore: 72,
      capabilityScore: 49.1,
      communityScore: 44.3,
      creativeScore: 31.5,
      slicScore: 49.9,
      coverageGrade: 'A',
      overallWeightedCoverage: 0.95,
      globalRank: 78,
      regionalRank: 6,
      regionalTotal: 16,
    },
  ],
}
