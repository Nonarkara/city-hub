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

const vpmId = import.meta.env.VITE_UNL_VPM_ID as string

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

export { vpmId }
