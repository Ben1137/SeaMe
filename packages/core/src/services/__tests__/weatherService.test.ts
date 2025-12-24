import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchMarineWeather,
  fetchPointForecast,
  searchLocations,
  reverseGeocode
} from '../weatherService';

// Mock fetch globally
const createMockFetch = () => {
  return vi.fn((url: string) => {
    const urlString = url.toString();

    // Marine API mock
    if (urlString.includes('marine-api.open-meteo.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
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
        }),
      } as Response);
    }

    // Forecast API mock
    if (urlString.includes('api.open-meteo.com/v1/forecast')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
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
        }),
      } as Response);
    }

    // Geocoding API mock
    if (urlString.includes('geocoding-api.open-meteo.com/v1/search')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [
            {
              id: 1,
              name: 'Tel Aviv',
              latitude: 32.0853,
              longitude: 34.7818,
              country: 'Israel',
              admin1: 'Tel Aviv District',
            },
          ],
        }),
      } as Response);
    }

    // Reverse geocoding mock
    if (urlString.includes('geocoding-api.open-meteo.com/v1/reverse')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          results: [
            {
              id: 1,
              name: 'Tel Aviv',
              latitude: 32.0853,
              longitude: 34.7818,
              country: 'Israel',
              admin1: 'Tel Aviv District',
            },
          ],
        }),
      } as Response);
    }

    return Promise.reject(new Error(`Unhandled request: ${url}`));
  });
};

describe('weatherService', () => {
  beforeEach(() => {
    global.fetch = createMockFetch() as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchMarineWeather', () => {
    it('should fetch complete marine weather data', async () => {
      const data = await fetchMarineWeather(32.0853, 34.7818);

      expect(data).toBeDefined();
      expect(data.latitude).toBe(32.0853);
      expect(data.longitude).toBe(34.7818);
    });

    it('should include hourly data', async () => {
      const data = await fetchMarineWeather(32.0853, 34.7818);

      expect(data.hourly).toBeDefined();
      expect(data.hourly.time).toBeInstanceOf(Array);
      expect(data.hourly.wave_height).toBeInstanceOf(Array);
      expect(data.hourly.wind_speed_10m).toBeInstanceOf(Array);
    });

    it('should include current conditions', async () => {
      const data = await fetchMarineWeather(32.0853, 34.7818);

      expect(data.current).toBeDefined();
      expect(data.current.windSpeed).toBeGreaterThanOrEqual(0);
      expect(data.current.waveHeight).toBeGreaterThanOrEqual(0);
      expect(data.current.seaTemperature).toBeGreaterThanOrEqual(0);
    });

    it('should include general weather information', async () => {
      const data = await fetchMarineWeather(32.0853, 34.7818);

      expect(data.general).toBeDefined();
      expect(data.general.temperature).toBeDefined();
      expect(data.general.weatherDescription).toBeDefined();
      expect(data.general.sunrise).toBeDefined();
      expect(data.general.sunset).toBeDefined();
    });

    it('should include tide data', async () => {
      const data = await fetchMarineWeather(32.0853, 34.7818);

      expect(data.tides).toBeDefined();
      expect(data.tides.currentHeight).toBeGreaterThan(0);
      expect(data.tides.nextHigh).toBeDefined();
      expect(data.tides.nextLow).toBeDefined();
      expect(data.tides.hourly).toBeInstanceOf(Array);
      expect(data.tides.hourly.length).toBe(48);
    });

    it('should include moon phase data', async () => {
      const data = await fetchMarineWeather(32.0853, 34.7818);

      expect(data.general.moonPhase).toBeDefined();
      expect(data.general.moonIllumination).toBeGreaterThanOrEqual(0);
      expect(data.general.moonIllumination).toBeLessThanOrEqual(100);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

      await expect(fetchMarineWeather(32.0853, 34.7818)).rejects.toThrow();
    });

    it('should validate coordinates are included in request', async () => {
      await fetchMarineWeather(32.0853, 34.7818);

      expect(global.fetch).toHaveBeenCalled();
      const calls = (global.fetch as any).mock.calls;
      const marineCall = calls.find((call: any) => call[0].includes('marine-api'));
      expect(marineCall).toBeDefined();
      expect(marineCall[0]).toContain('latitude=32.0853');
      expect(marineCall[0]).toContain('longitude=34.7818');
    });
  });

  describe('fetchPointForecast', () => {
    it('should fetch point forecast data', async () => {
      const forecast = await fetchPointForecast(32.0853, 34.7818);

      expect(forecast).toBeDefined();
      expect(forecast.lat).toBe(32.0853);
      expect(forecast.lng).toBe(34.7818);
    });

    it('should include weather conditions', async () => {
      const forecast = await fetchPointForecast(32.0853, 34.7818);

      expect(forecast.waveHeight).toBeGreaterThanOrEqual(0);
      expect(forecast.windSpeed).toBeGreaterThanOrEqual(0);
      expect(forecast.temp).toBeDefined();
      expect(forecast.weatherCode).toBeDefined();
      expect(forecast.weatherDesc).toBeDefined();
    });

    it('should include wind and swell data', async () => {
      const forecast = await fetchPointForecast(32.0853, 34.7818);

      expect(forecast.windDirection).toBeGreaterThanOrEqual(0);
      expect(forecast.windDirection).toBeLessThanOrEqual(360);
      expect(forecast.swellHeight).toBeGreaterThanOrEqual(0);
      expect(forecast.swellDirection).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors and return default values', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('API Error'))) as any;

      const forecast = await fetchPointForecast(32.0853, 34.7818);

      expect(forecast.lat).toBe(32.0853);
      expect(forecast.lng).toBe(34.7818);
      expect(forecast.waveHeight).toBe(0);
      expect(forecast.weatherDesc).toBe('Unavailable');
    });
  });

  describe('searchLocations', () => {
    it('should search for locations', async () => {
      const results = await searchLocations('Tel Aviv');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('country');
      expect(results[0]).toHaveProperty('lat');
      expect(results[0]).toHaveProperty('lng');
    });

    it('should return empty array for short queries', async () => {
      const results = await searchLocations('Te');

      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', async () => {
      const results = await searchLocations('');

      expect(results).toEqual([]);
    });

    it('should handle search errors gracefully', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

      const results = await searchLocations('Tel Aviv');

      expect(results).toEqual([]);
    });

    it('should encode query parameters correctly', async () => {
      await searchLocations('Tel Aviv');

      expect(global.fetch).toHaveBeenCalled();
      const calls = (global.fetch as any).mock.calls;
      const geocodingCall = calls.find((call: any) => call[0].includes('geocoding-api'));
      expect(geocodingCall).toBeDefined();
      expect(geocodingCall[0]).toContain('Tel%20Aviv');
    });

    it('should map API response to Location type', async () => {
      const results = await searchLocations('Tel Aviv');

      expect(results[0]).toEqual({
        id: 1,
        name: 'Tel Aviv',
        country: 'Israel',
        lat: 32.0853,
        lng: 34.7818,
        admin1: 'Tel Aviv District',
      });
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates', async () => {
      const location = await reverseGeocode(32.0853, 34.7818);

      expect(location).toBeDefined();
      expect(location?.name).toBe('Tel Aviv');
      expect(location?.country).toBe('Israel');
    });

    it('should return null when no results found', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ results: [] }),
        } as Response)
      ) as any;

      const location = await reverseGeocode(0, 0);

      expect(location).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('API Error'))) as any;

      const location = await reverseGeocode(32.0853, 34.7818);

      expect(location).toBeNull();
    });

    it('should include coordinates in request', async () => {
      await reverseGeocode(32.0853, 34.7818);

      expect(global.fetch).toHaveBeenCalled();
      const calls = (global.fetch as any).mock.calls;
      const reverseCall = calls.find((call: any) => call[0].includes('reverse'));
      expect(reverseCall).toBeDefined();
      expect(reverseCall[0]).toContain('latitude=32.0853');
      expect(reverseCall[0]).toContain('longitude=34.7818');
    });
  });

  describe('API integration', () => {
    it('should make parallel API calls for marine weather', async () => {
      await fetchMarineWeather(32.0853, 34.7818);

      // Should call both marine and forecast APIs
      expect(global.fetch).toHaveBeenCalledTimes(2);

      const calls = (global.fetch as any).mock.calls;
      const hasMarineCall = calls.some((call: any) => call[0].includes('marine-api'));
      const hasForecastCall = calls.some((call: any) => call[0].includes('api.open-meteo.com/v1/forecast'));

      expect(hasMarineCall).toBe(true);
      expect(hasForecastCall).toBe(true);
    });

    it('should include timezone in requests', async () => {
      await fetchMarineWeather(32.0853, 34.7818);

      const calls = (global.fetch as any).mock.calls;
      calls.forEach((call: any) => {
        if (call[0].includes('marine-api') || call[0].includes('forecast')) {
          expect(call[0]).toContain('timezone=GMT');
        }
      });
    });

    it('should request correct forecast days', async () => {
      await fetchMarineWeather(32.0853, 34.7818);

      const calls = (global.fetch as any).mock.calls;
      const marineCall = calls.find((call: any) => call[0].includes('marine-api'));
      expect(marineCall[0]).toContain('forecast_days=7');
    });
  });
});
