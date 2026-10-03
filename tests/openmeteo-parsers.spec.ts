import { expect, test } from '@playwright/test'
import { parseOpenMeteoAQ } from '../src/data/openmeteo-aq'
import { parseOpenMeteoWeather } from '../src/data/openmeteo'

test('parses and rounds a valid Open-Meteo AQ response', () => {
  expect(parseOpenMeteoAQ({
    current: {
      us_aqi: 121.4,
      pm10: 52.17,
      pm2_5: 34.96,
      carbon_monoxide: 510.05,
      nitrogen_dioxide: 21.14,
      sulphur_dioxide: 4.04,
      ozone: 72.27,
    },
  })).toEqual({
    usAqi: 121,
    pm25: 35,
    pm10: 52.2,
    no2: 21.1,
    o3: 72.3,
    so2: 4,
    co: 510.1,
    level: 'unhealthy-sensitive',
  })
})

test('rejects missing, null, negative, and non-numeric AQ fields', () => {
  expect(() => parseOpenMeteoAQ(null)).toThrow()
  expect(() => parseOpenMeteoAQ({ current: { us_aqi: null } })).toThrow(/us_aqi/)
  expect(() => parseOpenMeteoAQ({
    current: {
      us_aqi: 20,
      pm10: 12,
      pm2_5: -1,
      carbon_monoxide: 100,
      nitrogen_dioxide: 5,
      sulphur_dioxide: 2,
      ozone: 20,
    },
  })).toThrow(/pm2_5/)
})

test('parses a valid Open-Meteo weather response', () => {
  expect(parseOpenMeteoWeather({
    current: {
      temperature_2m: 31.6,
      apparent_temperature: 37.2,
      wind_speed_10m: 8.8,
      wind_direction_10m: 157,
      weather_code: 3,
    },
  })).toEqual({
    temp: 32,
    feelsLike: 37,
    windSpeed: 9,
    windDir: 157,
    windCardinal: 'SSE',
    condition: 'OVC',
  })
})

test('rejects malformed Open-Meteo weather responses', () => {
  expect(() => parseOpenMeteoWeather({})).toThrow(/missing current/)
  expect(() => parseOpenMeteoWeather({
    current: {
      temperature_2m: 30,
      apparent_temperature: 34,
      wind_speed_10m: -2,
      wind_direction_10m: 90,
      weather_code: 1,
    },
  })).toThrow(/wind speed/)
})
