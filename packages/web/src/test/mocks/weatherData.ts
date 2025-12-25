import { MarineWeatherData, PointForecast, Location } from '@seame/core';

export const mockMarineWeatherData: MarineWeatherData = {
  latitude: 32.0853,
  longitude: 34.7818,
  elevation: 0,
  generationtime_ms: 0.5,
  utc_offset_seconds: 0,
  timezone: 'GMT',
  timezone_abbreviation: 'GMT',
  hourly_units: {
    wave_height: 'm',
    wind_speed_10m: 'm/s',
    swell_wave_height: 'm',
    wave_period: 's',
    swell_wave_period: 's',
  },
  hourly: {
    wave_height: Array.from({ length: 168 }, () => 1.5 + Math.random() * 0.5),
    wave_direction: Array.from({ length: 168 }, () => 270 + Math.random() * 20),
    wave_period: Array.from({ length: 168 }, () => 6 + Math.random() * 2),
    swell_wave_height: Array.from({ length: 168 }, () => 1.0 + Math.random() * 0.5),
    swell_wave_direction: Array.from({ length: 168 }, () => 260 + Math.random() * 20),
    swell_wave_period: Array.from({ length: 168 }, () => 8 + Math.random() * 2),
    swell_wave_peak_period: Array.from({ length: 168 }, () => 9 + Math.random() * 2),
    sea_surface_temperature: Array.from({ length: 168 }, () => 22 + Math.random() * 2),
    pressure_msl: Array.from({ length: 168 }, () => 1013 + Math.random() * 5),
    visibility: Array.from({ length: 168 }, () => 10000 + Math.random() * 5000),
    wind_speed_10m: Array.from({ length: 168 }, () => 15 + Math.random() * 10),
    wind_direction_10m: Array.from({ length: 168 }, () => 270 + Math.random() * 30),
    wind_gusts_10m: Array.from({ length: 168 }, () => 20 + Math.random() * 10),
    relative_humidity_2m: Array.from({ length: 168 }, () => 60 + Math.random() * 20),
    uv_index: Array.from({ length: 168 }, () => Math.random() * 8),
    weather_code: Array.from({ length: 168 }, () => 0),
  },
  daily_units: {
    time: 'iso8601',
    wave_height_max: 'm',
    wave_direction_dominant: '°',
    wave_period_max: 's',
    wind_wave_height_max: 'm',
    wind_wave_direction_dominant: '°',
    wind_wave_period_max: 's',
    swell_wave_height_max: 'm',
    swell_wave_direction_dominant: '°',
    swell_wave_period_max: 's',
  },
  daily: {
    wave_height_max: Array.from({ length: 7 }, () => 2.0 + Math.random() * 1.0),
    swell_wave_direction_dominant: Array.from({ length: 7 }, () => 270),
    wave_period_max: Array.from({ length: 7 }, () => 8),
    swell_wave_height_max: Array.from({ length: 7 }, () => 1.5),
    swell_wave_period_max: Array.from({ length: 7 }, () => 10),
  },
  current: {
    sea_surface_temperature: 23,
    wave_height: 1.5,
    wave_direction: 270,
    wave_period: 7,
    swell_wave_height: 1.2,
    swell_wave_direction: 260,
    swell_wave_period: 9,
    swell_wave_peak_period: 10,
    windSpeed: 18,
    windDirection: 275,
    windGusts: 24,
    seaTemperature: 23,
    waveHeight: 1.5,
    wavePeriod: 7,
    swellHeight: 1.2,
    swellDirection: 260,
    swellPeriod: 9,
    pressure: 1013,
    visibility: 12000,
    seaLevel: 1.8,
    uvIndex: 4.5,
  },
  tides: {
    currentHeight: 1.8,
    rising: true,
    nextHigh: {
      time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      height: 2.5,
      type: 'HIGH',
    },
    nextLow: {
      time: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      height: 0.3,
      type: 'LOW',
    },
    hourly: Array.from({ length: 48 }, (_, i) => {
      const time = new Date();
      time.setHours(time.getHours() + i);
      const t = i / 12.42;
      const height = 1.2 + Math.cos(2 * Math.PI * t) * 1.5;
      return {
        time: time.toISOString(),
        height: parseFloat(height.toFixed(2)),
      };
    }),
  },
  general: {
    temperature: 25,
    feelsLike: 26,
    humidity: 70,
    uvIndex: 6,
    weatherCode: 1,
    weatherDescription: 'Mainly Clear',
    isDay: true,
    sunrise: new Date().toISOString(),
    sunset: new Date().toISOString(),
    moonrise: new Date().toISOString(),
    moonset: new Date().toISOString(),
    moonPhase: 'First Quarter',
    moonIllumination: 50,
    nextFullMoon: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    pressure: 1013,
    visibility: 12000,
    dailyForecast: [
      {
        time: new Date().toISOString().split('T')[0],
        code: 1,
        tempMax: 28,
        tempMin: 22,
      },
      {
        time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        code: 2,
        tempMax: 27,
        tempMin: 21,
      },
      {
        time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
        code: 0,
        tempMax: 29,
        tempMin: 23,
      },
    ],
  },
};

export const mockPointForecast: PointForecast = {
  lat: 32.0853,
  lng: 34.7818,
  waveHeight: 1.5,
  windSpeed: 18,
  windDirection: 275,
  swellHeight: 1.2,
  swellDirection: 260,
  temp: 25,
  weatherCode: 1,
  weatherDesc: 'Mainly Clear',
};

export const mockLocations: Location[] = [
  {
    id: 1,
    name: 'Tel Aviv',
    country: 'Israel',
    lat: 32.0853,
    lng: 34.7818,
    admin1: 'Tel Aviv District',
  },
  {
    id: 2,
    name: 'Haifa',
    country: 'Israel',
    lat: 32.7940,
    lng: 34.9896,
    admin1: 'Haifa District',
  },
  {
    id: 3,
    name: 'Eilat',
    country: 'Israel',
    lat: 29.5581,
    lng: 34.9482,
    admin1: 'Southern District',
  },
];

export const mockApiResponse = {
  marine: {
    latitude: 32.0853,
    longitude: 34.7818,
    hourly: {
      time: Array.from({ length: 168 }, (_, i) => {
        const date = new Date();
        date.setHours(date.getHours() + i);
        return date.toISOString();
      }),
      wave_height: Array.from({ length: 168 }, () => 1.5),
      swell_wave_height: Array.from({ length: 168 }, () => 1.2),
      wave_period: Array.from({ length: 168 }, () => 7),
      swell_wave_period: Array.from({ length: 168 }, () => 9),
      wave_direction: Array.from({ length: 168 }, () => 270),
      swell_wave_direction: Array.from({ length: 168 }, () => 260),
      sea_surface_temperature: Array.from({ length: 168 }, () => 23),
    },
    current: {
      sea_surface_temperature: 23,
      wave_height: 1.5,
      wave_period: 7,
      swell_wave_height: 1.2,
      swell_wave_direction: 260,
      swell_wave_period: 9,
    },
    daily: {
      time: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      }),
      wave_height_max: Array.from({ length: 7 }, () => 2.0),
      swell_wave_height_max: Array.from({ length: 7 }, () => 1.5),
      swell_wave_direction_dominant: Array.from({ length: 7 }, () => 260),
      wave_period_max: Array.from({ length: 7 }, () => 8),
    },
  },
  forecast: {
    latitude: 32.0853,
    longitude: 34.7818,
    current: {
      temperature_2m: 25,
      relative_humidity_2m: 70,
      apparent_temperature: 26,
      is_day: 1,
      weather_code: 1,
      wind_speed_10m: 18,
      wind_direction_10m: 275,
      wind_gusts_10m: 24,
      surface_pressure: 1013,
      visibility: 12000,
    },
    hourly: {
      time: Array.from({ length: 168 }, (_, i) => {
        const date = new Date();
        date.setHours(date.getHours() + i);
        return date.toISOString();
      }),
      pressure_msl: Array.from({ length: 168 }, () => 1013),
      visibility: Array.from({ length: 168 }, () => 12000),
      wind_speed_10m: Array.from({ length: 168 }, () => 18),
      wind_direction_10m: Array.from({ length: 168 }, () => 275),
      relative_humidity_2m: Array.from({ length: 168 }, () => 70),
      uv_index: Array.from({ length: 168 }, () => 4.5),
      weather_code: Array.from({ length: 168 }, () => 1),
    },
    daily: {
      time: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      }),
      weather_code: Array.from({ length: 7 }, () => 1),
      temperature_2m_max: Array.from({ length: 7 }, () => 28),
      temperature_2m_min: Array.from({ length: 7 }, () => 22),
      sunrise: Array.from({ length: 7 }, () => new Date().toISOString()),
      sunset: Array.from({ length: 7 }, () => new Date().toISOString()),
      uv_index_max: Array.from({ length: 7 }, () => 6),
    },
  },
};
