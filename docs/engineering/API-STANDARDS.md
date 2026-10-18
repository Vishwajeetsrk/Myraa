# MYRAA API Standards

## Overview

MYRAA APIs adhere to predictable, uniform REST conventions with JSON payloads and descriptive error responses.

## HTTP Method Conventions

- `GET`: Idempotent read operations. Returns status or data payload.
- `POST`: Create resource, trigger task execution, or execute autonomous evaluation.
- `PUT / PATCH`: Update existing resources or modify settings.
- `DELETE`: Explicit removal (requires user confirmation and safe backup).

## Response Schema Format

### Success Response
```json
{
  "ok": true,
  "data": { ... },
  "timestamp": 1727249102618
}
```

### Error Response
```json
{
  "ok": false,
  "error": "Descriptive human-readable error explanation",
  "code": "INVALID_PARAMETERS"
}
```

## Status Codes
- `200 OK`: Request succeeded.
- `400 Bad Request`: Missing or malformed parameters.
- `404 Not Found`: Engine, route, or resource does not exist.
- `429 Too Many Requests`: Upstream model rate limit reached.
- `500 Internal Server Error`: Unhandled server exception with message.
- `503 Service Unavailable`: Subsystem engine not initialized.
