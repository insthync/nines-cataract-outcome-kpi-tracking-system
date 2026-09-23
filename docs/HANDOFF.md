# Handoff

Updated: 2026-09-23 (Asia/Bangkok)

## Remove surgery time — 2026-09-23

- Removed hour/minute inputs, hidden time field, serialization and unused styles from create/edit forms.
- User requested database removal too. New migration `1790120000_remove_surgery_time.js` drops `cases.surgery_time`; its previous values are discarded. Rollback only recreates an empty optional text field. Earlier migrations remain unchanged; no real database was opened or migrated during development.
- Removed the field from the server request whitelist and removed time validation. Old clients submitting surgery_time must refresh; those requests are rejected. Other case data and permissions remain unchanged.
- `node tests/integration.mjs`: **213 assertions PASS**, including schema absence, response absence and retired-field rejection. `node tests/remove-time-migration.mjs`: populated temporary SQLite upgrade confirms physical column removal, preserved case/lens values and repeat migration safety.
- Browser verified Desktop and 390px mobile: no time controls, successful synthetic case save, no horizontal overflow or warning/error logs. JS syntax, PowerShell parsing, Bash syntax/LF and git diff --check passed.
- Restart PocketBase with the normal start script to apply the migration, then refresh the browser. No manual database deletion is required.

## KPI and lens form changes — 2026-09-22

- Removed the built-in Refractive KPI from Dashboard/statistics/reports and target cards. Historical assessment data and explicitly configured custom formulas remain supported; no destructive data change or migration.
- Registry/follow-up cards display Implant (Lens) / Power and Type Lens instead of Case ID. Implant label updated in section 2; Type Lens is a dropdown with all eight requested IOL options.
- Section 1 uses separate hour/minute numeric inputs and preserves HH:mm storage, including zero-padded 09:05. Partial time entry is rejected. Existing free-text lens values remain selectable for their original record; model validation rejects new unsupported lens values.
- Temporary database suite: **216 assertions PASS**. Includes all eight lens choices, unsupported lens changes, invalid time boundaries and retired KPI regression. No real pb_data accessed.
- Browser checks on desktop and 390px mobile: no default Refractive card, section labels/options, partial-time validation, create/save/reload with 09:05 and lens data, registry without Case ID, mobile lens update. No page overflow or browser warning/error logs. JavaScript/PowerShell/Bash syntax and git diff whitespace checks completed.

## Admin KPI targets and custom formulas — 2026-09-20

- Added Admin-only KPI Targets navigation and create/edit dialogs; the four previously excluded full pages remain excluded. Viewer label now reads ผู้ชม. Active viewers/editors can read targets but cannot create/update them at the API.
- Admin can add a named KPI from six existing outcome definitions or choose กำหนดสูตรเอง. Custom formulas support a percentage with numerator/denominator filters, or mean Pain score. AND/OR groups allow up to 10 conditions each, using six outcome enums, eye, follow-up VA presence and Pain score comparisons. Empty groups mean all cases. Numerator is restricted to denominator membership; missing values never silently become zero. The preview uses the displayed saved surgery cohort.
- Persisted formulas/names/sources/directions are immutable to app accounts. To change a definition, add another named KPI and disable the old target. Target value, min sample and enabled state remain editable; no hard delete. Current targets apply to all periods, with no effective-date versioning. CQI/target edits retain ordinary last-write semantics.
- New migrations: `1789850000_custom_kpi_targets.js` adds source/backfill/admin create and unique labels; `1789851000_kpi_formulas.js` adds structured JSON formulas. Original schema migrations were not rewritten. Migrations refuse rollback if it would remove definitions/formulas still in use. No real pb_data was opened or migrated.
- `public/kpi-formula.js` validates declarative formulas in browser, PocketBase hooks and Node tests. No eval/SQL/script expressions. Server generates keys and actor stamps, validates formula fields/operators/values and score target range, and atomically audits creation/updates. Audit UI shows latest 20 entries. KPI cards and aggregate reports now include percent/score units and custom results; existing VA annual trend remains VA-specific. CSV escapes formula-like label prefixes.
- Verification: **189 assertions PASS** on OS temporary SQLite; includes migration backfill, admin-only create/update, duplicate labels, immutable definitions, formula persistence/audit, invalid/code-string rejection, AND/OR, numeric comparisons, denominator subsets, absent values versus zero, averages and N/A.
- Browser: desktop (~1265px) and 390px mobile; added named/custom targets, changed source/conditions, previewed 1/3 = 33.33%, saved and reloaded, verified Dashboard pass/fail and report rows, created mean Pain score on mobile and edited target, inspected audit. No horizontal page overflow or browser warning/error logs. Earlier target checks also covered unsaved cancellation, disable/re-enable and viewer menu visibility.
- JS syntax, PowerShell parsing, Bash syntax/LF and git diff --check checked. README, architecture/security and customization docs describe use and limits. Temporary test data contains only synthetic records; normal installation starts with no patient data.
- Shared frontend cache version: `202609201347`. Temporary browser tab closed, viewport reset and preview listener confirmed stopped after testing.

To use: restart PocketBase with `./scripts/start-pocketbase.ps1` to apply new migrations, refresh the browser, then Admin → เป้าหมาย KPI → เพิ่มเป้าหมาย KPI → กำหนดสูตรเอง. README includes a follow-up-completeness formula example.

## Mobile Hamburger and display title update — 2026-09-19

- Display title, header, registration page and CSV report now use Cataract Outcome without Nines; the repository name is unchanged. Verified the new title on desktop/mobile.
- Replaced the mobile horizontal navigation strip with a Hamburger button and left modal drawer at <=760px. Desktop retains its sidebar.
- Uses the existing navigation nodes and preserves `id="add-case-button"`; closes on selection, close button, outside click and Escape. Native dialog contains focus and returns it to the trigger. Resizing to desktop closes the drawer and restores the sidebar.
- Browser verified at 390px and 1280px: open/close, selection, Escape/focus return, backdrop, Add New Case dialog, resize restoration, no duplicate add-case ID, no page overflow and no warning/error logs.
- Temporary-database suite: 124 assertions passed. JS syntax, PowerShell parsing, Bash syntax/LF and git diff --check passed. No real data accessed.
- Shared asset version updated to `202609191859` in index.html and register.html.

## Delivered

- Converted the clean starter checkout to `nines-cataract-outcome-kpi-tracking-system`; HTML/CSS/JavaScript + PocketBase 0.39.8 + SQLite retained. No framework, external frontend assets or build dependencies.
- Read AGENTS.md, README and all docs before editing; initial git status was clean. Inspected the live Canva reference and all fields under Add New Case. User explicitly confirmed exclusion of KPI Monitoring, Data Import, Master Data and Settings.
- Thai responsive sidebar, executive dashboard, registry, case form/details, follow-up, monthly/quarterly/YTD/year statistics, year comparison, quality alerts, CQI/PDCA and aggregate CSV/print reports. Existing registration/login/admin retained.
- New migration `1789810000_cataract.js`: cases, KPI target definitions, quality actions and audit logs. No patient seed records; six disabled KPI metadata rows only. Original migration unchanged. Legacy items preserved but app API access retired.
- API role enforcement: viewer reads masked identities, editor adds/edits, admin archives/restores and manages other members. Permanent case/action deletion disabled for app roles.
- Server validates required fields/dates/chronology/outcomes/pain/time, pairs follow-up date/VA, normalizes HN, rejects duplicate active encounters and prevents field/actor injection. Revision checks and audits are in the write transaction, preventing silent lost updates to cases.
- Refresh persistence, save-in-progress/unsaved states, cancellation confirmation, visible API errors, metadata and per-case admin audit viewer. KPI uses only persisted non-archived cases; unknown outcomes never imply no complication.
- Updated README, architecture/security contracts and customization guide; startup banners use the project name.

## Verification completed

- `node tests/integration.mjs`: **124 assertions PASS**, fresh OS temporary SQLite; guest isolation, roles, current-token role changes, deactivation, registration privilege injection, masked viewer responses, duplicate/invalid data rejection, actor/field injection, concurrency conflict, audit counts/redaction/immutability, target permissions/ranges, CQI persistence/validation, archive/restore, calculation denominators, minimum samples, date periods, follow-up alerts, pagination and private-path protection.
- Migrations run twice on each fresh test database successfully. Tests do not open any real `pb_data`.
- Browser verification: desktop (~1265 px), mobile **390 px**, tablet **820 px**. Login, empty-period N/A dashboard, create synthetic case, reload/session restore, search, edit all three follow-ups, persisted VA, audit history, unsaved form keep/discard, CQI create, report period filtering and CSV export, viewer masked/read-only detail, admin member-name update, case archive/restore.
- At 390 and 820 px, measured document scroll width <= viewport width. Sidebar/table scrolling remains contained. Screenshots inspected for dashboard, registry, case form and tablet report.
- Browser warning/error logs were empty during successful final flow checks. The reference site's nested iframe initially rejected input coordinates; its observed embedded URL was opened directly to inspect the form. A native confirm interaction stalled the test browser; application confirmations were replaced with accessible HTML dialogs and verified.
- JavaScript syntax: public scripts, hooks, migrations and tests. PowerShell parsing: all scripts. Bash syntax and LF-only: all scripts. Git whitespace validation run after normalization.
- Shared frontend cache version: `202609191732` on every asset in public/index.html and public/register.html.
- Temporary browser-test server was stopped and its listener verified closed; temporary browser tabs were closed. No production server was started.

## Start / test

```powershell
./scripts/setup-pocketbase.ps1
./scripts/start-pocketbase.ps1
# http://127.0.0.1:8090/
```

Setup prompts for the operator superuser and initial application admin. Real setup/runtime data was not created, opened or migrated during development. The ignored PocketBase binary was downloaded from the pinned official release for temporary tests only.

```powershell
node tests/integration.mjs
node tests/integration.mjs --preview
```

Preview is disposable, uses synthetic patients/accounts and prints its random credentials and URL. Ctrl+C stops it and removes temporary data. Never enter real patient information into this test server.

## Explicit limitations / next work

- No excluded pages/import jobs/master-data CRUD/full settings UI. The separately authorized Admin KPI Targets page manages targets and structured formulas, disabled until approved. No clinically endorsed default percentages.
- One-team shared data; public signup creates active viewers. Server masking is not anonymization or tenant isolation; users with viewer access still see clinical details. Review membership before real deployment.
- VA/biometry/refractive pass/fail are clinician-entered assessments, not inferred from free text or diopters. OU is one encounter. Denominators are assessed encounters, not all procedures; this definition must be approved locally.
- Quality alerts derive from saved cases, with no separate acknowledgement/event store or push scheduler. Due flags use 1/7/30 elapsed days. CQI is saved by exact review month and uses last-write update behavior.
- Audit covers case/action/target create/update (except migration target seeds), not every login/view/export or member edit. App accounts cannot modify it; trusted superusers can. Full audit is available via authorized API; case UI shows latest 100 and target UI latest 20.
- UI loads all authorized records for coherent pilot-scale calculations. Large datasets need server aggregation and paginated search. No offline saving or background autosave.
- Backup/restore is operator-managed in PocketBase; reports are not backups. Browser print-to-PDF is provided, not a generated PDF template service.
- No clinical certification, email recovery/verification UI, production deployment, multi-tenant implementation or scheduled backup. Linux/macOS startup was syntax-checked, not end-to-end executed on those OSes.
