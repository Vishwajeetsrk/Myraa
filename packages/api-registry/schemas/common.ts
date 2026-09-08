// MYRAA — Shared JSON-schema fragments for tools/connectors.
export const LocationInput = { location: { type: 'string', description: 'City or "lat,lon"' } };
export const QueryInput = { query: { type: 'string', minLength: 1 } };
export const PaginationInput = { limit: { type: 'number', default: 20 }, cursor: { type: 'string' } };
