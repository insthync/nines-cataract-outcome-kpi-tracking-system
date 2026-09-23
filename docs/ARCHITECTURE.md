# Architecture

## Stack and boundaries

Browser → static `public/` → same-origin PocketBase REST API → SQLite. PocketBase 0.39.8 is pinned. No framework, CDN, frontend dependency or build step. Node.js is used only for tests. Setup/start scripts serve only `public/` with index fallback disabled.

## Collections

- `users`: unchanged starter auth contract, name/role/active. Registration always creates an active viewer. App admins manage other users' name/role/active only; self-edit, generic signup, user delete and sensitive auth fields remain locked.
- `cases`: one surgical encounter; required HN, patient name, surgery date, surgeon, procedure and eye (OD/OS/OU). Optional diagnosis, anesthesia, preoperative VA, implant, lens type, Callisto/Verion. Follow-ups have paired date/VA fields for day1/week1/month1. Outcomes are optional pass/fail or yes/no selects. Pain is an optional text field validated as integer 0–10 so blank remains distinct from zero. Notes, archived flag, revision, created/updated and actor IDs complete the record.
- `kpi_targets`: six built-in definitions initially disabled, plus admin-created targets. Fields: key, label, source, formula (JSON), direction, target, enabled, min_sample, actor/timestamps. The Admin KPI Targets page creates named definitions from existing outcomes or structured custom formulas. Server generates unique keys and stamps actors; unique labels prevent duplicate names. Only target/enabled/min_sample can change after creation; source/formula/name/key/direction are immutable to app accounts. Delete is locked.
- `quality_actions`: review month, title, owner, due date, PDCA stage, detail and actor/timestamps. Shared team records, editor/admin writes, no application deletes.
- `audit_logs`: case/action/target create and update; immutable to application accounts, readable by admin only. Stores entity, record ID, actor ID, operation, changed field before/after values and created time. HN, patient name, case notes and CQI detail are redacted from audit values. This is a change log, not access logging or a cryptographically tamper-proof ledger; trusted superusers retain database authority.
- Legacy `items` is retained without deleting existing data, but all app API rules are locked by the new migration. No automatic conversion of starter items to clinical records.

## Authorization and validation

Rules require active authentication from `users`. All active roles read cases/targets/actions; only editor/admin create/update cases/actions. Case archive/unarchive is additionally admin-only in the request hook. Hard delete is locked. Client whitelists never replace API rules.

Request hooks whitelist writable fields and stamp actor IDs. Model hooks validate calendar dates including leap years, reject future surgery/follow-up dates using Asia/Bangkok today, enforce follow-up date + VA pairs and chronological order, require month1 follow-up before va_outcome, validate pain, trim required strings and uppercase HN. Unique SQL index prevents active `(hn, surgery_date, eye)` duplicates, including concurrent creation. Same HN with different date or side is legitimate. Restore rechecks uniqueness.

Every case PATCH must include its current integer `revision`. Model update compares the stored revision again inside the same write transaction and increments it. Conflicting/stale requests return 409. The case/action/target write and its audit commit together; validation failures and rejected writes do not generate success audits. CQI and target updates do not have the case revision protocol; they use last-write behavior.

Viewer responses mask HN to its last two characters, replace patient name, and omit notes in `onRecordEnrich`, including default list/detail responses. Dashboard/reports display aggregates without identities for all roles.

## Frontend and calculations

Built-in KPI output now contains five metrics: the historical `refractive` target is excluded from default results and target-management cards, without deleting source data or the original metadata row. Explicit custom definitions can still use the refractive outcome. `Clinical.sourceDefinitions` retains all six calculation sources; `Clinical.definitions` contains the five active built-ins. Registry/follow-up list summaries show implant/power and lens type in place of Case ID.

Surgery time is removed from the form, request whitelist and cases schema by migration `1790120000_remove_surgery_time.js`. The migration deletes stored time values; rollback restores only an empty optional field. Lens type remains a text field to preserve legacy values; the UI and server share the eight allowed options from `clinical.js`. New or changed nonempty values must match this list. An unchanged historical non-list value is permitted and shown as a legacy option on that record only. The lens dropdown itself does not change the schema.

`api.js` stores only app sessions in sessionStorage scoped to origin. Refresh on load rechecks current role. A 401 clears the session; other failures retain it with an error. Each complete refresh loads all pages of authorized cases, targets and CQI (500 per request), then renders; failed pages never produce partial KPI results. Generation checks discard stale loads after logout/new reload. This is appropriate for pilot datasets; larger deployments should move aggregation/search to paginated server queries.

`clinical.js` is shared by browser and Node tests. No demo fallback data. Exclude archived cases; cohort by surgery date. VA/biometry/refractive numerator = pass, denominator = pass+fail. Complication numerator = yes, denominator = yes+no. Missing assessments are excluded and reported separately. OU remains one encounter. Results are entered assessments rather than calculated from free-text acuity/diopters. Min sample gates target status, not raw descriptive percentages. Disabled targets show unconfigured, zero denominator shows N/A.

Periods: monthly, calendar quarter, YTD through the selected month, calendar year; year-to-year compares entire selected/prior years. Trend table/chart spans the selected calendar year. VA table and surgical-volume bars expose actual counts with N/A gaps. Current period applies to dashboards/statistics/alerts/reports; registry/follow-up use all cases; CQI uses the exact review month.

Alerts are derived deterministically from saved cases: Critical for endophthalmitis yes; High for wound leak/re-operation yes; Monitor for failed month1 VA or missing day1/week1/month1 at 1/7/30 elapsed days. They survive refresh through persisted source records, but have no independent acknowledgement/event store or push notification scheduler. They are workflow flags, not clinical advice. Data Quality reports completeness; invalid dates/values and exact duplicate encounters are prevented at write time.

Reports export UTF-8 BOM CSV aggregates with result units, without patient identifiers; custom labels are escaped against spreadsheet formula interpretation; browser print supports PDF. Backup is an operator PocketBase function, not a CSV report. No import/master/settings/KPI-monitoring pages or import-job store are included, as explicitly confirmed.

UI uses textContent for user data, role-aware controls, native dialog focus containment, asynchronous HTML confirmations, unsaved-case protection and disabled save buttons during requests. Admin can inspect the newest 100 audit entries per case; full history is available through authorized PocketBase API. At widths <=760px, the same sidebar moves into a native modal drawer opened by a Hamburger button. Focus is contained, Escape/backdrop/close dismiss it, selecting a page closes it, and desktop resize restores the sidebar without duplicating navigation IDs.

## Schema lifecycle

### Custom KPI formulas

`public/kpi-formula.js` is a pure UMD module shared by browser, Node tests and PocketBase model validation (loaded via require). A formula is either `{mode:"ratio", denominator:rule, numerator:rule}` or `{mode:"average", denominator:rule}`. Each rule has `match:"all"|"any"` and up to 10 conditions with whitelisted field/operator/value combinations. Presence conditions have no value. No nested rules, scripts, SQL, eval or expression parsing are supported. The formula JSON field is capped at 12 KB.

Formula evaluation uses the selected surgery cohort excluding archived encounters. Empty condition groups match all cases. Ratio numerator is the subset of the denominator population matching numerator conditions; zero denominator gives N/A. Average is Pain score sum / recorded-score count within denominator conditions; missing scores are excluded while zero counts. Blank values do not satisfy comparisons, including not-equal; explicit missing checks are available. Targets are 0–100 for percentages, 0–10 for Pain averages. Min sample gates pass/fail, and disabled targets retain descriptive results. The UI labels excluded cases as “ไม่รวมตัวหาร”, including both filtered-out and unassessed records.

The form previews the saved cohort for the displayed reference period. Custom KPIs appear in Dashboard, monthly statistics and reports with percent/score units; the existing VA-specific annual trend remains unchanged. Current target values apply to historical periods. Changing a saved formula requires a new named definition; target histories show the newest 20 entries, with full authorized API history available. Only targets with a request actor receive creation audits; built-in migration seeds precede audit collection creation.

`1789850000_custom_kpi_targets.js` backfills source from existing keys and allows admin create; `1789851000_kpi_formulas.js` adds custom source and JSON formulas. Earlier migrations are unchanged. Rollback refuses to remove formula/custom-definition schema while dependent rows exist.

Original migration is unchanged. New migration `1789810000_cataract.js` creates the clinical schema and retires legacy app access. Up is managed by PocketBase migration history. Rollback drops new collections and restores starter item rules: rollback is destructive and is not a substitute for backup. Future applied schema changes require new migrations.
