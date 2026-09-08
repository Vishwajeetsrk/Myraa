// MYRAA — GitHub REST connector type adapter (TS view over runtime CJS).
// Runtime: resources/app/dist/myraa_github_connector.cjs (api.github.com, token from SecureVault, server-side only).
// Rule: token NEVER in frontend. READ_ONLY default; writes require allow-list + confirmation.

import type { MyraaConnector } from './types.js';

export const githubConnectorId = 'github';
export const githubToolIds = [
  'myraa.github.repo_list',
  'myraa.github.repo_tree',
  'myraa.github.read_file',
  'myraa.github.search_code',
] as const;

export interface GithubRepo { name: string; full_name: string; private: boolean; default_branch?: string; language?: string; description?: string; html_url: string; updated_at?: string }
export interface GithubRepoListOutput {
  ok: boolean; tool: 'myraa.github.repo_list'; connector: 'github'; authenticated: boolean;
  count?: number; repos?: GithubRepo[]; scope?: string; summary?: string; reason?: string; cached?: boolean;
}
export interface GithubRepoTreeOutput {
  ok: boolean; tool: 'myraa.github.repo_tree'; connector: 'github';
  owner?: string; repo?: string; branch?: string; fileCount?: number; files?: string[];
  summary?: string; reason?: string; cached?: boolean;
}
export interface GithubReadFileOutput {
  ok: boolean; tool: 'myraa.github.read_file'; connector: 'github';
  owner?: string; repo?: string; path?: string; ref?: string; size?: number; content?: string;
  summary?: string; reason?: string;
}
export interface GithubSearchOutput {
  ok: boolean; tool: 'myraa.github.search_code'; connector: 'github';
  count?: number; results?: { name: string; path: string; repo?: string; html_url?: string }[];
  summary?: string; reason?: string;
}

export type GithubConnector = MyraaConnector;
