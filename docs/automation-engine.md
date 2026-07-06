# API Automation Engine — Overview

Short reference for the generic sheet-driven API QA system built in this project.

## Goal

QA maintains test cases in **Google Sheets**. The engine syncs them to **Hoppscotch**, runs them with **`hopp test`**, validates responses via **`pw.test` scripts**, and writes results back to the sheet. **No per-module TypeScript files** — one engine drives every worksheet tab.

---

## Data flow

```
┌─────────────────┐     read rows      ┌──────────────────────┐
│  Google Sheet   │ ───────────────► │  Generic engine      │
│  (1 tab = module)│                    │  (this repo)         │
└─────────────────┘                    └──────────┬───────────┘
        ▲                                         │
        │ write API Status + Comment              │ sync requests,
        │                                         │ scripts, env
        │                                         ▼
        │                              ┌──────────────────────┐
        │         JUnit XML            │  Hoppscotch          │
        └──────────────────────────────│  TEST → <module>     │
                                       │  hopp test + pw.*    │
                                       └──────────────────────┘
```

**End-to-end path**

1. **Read** — `SheetClient` loads rows where `Category` is `API` or `Both`.
2. **Queue** — `agent:poll` runs only rows with `API Status` empty or `Not_implemented`.
3. **Sync** — Every API row on the tab is pushed to Hoppscotch (method, URL, body, `pw.test` scripts, env vars).
4. **Run** — `hopp test <collection-id> -e <env>` executes the module collection.
5. **Parse** — JUnit XML → per-test pass/fail + failure messages.
6. **Write** — `API Status` → `Passed` / `Failed`; `Comment` → failure reason (or `N/A`).

---

## Generic engine (no per-module code)

| Layer | Role |
|-------|------|
| **Worksheet tab** | One module (e.g. `Sign In`, `Registration`) |
| **`moduleRegistry`** | Discovers tabs, maps `Sign In` → slug `sign-in`, resolves `TEST → sign-in` collection |
| **`buildRequestSpec`** | Row → Hoppscotch request (title, URL, body, variables, scripts) |
| **`buildTestPayload`** | Parses `Test Data` cell (JSON, key:value, or natural language) |
| **`parseExpectedResult`** | Parses `Expected Result` → status codes, token, error patterns |
| **`buildHoppscotchTestScript`** | Generates `pw.test` assertions from expected result |
| **`syncModuleEndpoints`** | Create/update/delete Hoppscotch requests via `agent-hoppscotch` CLI |
| **`runModuleTests`** | `hopp test` + JUnit parse + sheet update |

Adding a new module = **add a worksheet tab** with the standard columns. Run `sync:module` and `agent:poll`. No new source files required.

---

## Hoppscotch layout

```
Team workspace
├── Environments
│   └── Test  (or HOPPSCOTCH_ENV_NAME) — BASE_URL, EMAIL, PASSWORD, bearer_token, …
└── Collections
    └── TEST
        ├── sign-in        ← worksheet "Sign In"
        ├── registration   ← worksheet "Registration"
        └── feedback       ← worksheet "Feedback"
```

- Request title: `TC_010 - <description>` or `TC-017 - <description>`
- JUnit suite name: `<slug>/TC_010 - <description>` (slug = collection folder name)
- URL pattern: `<<BASE_URL>>/auth/login`
- Body: literal JSON from sheet test data (not `<<EMAIL>>` placeholders for payload fields)

---

## Sheet columns (configurable via `.env`)

| Column | Purpose |
|--------|---------|
| `Category` | `API` or `Both` → included in automation |
| `Test Data` | Request payload |
| `Expected Result` | Drives `pw.test` assertions |
| `API Endpoint` | Multi-line: `Public` or `Protected`, then method, then path (e.g. `Protected` / `GET` / `/feedback`) |
| `Query Parameter` | GET query string params (`filter: x; limit: 10`) |
| `API Status` | Queue: `Not_implemented` → result: `Passed` / `Failed` |
| `Comment` | Failure details written by agent |

Re-run a test: set `API Status` back to `Not_implemented`.

### Bearer auth (Protected routes)

- **Public** endpoints (login, register) sync without Bearer auth.
- **Protected** endpoints sync with `Authorization: Bearer <<bearer_token>>`.
- `agent:poll` runs **Sign In** first, then logs in via Node (`EMAIL` / `PASSWORD` from `.env`) and updates team env `bearer_token` before other modules.
- Successful login tests also call `pw.env.set('bearer_token', …)` within the same collection run.

---

## Commands

| Command | What it does |
|---------|----------------|
| `npm run test-connections` | Verify sheet + Hoppscotch credentials |
| `npm run sync:module` | Sync **all** API rows on each tab → Hoppscotch |
| `npm run agent:poll` | Sync → run queued rows → update sheet + HTML report |

Requires **Node 22** (`hopp` CLI uses `isolated-vm`).

---

## Key files

```
src/
├── agentPoll.ts              # Full loop: sync → run → report → sheet
├── syncModule.ts             # Sync only
├── sheetClient.ts            # Google Sheets read/write
├── config.ts                 # .env column mappings
├── engine/
│   ├── moduleRegistry.ts     # Worksheet → module → collection ID
│   ├── buildRequestSpec.ts   # Row → Hoppscotch request spec
│   ├── buildTestPayload.ts   # Test Data → JSON body
│   ├── syncModuleEndpoints.ts
│   └── runModuleTests.ts     # hopp test runner + result mapping
└── hoppscotch/
    ├── buildHoppscotchTestScript.ts  # pw.test generator
    └── parseJUnitReport.ts           # JUnit → pass/fail + comments
```

---

## Assertion & comment behaviour

Generated `pw.test` scripts check:

- **HTTP status** — expected code(s) from sheet
- **Token** — present / absent (`accessToken`, `token`, …)
- **Error message** — regex from expected result

On failure, the **Comment** column shows the API response, not a generic boolean error:

```
HTTP 409 (Conflict): User already exist — expected HTTP 201
```

The engine does **not** work around API errors (e.g. auto-generating unique emails for duplicate registration). The API fails naturally; the comment explains why.

---

## Session fixes (2026-07-06)

| Issue | Cause | Fix |
|-------|-------|-----|
| `No pw.test assertions` | JUnit parser missed self-closing `<testcase/>` tags from `hopp` | Updated `parseJUnitReport.ts` |
| `Expected 'false' to be 'true'` everywhere | Render API returned **503** (hibernating) | Wake API before run; not a script bug |
| Malformed JSON in Test Data | Sheet cells like `"email": "x"` without `{}` | `parseTestData.ts` wraps fragments + normalizes keys |
| Legacy `sign-in/TC_*` duplicates | Old prefixed request titles in Hoppscotch | Sync picks primary request, deletes duplicates |
| Unhelpful Comment text | Generic JUnit assertion messages | Scripts embed HTTP status + API `message`; formatter cleans Comment output |
| TC-017 registration fail | Email already registered → **409** | Expected; Comment now shows `User already exist` |

---

## `.env` essentials

```env
SPREADSHEET_ID=...
AGENT_ALL_WORKSHEETS=true

BASE_URL=https://your-api.example.com
EMAIL=...
PASSWORD=...

HOPPSCOTCH_GRAPHQL_ENDPOINT=https://hoppscotch.6sensehq.com/backend/graphql
HOPPSCOTCH_SESSION_COOKIE=...
HOPPSCOTCH_TEAM_ID=...
HOPPSCOTCH_PAT=...
HOPPSCOTCH_ENV_NAME=Test

WRITE_RESULTS=true
TEST_CATEGORIES=API,Both
```

Do **not** set `HOPPSCOTCH_COLLECTION_ID` — collections are resolved automatically under `TEST → <tab-slug>`.

---

## Related docs

- [signin-automation-flow.md](./signin-automation-flow.md) — QA playbook and prompt templates
