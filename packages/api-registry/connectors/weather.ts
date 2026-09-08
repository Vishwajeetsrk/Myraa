// MYRAA — Weather connector type adapter (TS view over runtime CJS).
// Runtime: resources/app/dist/myraa_weather_connector.cjs (wraps weather_service.cjs, Open-Meteo).
// This file keeps packages/api-registry type-safe without duplicating fetch logic.

import type { MyraaConnector } from './types.js';

export const weatherConnectorId = 'weather';
export const weatherToolIds = ['myraa.weather.get'] as const;

export interface WeatherGetInput { location?: string }
export interface WeatherGetOutput {
  ok: boolean;
  tool: 'myraa.weather.get';
  connector: 'weather';
  location?: string;
  summary?: string;
  reason?: string;
  cached?: boolean;
}

// Contract check only — runtime lives in dist/myraa_weather_connector.cjs
export type WeatherConnector = MyraaConnector;
