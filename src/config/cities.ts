export interface KpiItem {
  label: string
  value: string
  unit?: string
}

export interface CityConfig {
  id: string
  name: string
  nameLocal?: string
  country: string
  center: [number, number]
  zoom: number
  kpis: KpiItem[]
}

export const CITIES: CityConfig[] = [
  {
    id: 'bangkok',
    name: 'Bangkok',
    nameLocal: 'กรุงเทพฯ',
    country: 'TH',
    center: [100.5018, 13.7563],
    zoom: 11,
    kpis: [
      { label: 'POPULATION', value: '10.5', unit: 'M' },
      { label: 'SMART SCORE', value: '71.2' },
      { label: 'IOC STATUS', value: 'ACTIVE' },
    ],
  },
  {
    id: 'chiang-mai',
    name: 'Chiang Mai',
    nameLocal: 'เชียงใหม่',
    country: 'TH',
    center: [98.9853, 18.7883],
    zoom: 12,
    kpis: [
      { label: 'POPULATION', value: '1.7', unit: 'M' },
      { label: 'BURNING RISK', value: 'HIGH' },
      { label: 'SMART SCORE', value: '64.5' },
    ],
  },
  {
    id: 'phuket',
    name: 'Phuket',
    nameLocal: 'ภูเก็ต',
    country: 'TH',
    center: [98.3923, 7.8804],
    zoom: 11,
    kpis: [
      { label: 'POPULATION', value: '416K' },
      { label: 'TOURISM/YR', value: '9.9', unit: 'M' },
      { label: 'SMART SCORE', value: '68.4' },
    ],
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'SG',
    center: [103.8198, 1.3521],
    zoom: 12,
    kpis: [
      { label: 'POPULATION', value: '5.9', unit: 'M' },
      { label: 'SMART SCORE', value: '91.4' },
      { label: 'IOC STATUS', value: 'LIVE' },
    ],
  },
  {
    id: 'kuching',
    name: 'Kuching',
    country: 'MY',
    center: [110.3592, 1.5497],
    zoom: 12,
    kpis: [
      { label: 'POPULATION', value: '750K' },
      { label: 'IOC STATUS', value: 'LIVE' },
      { label: 'SMART SCORE', value: '63.1' },
    ],
  },
]
