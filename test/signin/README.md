Sign-in test artifacts live in this folder.

Flow documentation: `docs/signin-automation-flow.md`

## Commands

| Command | Purpose |
|---------|---------|
| `npm run sync:module` | Sync Pending (or all) sheet rows → Hoppscotch TEST + scripts |
| `npm run agent:poll` | Full loop: sync → run on Hoppscotch → update sheet |
| `npm run test-connections` | Verify sheet + Hoppscotch credentials |

## Local reports

Generated under `output/reports/<module_id>/` when `agent:poll` runs.

## Hoppscotch

- Collection: TEST folder (see `HOPPSCOTCH_COLLECTION_ID` in `.env`)
- Environment: team env from `HOPPSCOTCH_ENV_NAME`
- Scripts use Hoppscotch `pw` namespace (not Postman `pm`)
