# MYRAA Universal Upgrade - PRD and Execution Plan

Date: 2026-11-20
Status: LIVING DOCUMENT. Statuses are updated only after tests pass.

## 1. Problem

MYRAA can see the desktop, drive Excel, review VBA, learn workflow candidates, and compile them into skills, but the chain stops short of acting: replay is missing, client research is not structured, cross-app work is not orchestrated, and there is no visible action playback or performance telemetry.

## 2. Goals

1. Close the observe -> learn -> compile -> **execute** -> verify loop.
2. Make client research evidence-based with mandatory "Website: Not found" behaviour.
3. Deepen Excel so learned workflows can perform real transformations.
4. Expose one IDE state surface and one performance telemetry surface.
5. Give the user a visible, pauseable Action Center.
6. Never fabricate a result; every action carries observed/planned/attempted/succeeded/failed status.

## 3. Non-goals this cycle

- Live legal advice or legal compliance claims.
- Actual payment, OAuth, DNS, hosting, or EV certificate setup.
- Replacement of the 3D companion, voice, UI, memory, skills, MCP, or any existing service.
- Automatic push to remote without explicit owner approval.

## 4. Delivery order and status

| # | Increment | Status | Acceptance |
| --- | --- | --- | --- |
| 1 | PRD + plan | DONE | This document. |
| 2 | Client discovery engine | DONE | Strict evidence labels; "Website: Not found"; source URLs; verified Excel writeback (Test D + E). |
| 3 | Skill replay execution + Action Center | DONE | Step/run, pause/resume/stop, real action handlers, audit traces, additive Action Center page (Test C). |
| 4 | Excel depth | DONE | Sort, filter, tables, named ranges, validation, conditional format, column ops, all live-tested. |
| 5 | IDE state endpoint | DONE | Read-only git + UIA focus/window; diagnostics honestly NOT_IMPLEMENTED. |
| 6 | Performance telemetry | DONE | Latency counters, failure rate, event emission, no continuous capture. |
| 7 | UX/UI Action Center page | DONE | Additive page at `/action-center`; existing UI untouched. |
| 8 | Tests, fixes, capability recheck | DONE | Direct module tests + full HTTP integration; two COM defects found and fixed. |
| 9 | Push | BLOCKED | Requires explicit owner approval. |

## 5. Evidence policy

Every research or action result must be one of: `verified`, `likely`, `uncertain`, `not_found`.
No domain, phone, email, address, source URL, or success state is invented.
Unavailable means: `Website: Not found`, `Phone number not verified`, `Not found`.

## 6. Risks

- Excel COM actions can affect the user's live workbook. Replay is opt-in, step-verified, and uses throwaway workbooks in tests.
- Power actions remain token-gated and are never executed in tests.
- Browser research depends on network availability; failures are reported, not hidden.

## 7. Definition of done

An increment is DONE only when code exists, a live or unit test passed, and `CAPABILITY_MAP.md` is updated.
