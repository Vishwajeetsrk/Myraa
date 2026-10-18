# MYRAA User Preferences Engine

## Overview

User preferences govern UI themes, visual density, audio feedback, model selection, and autonomous execution boundaries.

## Durable Preference Model

- **Location & Weather**: User-set geographical preferences persist across application restarts.
- **Theme & Appearance**: Dark/Light mode, custom accent colors, font scaling, and motion preferences.
- **Voice & Audio**: Synthesizer voice profile, speech rate, volume, and listening sensitivity.
- **Zero-Emoji Rule**: Unconditionally preserved across all user custom profiles.

## Storage Hierarchy

1. Environment variables (`process.env.MYRAA_*`)
2. Local user configuration files (`.myraa-data/config/preferences.json`)
3. Built-in system defaults (`version.json`, `package.json`)
