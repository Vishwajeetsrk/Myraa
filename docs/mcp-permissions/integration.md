# Tool Permissions + MCP Manager Skeleton (Phase 24)

Two modules: per-agent tool permission policy, and the MCP server registry
skeleton (bookkeeping only - no transports are started yet).

## tool_permissions.cjs
Store: `%APPDATA%\MYRAA\permissions\permissions.json` (env `MYRAA_PERMISSIONS_DB`)

Model: per agent `{ allow: [patterns], deny: [patterns], default: 'deny'|'allow' }`.
Patterns: exact tool name, `prefix*`, or `*`.

Rules:
- deny rules beat allow rules
- HIGH/CRITICAL risk tools always require an explicit (non-wildcard) allow rule
- unknown agents default to deny
- revoke removes the allow and adds a deny (stronger than plain removal)
- mutations are additive bookkeeping; events journal capped at 200

API: `grant`, `revoke`, `setDefault`, `check({agent, tool, risk})`,
`listAgents`, `status`, `createRouter`, `registerAgiTools`
HTTP: GET `/api/permissions`, `/agents`, `/check?agent=&tool=&risk=`; POST `/grant`, `/revoke`, `/default`
agi tools: `permissions_check`, `permissions_list` (LOW, category `permission`)

## mcp_manager.cjs (SKELETON)
Store: `%APPDATA%\MYRAA\mcp\servers.json` (env `MYRAA_MCP_DB`)

Scope honesty: registration/disable/enable are config bookkeeping only.
Transports are NOT started, tools are NOT fetched; `probe` returns
`NOT_IMPLEMENTED`. Servers are disabled, never hard-deleted.

API: `registerServer({name, transport, command|url})`, `disableServer`,
`enableServer`, `listServers`, `probe`, `status`, `createRouter`, `registerAgiTools`
HTTP: GET `/api/mcp`, `/servers`; POST `/register`, `/probe`, `/disable`, `/enable`
agi tools: `mcp_servers`, `mcp_status` (LOW, category `mcp`)

## Voice
- "tool permissions" / "who can use what"
- "allow agent <name> to use <tool>"
- "revoke agent <name> tool <tool>" (also "deny/block agent <name> ...")
- "mcp servers" / "mcp status"

## Integration notes
- Permission checks are available for callers (broker/handlers) via
  `check()`; wiring enforcement into tool execution happens with the MCP
  transport phase (next up).
- Events emitted: `permission.changed` (`{action, agent, tool}`).

## Tests
- `tests/test_permissions_mcp.cjs` (standalone with `NODE_PATH` when outside repo layout)

## Rollback
Copy `*.bak_phase24_*` back; delete `tool_permissions.cjs`, `mcp_manager.cjs`,
`tests/test_permissions_mcp.cjs`, `docs/mcp-permissions`.
