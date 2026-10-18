# MYRAA Security Checklist

## Security Core Requirements

1. **Local Isolation & Zero Telemetry Leakage**:
   - Model requests route only through configured providers with explicit API keys.
   - User code, memory transcripts, and local project directories are never uploaded to untrusted public clouds.

2. **Secret & Credential Management**:
   - Zero hardcoded API keys or passwords in source code.
   - Use `.env` or encrypted local stores with `.gitignore` exclusion.

3. **Safe Shell Execution**:
   - Shell commands executed through `terminal_runner.cjs` run in dedicated subshells.
   - Dangerous recursive commands (`rm -rf /`, `format C:`) are strictly intercepted and blocked by safety filters.

4. **Electron Desktop Security**:
   - Context isolation enabled (`contextIsolation: true`).
   - Node integration disabled in renderer webviews (`nodeIntegration: false`).
   - Secure IPC communication via validated channels.
