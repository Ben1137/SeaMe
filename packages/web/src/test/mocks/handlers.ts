import { vi } from 'vitest';
import { mockApiResponse } from './weatherData';

export const createMockFetch = () => {
  return vi.fn((url: string) => {
    const urlString = url.toString();

    // Marine API mock
    if (urlString.includes('marine-api.open-meteo.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponse.marine),
        headers: new Headers(),
        redirected: false,
        statusText: 'OK',
        type: 'basic' as ResponseType,
        url: urlString,
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve(JSON.stringify(mockApiResponse.marine)),
      } as Response);
    }

    // Forecast API mock
    if (urlString.includes('api.open-meteo.com/v1/forecast')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponse.forecast),
        headers: new Headers(),
        redirected: false,
        statusText: 'OK',
        type: 'basic' as ResponseType,
        url: urlString,
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve(JSON.stringify(mockApiResponse.forecast)),
      } as Response);
    }

    // Geocoding API mock
    if (urlString.includes('geocoding-api.open-meteo.com')) {
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
        headers: new Headers(),
        redirected: false,
        statusText: 'OK',
        type: 'basic' as ResponseType,
        url: urlString,
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve(''),
      } as Response);
    }

    // Default fallback
    return Promise.reject(new Error(`Unhandled request: ${url}`));
  });
};

export const setupMockFetch = () => {
  global.fetch = createMockFetch() as any;
};

export const mockIndexedDB = () => {
  const store: Record<string, any> = {};

  const createRequest = (result?: any, error?: any) => {
    return {
      result,
      error,
      onsuccess: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
    };
  };

  const mockTransaction = {
    objectStore: () => ({
      get: (key: string) => {
        const request = createRequest(store[key]);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      put: (value: any) => {
        store[value.key] = value;
        const request = createRequest(value);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      delete: (key: string) => {
        delete store[key];
        const request = createRequest(undefined);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      clear: () => {
        Object.keys(store).forEach(key => delete store[key]);
        const request = createRequest(undefined);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      getAll: () => {
        const request = createRequest(Object.values(store));
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      openCursor: () => {
        const keys = Object.keys(store);
        let index = 0;
        const request = {
          result: null as any,
          onsuccess: null as ((event: any) => void) | null,
          onerror: null as ((event: any) => void) | null,
        };

        const nextCursor = () => {
          if (index < keys.length) {
            const key = keys[index];
            request.result = {
              value: store[key],
              delete: () => {
                delete store[key];
                return createRequest(undefined);
              },
              continue: () => {
                index++;
                setTimeout(() => nextCursor(), 0);
              },
            };
          } else {
            request.result = null;
          }
          setTimeout(() => request.onsuccess?.({ target: request }), 0);
        };

        setTimeout(() => nextCursor(), 0);
        return request;
      },
      createIndex: () => ({}),
      index: (name: string) => ({
        openCursor: (range?: any) => mockTransaction.objectStore().openCursor(),
      }),
    }),
  };

  const mockDB = {
    transaction: () => mockTransaction,
    createObjectStore: () => mockTransaction.objectStore(),
    objectStoreNames: {
      contains: () => false,
    },
  };

  global.indexedDB = {
    open: (name: string, version: number) => {
      const request = {
        result: mockDB,
        error: null,
        onsuccess: null as ((event: any) => void) | null,
        onerror: null as ((event: any) => void) | null,
        onupgradeneeded: null as ((event: any) => void) | null,
      };

      setTimeout(() => {
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: request });
        }
        request.onsuccess?.({ target: request });
      }, 0);

      return request;
    },
    deleteDatabase: () => createRequest(undefined),
  } as any;
};
