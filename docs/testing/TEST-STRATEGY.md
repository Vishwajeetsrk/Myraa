# MYRAA Testing Strategy & Quality Assurance

## Overview

MYRAA enforces a comprehensive test strategy spanning unit, integration, quality gate, and acceptance test tiers.

## Testing Tiers

### 1. Unit Tests
- Fast, isolated component and service verification.
- Validates pure utility functions: token generation, route mapping, icon retrieval, and Markdown parsing.

### 2. Service & Integration Tests
- Verifies inter-service workflows:
  - GitService operations (status, commit, branch)
  - ProjectDetectionService package.json introspection
  - AGI capability registration and health monitoring
  - Express API route handling

### 3. Automated Quality Gates
- **Zero-Emoji Check**: Scans output text and rendered strings for Unicode emoji characters.
- **WCAG AA Contrast**: Calculates mathematical luminosity contrast ratios across text/surface pairings.
- **Safety Audit**: Confirms no non-additive or destructive file operations occurred.

### 4. Acceptance Tests
- Executed via `autonomousEngine.runAcceptanceTest()`.
- Verifies:
  - Mini PRD generation for sample prompts.
  - Multi-round user design feedback adaptation (e.g., "Make it more premium", "Reduce empty space").
  - Token adjustments and CSS variable output.
  - Dynamic icon catalog integrity.
