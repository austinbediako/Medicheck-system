# MediCheck System

Medical Diagnosis Expert System backend — Prolog inference engine + Express/TypeScript API + PostgreSQL.

## Quick Reference

- `npm run dev` — start Express dev server (ts-node, port 5000)
- `npm run build` — compile TypeScript to dist/
- `npm test` — run Jest tests
- `swipl -g "consult('prolog/bridge.pl'), diagnose([fever,chills,headache,sweating,muscle_pain], Result), writeln(Result), halt."` — test Prolog directly

## Architecture

Two runtime layers that communicate via subprocess:

1. **Prolog layer** (`prolog/`): knowledge base rules + forward chaining engine. Entry point is `bridge.pl` which accepts a symptom list and outputs JSON.
2. **Node layer** (`src/`): Express API that spawns `swipl` via `child_process`, pipes symptoms in, parses JSON out, saves results to PostgreSQL.

The frontend is a SEPARATE repo (`Medicheck-frontend`). Never create frontend code here.

## Project Structure
prolog/
knowledge_base.pl    — disease facts and IF-THEN rules
inference_engine.pl  — forward chaining algorithm
bridge.pl            — stdin/stdout JSON interface
src/
server.ts            — Express entry point
config/db.ts         — pg Pool connection
routes/              — diagnosis.ts, history.ts, symptoms.ts
services/            — prologBridge.ts, diagnosisService.ts
models/schema.sql    — CREATE TABLE statements
types/index.ts       — shared interfaces

## Conventions

- TypeScript strict mode. All functions have explicit return types.
- Use `pg` Pool (not an ORM). Parameterized queries only.
- Prolog files use snake_case for predicates and atoms.
- API responses follow: `{ success: boolean, data?: T, error?: string }`
- Environment variables in `.env`, loaded via dotenv. Never hardcode credentials.
- Prefer `async/await` over raw promises. Wrap Prolog subprocess calls in try/catch.

## Diseases and Rules

Three diseases. Each has a unique gatekeeper symptom:
- **Malaria**: gatekeeper = `chills`. Without chills, exclude malaria.
- **Diarrhoea**: gatekeeper = `loose_stools`. Without loose stools, exclude diarrhoea.
- **HIV/AIDS**: gatekeeper = symptom duration ≥ 2 weeks. Short duration excludes HIV.

Confidence levels: HIGH (primary rule), MEDIUM (supporting rule), POSSIBLE (weaker match).
Fallback: if nothing matches → "Unable to determine diagnosis. Please consult a medical professional."

## API Endpoints

- `GET  /api/symptoms` — all symptoms grouped by disease category
- `POST /api/diagnosis` — body: `{ symptoms: string[], symptom_duration?: string }` → `{ diagnosis, confidence, rules_fired, reasoning }`
- `GET  /api/history/:sessionId` — past diagnoses for a session

## Testing

Test with multiple symptom combos. Key scenarios:
- All 5 malaria primary symptoms → HIGH confidence malaria
- Chills missing → malaria excluded
- loose_stools + stomach_cramps + dehydration → HIGH diarrhoea
- No matching rule → fallback message
- Empty symptoms array → graceful error

## Gotchas

- SWI-Prolog must be installed and `swipl` on PATH. On Ubuntu: `sudo apt install swi-prolog`. On macOS: `brew install swi-prolog`.
- The Prolog bridge outputs JSON to stdout. Any Prolog debug prints (e.g., `write/1` for debugging) will corrupt the JSON. Use `debug/3` instead, or remove debug output before bridging.
- `child_process.spawn` is preferred over `exec` to avoid shell injection and buffer limits.
- PostgreSQL connection string comes from `DATABASE_URL` in `.env`.

## TODO Tracking

`TODO.md` at the project root tracks all requirements, what's done, and what's left.

**At the START of every session:**
- Read `TODO.md` to know current project state
- Check which items are next in priority

**At the END of every task:**
- Update `TODO.md`: move completed items to ✅, update ⚠️ items, adjust Next Steps
- Update the "Last reviewed" date
- If a new issue is discovered, add it to Known Issues

**When completing a major milestone:**
- Update the Status Summary counts
- Re-prioritize Next Steps based on what's left and grade weights (Inference Engine 25% > Knowledge Base 20% = Testing 20% > UI 15% > Docs 10% > Presentation 10%)

Never leave TODO.md stale. It is the source of truth for project progress.
