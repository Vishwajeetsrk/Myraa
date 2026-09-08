// MYRAA — News / RSS connector type adapter (TS view over runtime CJS).
// Runtime: resources/app/dist/myraa_news_connector.cjs (curated feeds, no key).

import type { MyraaConnector } from './types.js';

export const newsConnectorId = 'news';
export const newsToolIds = ['myraa.news.search', 'myraa.news.headlines'] as const;

export interface NewsHeadlinesInput { source?: string; limit?: number }
export interface NewsArticle { title: string; link: string; published?: string; description?: string }
export interface NewsHeadlinesOutput {
  ok: boolean;
  tool: 'myraa.news.headlines';
  connector: 'news';
  source?: string; sourceName?: string; count?: number; articles?: NewsArticle[];
  summary?: string; reason?: string; cached?: boolean;
}

export type NewsConnector = MyraaConnector;
