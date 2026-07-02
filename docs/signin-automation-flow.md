# API Automation Flow (Generic)

This is a reusable QA playbook for **any API module** (for example: Sign In, Sign Up, Forgot Password, Reset Password, Profile, etc.).
Sign In is used as the running example.

## Goal

Enable QA to:
- maintain test cases in Google Sheet,
- sync those tests into Hoppscotch as runnable requests,
- run all tests with one click,
- verify responses automatically,
- push Pass/Fail and comments back to Google Sheet.

## How Systems Connect

Three systems are connected:

1. **Google Sheet (test case source)**
   - QA edits scenarios, payload hints, expected results, and categories.

2. **Cursor project (automation orchestrator)**
   - Reads sheet rows via Google service account.
   - Converts each row into request data + assertion rules.
   - Syncs requests/scripts/environment to Hoppscotch.
   - Runs validations and updates sheet result columns.

3. **Hoppscotch (API runner)**
   - Stores module collections and requests.
   - Uses env variables + scripts for dynamic execution.
   - Runs complete module collection from UI runner.

Data flow:
`Google Sheet -> Cursor automation -> Hoppscotch run -> Cursor verification -> Google Sheet update`

## Generic Module Pattern

Use this same structure for every module:

- Folder: `TEST -> <module-name>` (example: `TEST -> sign-in`)
- Team environment: `<Module Name> - Test` (example: `Sign In - Test`)
- Request URL/body use variables (no hardcoded values)
- Common pre-request script + reusable test assertion strategy

## One-Time Setup (QA)

1. Share Google Sheet with service account email from `credentials/service-account.json`.
2. Configure `.env` from `.env.example`.
3. Fill:
   - Sheet config: `SPREADSHEET_ID`, `WORKSHEET_NAME`, `HEADER_ROW`
   - Hoppscotch config: `HOPPSCOTCH_GRAPHQL_ENDPOINT`, `HOPPSCOTCH_SESSION_COOKIE`, `HOPPSCOTCH_TEAM_ID`, `HOPPSCOTCH_COLLECTION_ID`
   - Test credentials: `EMAIL`, `PASSWORD` (or module-appropriate values)
4. Verify:
   - `npm run connect-sheet`
   - `npm run setup-sign-in-hoppscotch` (for Sign In example)

## Generic Run Flow

1. QA updates/creates cases in Google Sheet.
2. Sync module requests/scripts/environment to Hoppscotch.
3. Run module collection in Hoppscotch (one click), or run full flow from Cursor.
4. Automation validates status, body assertions, token/error conditions.
5. Results are written to Google Sheet (if `WRITE_RESULTS=true`).
6. Reports are generated locally (`report.html`, `report.json`).

## Sign In Example (Concrete)

- Worksheet: `Sign In`
- Hoppscotch folder: `TEST -> sign-in`
- Environment: `Sign In - Test`
- Variable-based request:
  - URL: `<<BASE_URL>><<LOGIN_ENDPOINT>>`
  - Body: `<<EMAIL>>`, `<<PASSWORD>>`

## Configurable Sheet Columns

Column names are controlled from `.env`:

- `SHEET_COL_TEST_ID`
- `SHEET_COL_TEST_ID_FALLBACK`
- `SHEET_COL_CATEGORY`
- `SHEET_COL_TEST_DATA`
- `SHEET_COL_EXPECTED_RESULT`
- `SHEET_COL_STATUS` (read only)
- `SHEET_COL_API_STATUS` (write)
- `SHEET_COL_API_AUTOMATION` (write)
- `SHEET_COL_COMMENT_BACKEND` (write)
- `SHEET_WRITE_COLUMNS` (strict write whitelist)

`SHEET_WRITE_COLUMNS` controls which columns can be changed by automation.
Allowed values:
- `api_status`
- `api_automation`
- `comment_backend`

Example:

```env
# Only update API Status and backend comments
SHEET_WRITE_COLUMNS="api_status,comment_backend"
```

If a field is not listed, automation will not write to that column.

Example override:

```env
SHEET_COL_TEST_ID="Case ID"
SHEET_COL_CATEGORY="Type"
SHEET_COL_API_STATUS="Backend Status"
SHEET_COL_COMMENT_BACKEND="Backend Notes"
```

## Industry-Standard Variable Strategy

- Keep host/endpoints/credentials as variables.
- Use team-level env vars for shared values.
- Use request-level vars for case-specific overrides.
- Avoid hardcoded secrets in requests/scripts.
- Run same collection in QA/stage/prod by switching environment values.

## Commands (Sign In Example)

- Sync environment + scripts + requests:
  - `npm run setup-sign-in-hoppscotch`
- Full flow (sync + run + verify + report + optional sheet update):
  - `npm run run-sign-in-qa`

## QA Prompt Templates (Reusable)

### 1) Sync any module to Hoppscotch
```text
Read .env and sync <module-name> sheet test cases into Hoppscotch TEST -> <module-name>.
Use variable-based request URL/body, attach reusable pre-request/test scripts, and update/create team environment.
Then summarize what was created/updated.
```

### 2) Run tests and update sheet
```text
Run the <module-name> API automation end-to-end:
1) sync Hoppscotch endpoints/scripts/environment
2) execute tests
3) verify response vs expected result from Google Sheet
4) update result columns in Google Sheet
5) generate HTML/JSON report
Then summarize pass/fail with failure reasons.
```

### 3) Change column mapping
```text
I changed Google Sheet headers. Update .env column mappings so reads/writes still work.
Validate with preview and one full run.
```

### 4) Add new module flow
```text
Create a new module flow for <module-name> using the same architecture:
sheet -> hoppscotch sync -> validation -> sheet update.
Keep it lightweight with reusable scripts and variable-driven requests.
Document required env keys and run commands.
```
