// MYRAA — Holidays connector type adapter (TS view over runtime CJS).
// Runtime: resources/app/dist/myraa_holidays_connector.cjs (Nager.Date, no key).

import type { MyraaConnector } from './types.js';

export const holidaysConnectorId = 'holidays';
export const holidaysToolIds = ['myraa.calendar.get_holidays'] as const;

export interface HolidaysInput { countryCode?: string; year?: number }
export interface Holiday { date: string; localName: string; name: string }
export interface HolidaysOutput {
  ok: boolean;
  tool: 'myraa.calendar.get_holidays';
  connector: 'holidays';
  countryCode?: string; count?: number; holidays?: Holiday[]; scope?: string;
  summary?: string; reason?: string; cached?: boolean;
}

export type HolidaysConnector = MyraaConnector;
