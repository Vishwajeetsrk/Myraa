# Tool Permissions + MCP Manager (Phase 24/25)

Two modules: per-agent tool permission policy, and the MCP server registry
with a live stdio transport (the http transport is still pending).

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

## mcp_manager.cjs + mcp_stdio_client.cjs (stdio transport LIVE)
Store: `%APPDATA%\MYRAA\mcp\servers.json` (env `MYRAA_MCP_DB`)

The stdio transport is real: `probe` spawns the registered command (shell
resolves `npx.cmd` etc.), runs the MCP `initialize` handshake, then
`tools/list` and caches normalized tools (cap 200; schemas over 4KB are
replaced by a placeholder). `callTool` re-spawns, handshakes, and issues
`tools/call` (`{name, tool, args?, timeoutMs?}`). Process trees are killed
via `taskkill /T /F` on win32. Honest error codes: `TIMEOUT`,
`SERVER_EXITED`, `SPAWN_ERROR`, `RPC_ERROR`, `VALIDATION`, `DISABLED`,
`NOT_FOUND`; the http transport still returns `NOT_IMPLEMENTED`.
Servers are disabled, never hard-deleted.

API: `registerServer({name, transport, command|url})`, `disableServer`,
`enableServer`, `listServers`, `probeServer` (alias `probe`, async),
`listTools`, `callTool`, `listPresets`, `addPreset({preset, name?, ...vars})`,
`status`, `createRouter`, `registerAgiTools`
HTTP: GET `/api/mcp`, `/servers`, `/servers/:name/tools`, `/presets`; POST `/register`, `/probe`, `/call`, `/presets/add`, `/disable`, `/enable`
Presets: curated official MCP servers (filesystem, memory, everything, git, fetch, time, sqlite, rea); `filesystem` needs `dir`, `git` needs `dir`, `sqlite` needs `db`; npx presets need Node 18+ (rea needs Node 22+), uvx presets need uv. `rea` (morluto/rea, MIT) is fully live-verified through MYRAA: probe 207 tools, real `inspect_electron_fuses` call on MYRAA.exe. Nothing downloads until the first probe/call. Tool cache cap: 300 per server (`MAX_TOOLS`).
agi tools: `mcp_servers`, `mcp_status` (LOW), `mcp_probe` (MEDIUM), `mcp_call` (HIGH, approval-gated) - category `mcp`

## Voice
- "tool permissions" / "who can use what"
- "allow agent <name> to use <tool>"
- "revoke agent <name> tool <tool>" (also "deny/block agent <name> ...")
- "mcp servers" / "mcp status"
- "probe mcp <server-name>" (runs the handshake and reports tool count)

## Integration notes
- Permission checks are available for callers (broker/handlers) via
  `check()`; `mcp_call` rides the tool engine's HIGH-risk approval path.
  Engine-wide permission enforcement remains a follow-up.
- Events emitted: `permission.changed` (`{action, agent, tool}`).

## Tests
- `tests/test_permissions_mcp.cjs` - policy + registry (34 checks,
  standalone with `NODE_PATH` when outside repo layout)
- `tests/test_mcp_transport.cjs` - 32 checks: registry, validation, presets,
  and honest errors; nothing is spawned in the default run. Real-server
  verification is env-gated (`MYRAA_MCP_LIVE=1`) and runs against the
  official `npx -y @modelcontextprotocol/server-everything` - probe,
  `tools/list`, and a real `tools/call`. No fake server fixtures ship.

## Rollback
Copy `*.bak_phase24_*` / `*.bak_phase25_*` / `*.bak_phase25b_*` back; delete
`tool_permissions.cjs`, `mcp_manager.cjs`, `mcp_stdio_client.cjs`,
`tests/test_permissions_mcp.cjs`, `tests/test_mcp_transport.cjs`,
`docs/mcp-permissions`.
