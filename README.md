# MediCheck System — Backend

Medical Diagnosis Expert System backend for a university AI course project.
Uses **SWI-Prolog** as the forward-chaining inference engine, **PostgreSQL** for persistence, and **Express.js + TypeScript** as the REST API layer.

> The frontend lives in a **separate repo** (`Medicheck-frontend`, Next.js). Never add frontend code here.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Setup](#setup)
5. [Environment Variables](#environment-variables)
6. [Available Scripts](#available-scripts)
7. [API Endpoints](#api-endpoints)
8. [How the Inference Engine Works](#how-the-inference-engine-works)
9. [Diseases, Rules & Symptoms](#diseases-rules--symptoms)
10. [Database Schema](#database-schema)
11. [Testing Scenarios](#testing-scenarios)
12. [Conventions](#conventions)
13. [Gotchas & Troubleshooting](#gotchas--troubleshooting)
14. [Production Build](#production-build)

---

## Architecture

Two runtime layers that communicate via subprocess:

```
┌─────────────────────────────────┐
│        Next.js Frontend         │  (separate repo: Medicheck-frontend)
└────────────────┬────────────────┘
                 │ HTTP (REST)
┌────────────────▼────────────────┐
│      Express.js API (Node)      │  src/
│  routes → diagnosisService      │
│  prologBridge (child_process)   │
└────────────────┬────────────────┘
                 │ stdin/stdout (JSON)
┌────────────────▼────────────────┐
│       SWI-Prolog Engine         │  prolog/
│  bridge.pl → inference_engine   │
│  → knowledge_base               │
└─────────────────────────────────┘
                 │
┌────────────────▼────────────────┐
│           PostgreSQL            │  diagnoses + symptoms_catalog tables
└─────────────────────────────────┘
```

**Prolog layer** (`prolog/`): holds the knowledge base (IF-THEN rules) and forward chaining engine. `bridge.pl` is the entry point — it reads CLI args, runs inference, and prints a JSON result to stdout.

**Node layer** (`src/`): Express API that spawns `swipl` via `child_process.spawn`, passes symptoms as CLI args, parses JSON from stdout, persists results to PostgreSQL, and returns the response.

---

## Project Structure

```
Medicheck-system/
├── prolog/
│   ├── knowledge_base.pl      # Disease facts, symptom lists, IF-THEN rules, advice
│   ├── inference_engine.pl    # Forward chaining algorithm
│   └── bridge.pl              # CLI entry point — outputs diagnosis JSON to stdout
├── src/
│   ├── server.ts              # Express app entry point
│   ├── config/
│   │   └── db.ts              # PostgreSQL connection pool (pg)
│   ├── routes/
│   │   ├── diagnosis.ts       # POST /api/diagnosis
│   │   ├── history.ts         # GET  /api/history/:sessionId
│   │   └── symptoms.ts        # GET  /api/symptoms
│   ├── services/
│   │   ├── prologBridge.ts    # Spawns swipl subprocess, parses JSON output
│   │   └── diagnosisService.ts# Orchestrates: Prolog → DB → response
│   ├── models/
│   │   └── schema.sql         # CREATE TABLE statements + symptom seed data
│   └── types/
│       └── index.ts           # Shared TypeScript interfaces
├── .claude/
│   └── agents/
│       ├── prolog-expert.md   # Sub-agent: Prolog knowledge base & inference
│       ├── api-builder.md     # Sub-agent: Express routes & services
│       └── test-runner.md     # Sub-agent: test validation
├── .env.example
├── CLAUDE.md
├── package.json
└── tsconfig.json
```

---

## Prerequisites

### 1. SWI-Prolog

The inference engine runs as a subprocess. `swipl` must be on your `PATH`.

**macOS (Homebrew):**
```bash
brew install swi-prolog
```

**Ubuntu / Debian:**
```bash
sudo apt-get install swi-prolog
```

**Windows:** Download installer from https://www.swi-prolog.org/Download.html

Verify installation:
```bash
swipl --version
```

### 2. PostgreSQL 14+

**macOS (Homebrew):**
```bash
brew install postgresql@14

# Start the service (and auto-start on login)
brew services start postgresql@14

# If you hit a role error on first run, create your user role:
/opt/homebrew/opt/postgresql@14/bin/createuser -s $(whoami)
```

**Ubuntu / Debian:**
```bash
sudo apt-get install postgresql
sudo service postgresql start
```

Create the database:
```bash
createdb medicheck
```

Verify:
```bash
psql medicheck -c "SELECT version();"
```

### 3. Node.js 18+

```bash
node --version   # should be >= 18
```

### 4. pnpm

```bash
npm install -g pnpm
```

---

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd Medicheck-system

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Open .env and set DATABASE_URL (see Environment Variables below)

# 4. Initialise the database
#    Creates tables and seeds the symptoms catalog
pnpm run db:init

# 5. Start the development server
pnpm run dev
```

Server runs at `http://localhost:4000` by default (configurable via `PORT` in `.env`).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:password@localhost:5432/medicheck

# Server port (default: 4000)
PORT=4000

# CORS origin — set to your frontend URL in production
CORS_ORIGIN=http://localhost:3000

# Node environment
NODE_ENV=development
```

| Variable       | Required | Default                  | Description                          |
|----------------|----------|--------------------------|--------------------------------------|
| `DATABASE_URL` | Yes      | —                        | PostgreSQL connection string         |
| `PORT`         | No       | `4000`                   | Express server port                  |
| `CORS_ORIGIN`  | No       | `*`                      | Allowed CORS origin                  |
| `NODE_ENV`     | No       | `development`            | `development` or `production`        |

---

## Available Scripts

```bash
pnpm run dev        # Start dev server with ts-node (hot reloads on file changes)
pnpm run build      # Compile TypeScript → dist/
pnpm start          # Run compiled dist/server.js (production)
pnpm run db:init    # Create tables + seed symptoms catalog (reads DATABASE_URL from .env)
```

**Test Prolog directly (without starting the server):**
```bash
swipl -g "main" -t halt prolog/bridge.pl -- \
  --symptoms "fever,chills,headache,sweating,muscle_pain" \
  --duration "more_than_2_weeks"
```

---

## API Endpoints

### `GET /health`

Health check.

```json
{ "status": "ok", "service": "medicheck-system", "timestamp": "2026-03-22T10:00:00.000Z" }
```

---

### `GET /api/symptoms`

Returns the full symptom catalog grouped by disease category. The frontend uses this to render the symptom selection UI.

**Response:**
```json
{
  "categories": {
    "malaria": [
      { "name": "fever",        "display_name": "Fever" },
      { "name": "chills",       "display_name": "Chills" },
      { "name": "headache",     "display_name": "Headache" },
      { "name": "sweating",     "display_name": "Sweating" },
      { "name": "muscle_pain",  "display_name": "Muscle Pain" },
      { "name": "nausea",       "display_name": "Nausea" },
      { "name": "vomiting",     "display_name": "Vomiting" }
    ],
    "diarrhoea": [ "..." ],
    "HIV/AIDS":  [ "..." ]
  },
  "all_symptoms": [
    { "name": "fever", "display_name": "Fever", "category": "malaria" },
    "..."
  ]
}
```

---

### `POST /api/diagnosis`

Runs the Prolog forward-chaining inference engine on the submitted symptoms and returns the full diagnosis with reasoning chain.

**Request body:**
```json
{
  "symptoms": ["fever", "chills", "headache", "sweating", "muscle_pain"],
  "symptom_duration": "more_than_2_weeks",
  "session_id": "a1b2c3d4-e5f6-..."
}
```

| Field              | Type       | Required | Description                                                          |
|--------------------|------------|----------|----------------------------------------------------------------------|
| `symptoms`         | `string[]` | Yes      | Array of symptom name strings (see `/api/symptoms` for valid names)  |
| `symptom_duration` | `string`   | No       | `less_than_2_weeks` \| `more_than_2_weeks` \| `unknown`             |
| `session_id`       | `string`   | No       | UUID for session tracking. Auto-generated if omitted.                |

**Response:**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "diagnosis_id": 42,
  "diagnosis": "malaria",
  "confidence": "high",
  "rules_fired": ["malaria_high"],
  "matched_symptoms": ["fever", "chills", "headache", "sweating", "muscle_pain"],
  "reasoning": "Forward chaining inference initiated with 5 reported symptom(s). [Rule malaria_high fired: (fever, chills, headache, sweating, muscle_pain) → malaria (HIGH).] Conclusion: malaria diagnosed with HIGH confidence.",
  "advice": "Seek immediate medical attention. A blood smear or RDT test is required to confirm Malaria. Do not self-medicate with antimalarials without laboratory confirmation.",
  "symptoms_submitted": ["fever", "chills", "headache", "sweating", "muscle_pain"],
  "created_at": "2026-03-22T10:00:00.000Z"
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| `400`  | `symptoms` missing, empty, or not an array |
| `400`  | Invalid `symptom_duration` value |
| `500`  | Prolog subprocess failed, DB error, or `swipl` not found |

---

### `GET /api/history/:sessionId`

Returns all past diagnoses for a session UUID, newest first.

**Example:** `GET /api/history/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Response:**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "count": 2,
  "diagnoses": [
    {
      "session_id": "a1b2c3d4-...",
      "diagnosis_id": 42,
      "diagnosis": "malaria",
      "confidence": "high",
      "rules_fired": ["malaria_high"],
      "matched_symptoms": ["fever", "chills", "headache", "sweating", "muscle_pain"],
      "reasoning": "...",
      "advice": "...",
      "symptoms_submitted": ["fever", "chills", "headache", "sweating", "muscle_pain"],
      "created_at": "2026-03-22T10:00:00.000Z"
    }
  ]
}
```

---

## How the Inference Engine Works

The Prolog engine in `prolog/inference_engine.pl` implements **forward chaining** — a data-driven reasoning strategy:

```
Reported Symptoms (Facts)
        ↓
  Working Memory initialised
        ↓
  Apply Exclusion Rules
  (remove impossible diseases)
        ↓
  Scan ALL diagnostic rules:
    if ALL required symptoms ∈ Working Memory → Rule FIRES
        ↓
  Collect all fired rules + derived facts
        ↓
  Select best: high > medium > possible
        ↓
  Build reasoning chain string
        ↓
  Output JSON
```

**Step-by-step:**

1. **Working Memory** — initialised with all reported symptom atoms (e.g., `[fever, chills, headache]`)
2. **Exclusion rules** — diseases with a missing gatekeeper symptom are removed before inference runs:
   - Malaria excluded if `chills` is absent
   - Diarrhoea excluded if `loose_stools` is absent
   - HIV/AIDS excluded if `symptom_duration = less_than_2_weeks`
3. **Rule scanning** — every rule in the knowledge base is checked. A rule fires if **all** of its required symptoms are present in Working Memory and the disease is not excluded
4. **Derived facts** — all fired rules are recorded with their rule ID, disease, confidence, and matched symptoms
5. **Best selection** — confidence priority: `high > medium > possible`. If multiple diseases fire at the same confidence level, all are reported
6. **Reasoning chain** — a human-readable string is built listing which rules fired and why
7. **Fallback** — if no rules fired: `"Unable to determine diagnosis. Please consult a medical professional."`

---

## Diseases, Rules & Symptoms

### Malaria

**Gatekeeper:** `chills` must be present. Without it, malaria is excluded entirely.

| Symptom       | Display Name  |
|---------------|---------------|
| `fever`       | Fever         |
| `chills`      | Chills        |
| `headache`    | Headache      |
| `sweating`    | Sweating      |
| `muscle_pain` | Muscle Pain   |
| `nausea`      | Nausea        |
| `vomiting`    | Vomiting      |

| Rule ID          | Confidence | Required Symptoms                                      |
|------------------|------------|--------------------------------------------------------|
| `malaria_high`   | HIGH       | fever, chills, headache, sweating, muscle_pain         |
| `malaria_medium` | MEDIUM     | fever, chills, nausea, vomiting                        |
| `malaria_possible`| POSSIBLE  | fever, chills, sweating, headache                      |

---

### Diarrhoea

**Gatekeeper:** `loose_stools` must be present. Without it, diarrhoea is excluded entirely.

| Symptom            | Display Name      |
|--------------------|-------------------|
| `loose_stools`     | Loose Stools      |
| `stomach_cramps`   | Stomach Cramps    |
| `abdominal_pain`   | Abdominal Pain    |
| `nausea`           | Nausea            |
| `dehydration`      | Dehydration       |
| `mild_fever`       | Mild Fever        |
| `loss_of_appetite` | Loss of Appetite  |
| `bloating`         | Bloating          |

| Rule ID              | Confidence | Required Symptoms                              |
|----------------------|------------|------------------------------------------------|
| `diarrhoea_high`     | HIGH       | loose_stools, stomach_cramps, dehydration      |
| `diarrhoea_medium`   | MEDIUM     | loose_stools, abdominal_pain, nausea           |
| `diarrhoea_possible` | POSSIBLE   | loose_stools, loss_of_appetite, bloating       |

---

### HIV/AIDS

**Gatekeeper:** `symptom_duration` must be `more_than_2_weeks` or `unknown`. Duration `less_than_2_weeks` excludes HIV/AIDS.

| Symptom               | Display Name        |
|-----------------------|---------------------|
| `weight_loss`         | Weight Loss         |
| `persistent_fatigue`  | Persistent Fatigue  |
| `night_sweats`        | Night Sweats        |
| `swollen_lymph_nodes` | Swollen Lymph Nodes |
| `recurring_fever`     | Recurring Fever     |
| `oral_thrush`         | Oral Thrush         |
| `shortness_of_breath` | Shortness of Breath |
| `frequent_infections` | Frequent Infections |

| Rule ID       | Confidence | Required Symptoms                                                        |
|---------------|------------|--------------------------------------------------------------------------|
| `hiv_high`    | HIGH       | weight_loss, persistent_fatigue, night_sweats, swollen_lymph_nodes       |
| `hiv_medium`  | MEDIUM     | recurring_fever, persistent_fatigue, swollen_lymph_nodes, weight_loss    |
| `hiv_possible`| POSSIBLE   | oral_thrush, weight_loss, night_sweats                                   |

---

### Fallback

If no rule fires across all three diseases:

```
"Unable to determine diagnosis. Please consult a medical professional."
```

---

## Database Schema

Run `pnpm run db:init` to apply. Full SQL is in `src/models/schema.sql`.

### `diagnoses`

Stores every inference result.

| Column            | Type          | Description                                     |
|-------------------|---------------|-------------------------------------------------|
| `id`              | SERIAL PK     | Auto-incrementing ID                            |
| `session_id`      | UUID          | Groups diagnoses from the same user session     |
| `symptoms`        | JSONB         | Array of submitted symptom strings              |
| `diagnosis`       | VARCHAR(100)  | Disease name or fallback message                |
| `confidence`      | VARCHAR(20)   | `high`, `medium`, `possible`, or `none`         |
| `rules_fired`     | JSONB         | Array of rule IDs that fired                    |
| `matched_symptoms`| JSONB         | Symptoms that matched fired rules               |
| `reasoning`       | TEXT          | Human-readable reasoning chain                  |
| `advice`          | TEXT          | Follow-up medical advice                        |
| `created_at`      | TIMESTAMPTZ   | Timestamp of diagnosis                          |

### `symptoms_catalog`

Used by `GET /api/symptoms`. Pre-seeded on `db:init`.

| Column            | Type          | Description                           |
|-------------------|---------------|---------------------------------------|
| `id`              | SERIAL PK     | Auto-incrementing ID                  |
| `name`            | VARCHAR(60)   | Atom identifier (e.g. `loose_stools`) |
| `display_name`    | VARCHAR(100)  | Human-readable (e.g. `Loose Stools`)  |
| `disease_category`| VARCHAR(60)   | `malaria`, `diarrhoea`, or `HIV/AIDS` |

---

## Testing Scenarios

**Test via curl (server must be running):**
```bash
curl -s -X POST http://localhost:4000/api/diagnosis \
  -H "Content-Type: application/json" \
  -d '{"symptoms":["fever","chills","headache","sweating","muscle_pain"]}' | jq
```

**Test Prolog directly (no server needed):**
```bash
swipl -g "main" -t halt prolog/bridge.pl -- \
  --symptoms "fever,chills,headache,sweating,muscle_pain" \
  --duration "more_than_2_weeks"
```

### Key Scenarios

| Symptoms Submitted | Duration | Expected Diagnosis | Expected Confidence |
|--------------------|----------|--------------------|---------------------|
| fever, chills, headache, sweating, muscle_pain | any | Malaria | HIGH |
| fever, chills, nausea, vomiting | any | Malaria | MEDIUM |
| fever, chills, sweating, headache | any | Malaria | POSSIBLE |
| fever, headache, sweating *(no chills)* | any | Fallback (malaria excluded) | — |
| loose_stools, stomach_cramps, dehydration | any | Diarrhoea | HIGH |
| loose_stools, abdominal_pain, nausea | any | Diarrhoea | MEDIUM |
| stomach_cramps, nausea *(no loose_stools)* | any | Fallback (diarrhoea excluded) | — |
| weight_loss, persistent_fatigue, night_sweats, swollen_lymph_nodes | more_than_2_weeks | HIV/AIDS | HIGH |
| weight_loss, persistent_fatigue, night_sweats, swollen_lymph_nodes | less_than_2_weeks | Fallback (HIV excluded) | — |
| bloating *(alone)* | any | Fallback | — |
| *(empty array)* | any | 400 error | — |

---

## Conventions

- **TypeScript strict mode** throughout. All functions have explicit return types.
- **`pg` Pool only** — no ORM. Parameterized queries (`$1, $2`) everywhere. No string concatenation in SQL.
- **Prolog** uses `snake_case` for all predicates and atoms.
- **API responses** follow `{ success: boolean, data?: T, error?: string }` shape.
- **Environment variables** via `.env` + dotenv. Never hardcode credentials.
- **Async/await** over raw Promise chains. All Prolog subprocess calls wrapped in `try/catch`.
- **`child_process.spawn`** over `exec` — avoids shell injection and buffer limits.

---

## Gotchas & Troubleshooting

### `swipl: command not found`
SWI-Prolog is not on your `PATH`. Install it (see [Prerequisites](#prerequisites)) and verify with `swipl --version`.

### PostgreSQL socket error on `db:init`
```
psql: error: connection to server on socket "/tmp/.s.PGSQL.5432" failed
```
PostgreSQL isn't running. On macOS:
```bash
brew services start postgresql@14
```
On Ubuntu:
```bash
sudo service postgresql start
```

### Role does not exist (macOS)
```bash
/opt/homebrew/opt/postgresql@14/bin/createuser -s $(whoami)
```

### JSON parse error from Prolog bridge
The Prolog bridge must write **only** the JSON object to stdout. Any stray `write/1`, `writeln/1`, or `format/2` calls in `.pl` files will corrupt the output and cause a parse failure on the Node side. Use `debug/3` for Prolog-side debugging instead, or temporarily redirect debug output to stderr.

### `ts-node` not found on `pnpm run dev`
```bash
pnpm install   # ensure devDependencies are installed
```

### Prolog inference returns stale results
If you test Prolog interactively and re-query without restarting `swipl`, leftover `assert`-ed facts from a previous session can corrupt results. Always use `retractall/1` before re-asserting, or restart `swipl`.

---

## Production Build

```bash
# Compile TypeScript
pnpm run build

# Start compiled server
pnpm start
```

Set `NODE_ENV=production` and `CORS_ORIGIN=<your-frontend-url>` in `.env` before deploying.
