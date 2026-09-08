// MYRAA — Currency connector type adapter (TS view over runtime CJS).
// Runtime: resources/app/dist/myraa_currency_connector.cjs (Frankfurter/.dev, ECB-backed, no key).

import type { MyraaConnector } from './types.js';

export const currencyConnectorId = 'currency';
export const currencyToolIds = ['myraa.currency.convert'] as const;

export interface CurrencyConvertInput { amount: number; from: string; to: string }
export interface CurrencyConvertOutput {
  ok: boolean;
  tool: 'myraa.currency.convert';
  connector: 'currency';
  amount?: number; from?: string; to?: string; rate?: number; converted?: number; date?: string;
  summary?: string; disclaimer?: string; reason?: string; cached?: boolean;
}

export type CurrencyConnector = MyraaConnector;
