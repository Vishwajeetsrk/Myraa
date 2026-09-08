# MYRAA AI OS — Complete Installation & Setup Guide
### Version 6.0 | Multi-Agent AI Operating System

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Windows Installation](#windows-installation)
3. [macOS Installation](#macos-installation)
4. [Linux Installation](#linux-installation)
5. [First Launch & Configuration](#first-launch--configuration)
6. [API Keys Setup](#api-keys-setup)
7. [AWS Bedrock Setup](#aws-bedrock-setup)
8. [Skills & Agents Configuration](#skills--agents-configuration)
9. [Troubleshooting](#troubleshooting)
10. [Uninstall](#uninstall)

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10, macOS 12, Ubuntu 20.04 | Windows 11, macOS 14, Ubuntu 22.04 |
| RAM | 8 GB | 16 GB+ |
| Storage | 5 GB free | 20 GB+ free |
| CPU | 4-core 2.0 GHz | 8-core 3.0 GHz+ |
| GPU | Integrated | NVIDIA/AMD (for local AI) |
| Node.js | 18.x | 20.x LTS |
| Python | 3.10+ | 3.11+ |
| Internet | Required | High-speed preferred |

---

## Windows Installation

### Option A — Pre-built Installer (Recommended)

1. **Navigate to the MYRAA folder:**
   ```
   D:\Team of Vishwajeet\MYRAA\
   ```

2. **Run the installer:**
   ```
   Double-click: MYRAA-Setup.exe
   ```
   - Follow the on-screen installer prompts
   - Default install path: `C:\Users\YourName\AppData\Local\Programs\MYRAA-AI-OS\`

3. **Or launch directly (portable mode):**
   ```bat
   D:\Team of Vishwajeet\MYRAA\Start-MYRAA.bat
   ```

### Option B — Developer / Source Mode

```powershell
# 1. Ensure prerequisites
node --version     # Must be 18+
python --version   # Must be 3.10+
npm --version

# 2. Navigate to MYRAA directory
cd "D:\Team of Vishwajeet\MYRAA\resources\app"

# 3. Install Node dependencies
npm install

# 4. Install Python dependencies
pip install boto3 pillow requests anthropic google-generativeai openai groq

# 5. Launch MYRAA
cd "D:\Team of Vishwajeet\MYRAA"
.\Start-MYRAA.bat
```

### Windows Environment Variables

Open **PowerShell as Administrator** and run:

```powershell
# Google Gemini
[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-key-here", "User")

# OpenAI
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "your-key-here", "User")

# Anthropic Claude
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "your-key-here", "User")

# Groq
[System.Environment]::SetEnvironmentVariable("GROQ_API_KEY", "your-key-here", "User")

# AWS Bedrock
[System.Environment]::SetEnvironmentVariable("AWS_ACCESS_KEY_ID", "your-key-here", "User")
[System.Environment]::SetEnvironmentVariable("AWS_SECRET_ACCESS_KEY", "your-secret-here", "User")
[System.Environment]::SetEnvironmentVariable("AWS_DEFAULT_REGION", "ap-southeast-2", "User")
[System.Environment]::SetEnvironmentVariable("AWS_BEARER_TOKEN_BEDROCK", "your-bearer-token", "User")

# Weather (optional)
[System.Environment]::SetEnvironmentVariable("WEATHER_API_KEY", "your-key-here", "User")
```

> Restart MYRAA after setting environment variables.

---

## macOS Installation

### Prerequisites

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@20

# Install Python
brew install python@3.11

# Install Python packages
pip3 install boto3 pillow requests anthropic google-generativeai openai groq
```

### Build from Source (macOS)

```bash
# 1. Copy MYRAA project to Mac — recommended: ~/Applications/MYRAA/

# 2. Install dependencies
cd ~/Applications/MYRAA/resources/app
npm install

# 3. Start MYRAA server
node dist/myraa_v6_real_routes.cjs &

# 4. Open in browser (if no Electron build)
open http://localhost:3000
```

### macOS Environment Variables

Add to `~/.zshrc` or `~/.bash_profile`:

```bash
export GEMINI_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
export GROQ_API_KEY="your-key-here"
export AWS_ACCESS_KEY_ID="your-key-here"
export AWS_SECRET_ACCESS_KEY="your-secret-here"
export AWS_DEFAULT_REGION="ap-southeast-2"
export AWS_BEARER_TOKEN_BEDROCK="your-bearer-token"
export WEATHER_API_KEY="your-key-here"
```

Then reload: `source ~/.zshrc`

### macOS Gatekeeper (First Run)

```bash
# Allow the app if macOS blocks it
xattr -cr ~/Applications/MYRAA/MYRAA.app
# Or: System Settings > Privacy & Security > Allow
```

---

## Linux Installation

### Ubuntu / Debian

```bash
# 1. Install prerequisites
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip curl wget

# Upgrade Node to 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install Python packages
pip3 install boto3 pillow requests anthropic google-generativeai openai groq

# 3. Navigate to MYRAA project (~/MYRAA/ or /opt/MYRAA/)
cd ~/MYRAA/resources/app
npm install

# 4. Start MYRAA
node dist/myraa_v6_real_routes.cjs
```

### Linux Environment Variables

Add to `~/.bashrc` or `~/.profile`:

```bash
export GEMINI_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
export GROQ_API_KEY="your-key-here"
export AWS_ACCESS_KEY_ID="your-key-here"
export AWS_SECRET_ACCESS_KEY="your-secret-here"
export AWS_DEFAULT_REGION="ap-southeast-2"
export WEATHER_API_KEY="your-key-here"
```

### Linux Desktop Shortcut

Create `/usr/share/applications/myraa.desktop`:
```ini
[Desktop Entry]
Name=MYRAA AI OS
Comment=Personal AI Operating System
Exec=/bin/bash -c "cd ~/MYRAA && node resources/app/dist/myraa_v6_real_routes.cjs"
Icon=/home/user/MYRAA/resources/app/dist/myraa_avatar.png
Terminal=false
Type=Application
Categories=Utility;AI;
```

---

## First Launch & Configuration

### Step 1 — Start MYRAA

**Windows:**
```bat
D:\Team of Vishwajeet\MYRAA\Start-MYRAA.bat
```

Or double-click `MYRAA.exe` in `D:\Team of Vishwajeet\MYRAA\`

### Step 2 — Access MYRAA Interface

MYRAA runs on: **http://localhost:3000**

The Electron desktop app opens automatically.

### Step 3 — Identity Verification

MYRAA will greet you and confirm your identity. Default user: **Vishwajeet**

To change: Edit `resources/app/dist/identity.json`
```json
{
  "owner": "Your Name",
  "persona": "MYRAA",
  "version": "6.0"
}
```

---

## API Keys Setup

### Where to Get Keys

| Provider | URL | Free Tier |
|----------|-----|-----------|
| Google Gemini | https://aistudio.google.com/app/apikey | Yes |
| OpenAI | https://platform.openai.com/api-keys | $5 credit |
| Anthropic Claude | https://console.anthropic.com/ | Yes |
| Groq | https://console.groq.com/keys | Yes (fast) |
| AWS Bedrock | https://aws.amazon.com/bedrock/ | Pay per use |

### Setting Keys via `.env` File

Create `D:\Team of Vishwajeet\MYRAA\resources\app\dist\.env`:

```env
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GROQ_API_KEY=your-groq-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_DEFAULT_REGION=ap-southeast-2
AWS_BEARER_TOKEN_BEDROCK=your-bearer-token
WEATHER_API_KEY=your-weather-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

---

## AWS Bedrock Setup

### Enable Bedrock Models

1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Navigate to **Model Access**
3. Enable these models:
   - `us.anthropic.claude-haiku-4-5-20251001-v1:0`
   - `amazon.nova-pro-v1:0`
   - `amazon.nova-lite-v1:0`
   - `amazon.nova-micro-v1:0`

### Test Bedrock Connection

```python
import boto3
client = boto3.client("bedrock-runtime", region_name="ap-southeast-2")
response = client.converse(
    modelId="amazon.nova-micro-v1:0",
    messages=[{"role": "user", "content": [{"text": "Hello MYRAA!"}]}]
)
print(response["output"]["message"]["content"][0]["text"])
```

---

## Skills & Agents Configuration

### 28-Agent Workforce

| # | Agent | Specialty |
|---|-------|-----------|
| 1 | CodeMaster | Full-stack coding, debugging |
| 2 | WebArchitect | Website & UI/UX development |
| 3 | MobileBuilder | iOS, Android, React Native |
| 4 | DataScientist | Data analysis, ML/AI |
| 5 | DevOpsEngineer | CI/CD, Docker, Kubernetes |
| 6 | SecurityGuardian | Security audits, pen testing |
| 7 | DesignArtist | UI design, branding |
| 8 | WritingMaster | Content, copywriting, docs |
| 9 | ResearchAnalyst | Deep research, fact-checking |
| 10 | VideoDirector | Video analysis, editing |
| 11 | AudioEngineer | Audio processing, TTS/STT |
| 12 | ImageArtist | Image generation, analysis |
| 13 | DatabaseAdmin | SQL, NoSQL, optimization |
| 14 | APIArchitect | REST, GraphQL, OpenAPI |
| 15 | TestingEngineer | QA, Playwright, unit tests |
| 16 | SEOSpecialist | SEO analysis, optimization |
| 17 | LegalAdvisor | Legal docs, compliance |
| 18 | ProjectPlanner | Roadmaps, sprints, Agile |
| 19 | CloudArchitect | AWS, GCP, Azure |
| 20 | MLEngineer | Model training, deployment |
| 21 | BugHunter | Bug detection, code review |
| 22 | AutomationBot | Desktop/browser automation |
| 23 | FileOrganizer | File management, OCR |
| 24 | FinanceAdvisor | Budget analysis, reporting |
| 25 | HealthAdvisor | Wellness, medical research |
| 26 | EducationTutor | Teaching, explanations |
| 27 | BusinessStrategist | Strategy, market analysis |
| 28 | PersonalAssistant | Scheduling, reminders, tasks |

### Skills Directories (Auto-Discovered)

- `C:\Users\Vishwajeet\Downloads\Skills\` — Universal skills library (139 skills)
- `D:\Team of Vishwajeet\.agents\skills\` — Project skills
- `D:\Team of Vishwajeet\MYRAA\resources\app\dist\` — Core MYRAA skills

---

## Troubleshooting

### MYRAA won't start

```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000
# Kill that process, then restart
.\Start-MYRAA.bat
```

### API keys not working

```powershell
# Verify
echo $env:GEMINI_API_KEY
```

### Logo/Icons not updating

```powershell
python "C:\Users\Vishwajeet\.gemini\antigravity-ide\brain\833a025b-89ea-414e-9ac9-62c0d3f731ad\scratch\apply_new_logo.py"
```

### Node module errors

```powershell
cd "D:\Team of Vishwajeet\MYRAA\resources\app"
Remove-Item node_modules -Recurse -Force
npm install
```

---

## Uninstall

### Windows (Installer)
```
D:\Team of Vishwajeet\MYRAA\Uninstall MYRAA.exe
```

### Windows (Dev/Portable)
```powershell
Remove-Item "D:\Team of Vishwajeet\MYRAA" -Recurse -Force
Remove-Item "$env:LOCALAPPDATA\Programs\MYRAA-AI-OS" -Recurse -Force
```

### macOS
```bash
rm -rf ~/Applications/MYRAA/
```

### Linux
```bash
rm -rf ~/MYRAA/
sudo rm /usr/share/applications/myraa.desktop
```

---

## Quick Reference

### Voice / Text Commands

| Command | Action |
|---------|--------|
| "Open terminal" | Launch terminal |
| "Search the web for X" | Web search |
| "Analyze this image" | Image analysis |
| "Write code for X" | Code generation |
| "Fix this bug" | Bug fixing |
| "Deploy to X" | Deployment |
| "Run security scan" | Security audit |
| "Generate SEO report" | SEO analysis |
| "Review my code" | Code review |
| "Show agent workforce" | Agent dashboard |
| "Reload skills" | Refresh skills |

### Default Ports

| Service | Port |
|---------|------|
| MYRAA Main | 3000 |
| Skills API | 3000/api/skills |
| Agent API | 3000/api/agents |
| Bedrock Bridge | 3000/api/bedrock |

---

## Key File Locations

| Item | Path |
|------|------|
| Main Directory | `D:\Team of Vishwajeet\MYRAA\` |
| Executable | `D:\Team of Vishwajeet\MYRAA\MYRAA.exe` |
| Launcher | `D:\Team of Vishwajeet\MYRAA\Start-MYRAA.bat` |
| Logs | `D:\Team of Vishwajeet\MYRAA\logs\` |
| Data / Memory | `D:\Team of Vishwajeet\MYRAA\.myraa-data\` |
| Core Dist | `D:\Team of Vishwajeet\MYRAA\resources\app\dist\` |
| Logo / Icons | `D:\Team of Vishwajeet\MYRAA\resources\app\dist\myraa_avatar.png` |
| Skills | `C:\Users\Vishwajeet\Downloads\Skills\` |

---

*MYRAA — Your Personal AI Operating System*
*Version 6.0 | Built with love for Vishwajeet*
