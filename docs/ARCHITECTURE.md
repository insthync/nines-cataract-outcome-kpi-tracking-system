# Architecture

## Stack and boundaries

Browser → static `public/` → same-origin PocketBase REST API → SQLite. PocketBase 0.39.8 is pinned. No framework, CDN, frontend dependency or build step. Node.js is used only for tests. Setup/start scripts serve only `public/` with index fallback disabled.

## Collections

- `users`: unchanged starter auth contract, name/role/active. Registration always creates an active viewer. App admins manage other users' name/role/active only; self-edit, generic signup, user delete and sensitive auth fields remain locked.
- `cases`: one surgical encounter; required HN, patient name, surgery date, surgeon, procedure and eye (OD/OS/OU). Optional diagnosis, anesthesia, time, preoperative VA, implant, lens type, Callisto/Verion. Follow-ups have paired date/VA fields for day1/week1/month1. Outcomes are optional pass/fail or yes/no selects. Pain is an optional text field validated as integer 0–10 so blank remains distinct from zero. Notes, archived flag, revision, created/updated and actor IDs complete the record.
- `kpi_targets`: six definition rows only; key, label, direction, target, enabled, min_sample, actor/timestamps. Initially disabled. Admin app API can update target/enabled/min_sample; definition fields are protected. Configuration has no app page by explicit scope.
- `quality_actions`: review month, title, owner, due date, PDCA stage, detail and actor/timestamps. Shared team records, editor/admin writes, no application deletes.
- `audit_logs`: case/action create and update, target update; immutable to application accounts, readable by admin only. Stores entity, record ID, actor ID, operation, changed field before/after values and created time. HN, patient name, case notes and CQI detail are redacted from audit values. This is a change log, not access logging or a cryptographically tamper-proof ledger; trusted superusers retain database authority.
- Legacy `items` is retained without deleting existing data, but all app API rules are locked by the new migration. No automatic conversion of starter items to clinical records.

## Authorization and validation

Rules require active authentication from `users`. All active roles read cases/targets/actions; only editor/admin create/update cases/actions. Case archive/unarchive is additionally admin-only in the request hook. Hard delete is locked. Client whitelists never replace API rules.

Request hooks whitelist writable fields and stamp actor IDs. Model hooks validate calendar dates including leap years, reject future surgery/follow-up dates using Asia/Bangkok today, enforce follow-up date + VA pairs and chronological order, require month1 follow-up before va_outcome, validate pain/time, trim required strings and uppercase HN. Unique SQL index prevents active `(hn, surgery_date, eye)` duplicates, including concurrent creation. Same HN with different date or side is legitimate. Restore rechecks uniqueness.

Every case PATCH must include its current integer `revision`. Model update compares the stored revision again inside the same write transaction and increments it. Conflicting/stale requests return 409. The case/action/target write and its audit commit together; validation failures and rejected writes do not generate success audits. CQI updates do not have the case revision protocol.

Viewer responses mask HN to its last two characters, replace patient name, and omit notes in `onRecordEnrich`, including default list/detail responses. Dashboard/reports display aggregates without identities for all roles.

## Frontend and calculations

`api.js` stores only app sessions in sessionStorage scoped to origin. Refresh on load rechecks current role. A 401 clears the session; other failures retain it with an error. Each complete refresh loads all pages of authorized cases, targets and CQI (500 per request), then renders; failed pages never produce partial KPI results. Generation checks discard stale loads after logout/new reload. This is appropriate for pilot datasets; larger deployments should move aggregation/search to paginated server queries.

`clinical.js` is shared by browser and Node tests. No demo fallback data. Exclude archived cases; cohort by surgery date. VA/biometry/refractive numerator = pass, denominator = pass+fail. Complication numerator = yes, denominator = yes+no. Missing assessments are excluded and reported separately. OU remains one encounter. Results are entered assessments rather than calculated from free-text acuity/diopters. Min sample gates target status, not raw descriptive percentages. Disabled targets show unconfigured, zero denominator shows N/A.

Periods: monthly, calendar quarter, YTD through the selected month, calendar year; year-to-year compares entire selected/prior years. Trend table/chart spans the selected calendar year. VA table and surgical-volume bars expose actual counts with N/A gaps. Current period applies to dashboards/statistics/alerts/reports; registry/follow-up use all cases; CQI uses the exact review month.

Alerts are derived deterministically from saved cases: Critical for endophthalmitis yes; High for wound leak/re-operation yes; Monitor for failed month1 VA or missing day1/week1/month1 at 1/7/30 elapsed days. They survive refresh through persisted source records, but have no independent acknowledgement/event store or push notification scheduler. They are workflow flags, not clinical advice. Data Quality reports completeness; invalid dates/values and exact duplicate encounters are prevented at write time.

Reports export UTF-8 BOM CSV aggregates, without patient identifiers; browser print supports PDF. Backup is an operator PocketBase function, not a CSV report. No import/master/settings/KPI-monitoring pages or import-job store are included, as explicitly confirmed.

UI uses textContent for user data, role-aware controls, native dialog focus containment, asynchronous HTML confirmations, unsaved-case protection and disabled save buttons during requests. Admin can inspect the newest 100 audit entries per case; full history is available through authorized PocketBase API. Mobile navigation scrolls within its own strip, not the page.

## Schema lifecycle

Original migration is unchanged. New migration `1789810000_cataract.js` creates the clinical schema and retires legacy app access. Up is managed by PocketBase migration history. Rollback drops new collections and restores starter item rules: rollback is destructive and is not a substitute for backup. Future applied schema changes require new migrations.
