# MYRAA Learning OS + Compute — Release Checklist (Phase 8)

Run top to bottom after applying Phases 1-7. Every item must show the stated
evidence. Anything else is a regression — stop and report.

## 0. Baseline (untouched systems)
- [ ] Avatar renders and animates as before (no asset/state changes).
- [ ] Girl voice identical (speechSynthesis pitch path; Fish Audio untouched).
- [ ] Chat replies work; voice conversation works.
- [ ] Desktop control + approvals behave as before.
- [ ] `/api/integrations` shows prior statuses, none fake-green.

## 1. Security (Phase 1)
- [ ] `GET /api/screen-awareness/status` -> `enabled:false` on fresh profile.
- [ ] `POST /api/desktop/capture` -> 403 `SCREEN_AWARENESS_CONSENT_REQUIRED`.
- [ ] Consent on -> capture returns `ok:true` + image.
- [ ] From LAN without token: capture + awareness routes -> 401/403.

## 2. Course Studio (Phase 2+3)
- [ ] Sidebar shows Course Studio; backend-missing banner appears iff Phase 2 absent.
- [ ] Create course -> outline job `queued>running>completed`, progress 0->1 real.
- [ ] Build lesson -> scenes + narration text + quiz; Narrate speaks, Stop works.
- [ ] Quiz score saves; Mark complete persists progress.

## 4. PDF/OCR (Phase 4)
- [ ] `/api/office/read` on real PDF -> `method:pdf-parse` + pageCount.
- [ ] OCR status endpoint/module reports installed/unavailable honestly.

## 5. Awareness (Phase 5)
- [ ] Awareness view: OFF default, L0 only; enable -> L1/L3 live, L2 after Phase 4, L4/L5 unavailable.
- [ ] Read context lists windows + foreground; timeline grows; Delete clears.

## 6. Learning (Phase 6)
- [ ] Quiz attempts recorded per concept; reviews endpoint shows due queue.
- [ ] Course detail shows Review due + Practice buttons; weak list appears at 3+ attempts <0.6.

## 7. Compute (Phase 7)
- [ ] Compute Center: local CPU-only (unless GPU present), quota UNKNOWN.
- [ ] Kaggle disabled -> submit refuses PROVIDER_DISABLED, job recorded CREATED.
- [ ] Heartbeat import -> worker online; phi-3-mini-class submit QUEUED + outbox file.
- [ ] 20GB-class model refused MODEL_VRAM_INSUFFICIENT without sharding.
- [ ] Result import (job_id shape) completes + metrics lift; blocked/load_failed map correctly.
- [ ] CLI transport: kernel dir staged private+GPU; sync on file job refuses honestly.
- [ ] Chat: "how much vram" / "cancel the gpu job" / "use local instead" route correctly; "commit these changes" still git_commit.

## 8. Data & rollback
- [ ] Backups `*.bak_phase*` exist for every touched file.
- [ ] Rollback procedure per script header restores prior behavior.
- [ ] No secrets in logs, job JSON, outbox payloads, or UI (spot-check).
- [ ] Supabase migration v1 marked NEEDS_LIVE_PG_VERIFY until run against real Postgres.
