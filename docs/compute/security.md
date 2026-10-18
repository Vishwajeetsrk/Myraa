# MYRAA Compute Security (Phase 7)

- Secrets: sanitizeSecrets() scrubs API keys, tokens, bearer strings, private
  keys, and key=value assignments from job inputs, caps, results, and errors
  before persistence. Redaction counts are recorded. Tested.
- Existing secret manager reused (secrets.json -> env -> vault). Kaggle
  credentials are never requested, stored, or sent anywhere.
- Worker output is untrusted: sanitized on import; artifacts are data files,
  never executed by MYRAA.
- Approval posture: Kaggle dispatch is inherently approval-based (the user
  physically moves job/result JSON). Training/publishing remain explicit.
- Privacy: a job marked private (spec.privacy='high' or project policy) is
  refused for KAGGLE with PRIVACY_REJECTED unless explicitly allowed.
- LAN: /api/compute/* is SENSITIVE (60/min + pair token), same as other
  mutating surfaces. Loopback (the app) unaffected.
- Logs/events never include secrets (tested via redaction counts).
