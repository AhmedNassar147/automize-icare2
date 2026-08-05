# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Node.js bot that automates working the GlobeMed Saudi referral portal
(`referralprogram.globemedsaudi.com`) for a healthcare provider. It drives a
real (non-headless) Chrome via Puppeteer to collect incoming patient
referral cases, times/executes accept-or-reject actions against a hard
per-case deadline, generates PDF acceptance/rejection letters, and lets a
human operator supervise/act via a Telegram bot (with an ntfy-based fallback
notification channel). This is a single-tenant deployment repo — the same
codebase is deployed per client/branch with a different `.env`.

## Commands

- `yarn start` / `npm start` — the only script. Runs
  `nodemon --watch src --ext mjs,js,json ./src/index.mjs`. There is no
  build step, no test suite, and no lint config in this repo — don't invent
  `npm test`/`npm run lint` commands.
- There is no package manager enforcement beyond `yarn.lock` being present;
  use `yarn`.
- Formatting follows `.prettierrc` (double quotes, semicolons, 2-space
  indent).

### Required local setup (from comments in `src/index.mjs`)

The app needs local HTTPS certs and a hosts-file entry to talk to the
GlobeMed domain from `localhost`, plus an optional Cloudflare tunnel when
`USE_NTFY_AS_CASE_PROVIDER=Y`. See the comment block at the top of
`src/index.mjs` for the exact `mkcert`/hosts-file/`cloudflared` steps if
setting up a new environment.

## Configuration (`.env`)

Nearly all runtime behavior is env-driven and mutated at runtime — see
`src/updateEnvFile.mjs`, which rewrites `.env` in place and updates
`process.env` (used by Telegram commands like `/wait`, `/auto_wait`, and by
`/me`/`/activate` to persist the active operator's chat ID). Notable
variables: `CHROME_EXECUTABLE_PATH`/`USER_PROFILE_PATH` (real Chrome
profile used for login persistence/fingerprint), `WAIT_FOR_ACCEPT_MS` /
`ENABLE_AUTO_WAITING` (deliberate delay before clicking accept/reject, see
`getExtraTimeBasedLogs.mjs`), `TG_TOKEN`/`TG_CHAT_ID`/`TG_CHAT_IDS`/
`ADMIN_CHAT_ID` (Telegram bot + authorized operators), `CERT_PATH`/
`KEY_PATH`/`HOST`/`PORT` (local HTTPS server), `USE_NTFY_AS_CASE_PROVIDER`/
`NTFY_TOPIC`/`NTFY_BASE_ID` (fallback case-notification channel via
Cloudflare tunnel), `WEEKLY_REPORT_GENERATED_AT` (cron expression),
`CLIENT_NAME`/`CLIENT_ID`/`BRANCH_NAME` (per-deployment identity, shown in
alerts/reports). Never assume a variable's value — read it from `.env`
(gitignored) or ask, since values differ per branch/client deployment.

## Architecture

### Entry point and process lifecycle (`src/index.mjs`)

Boots in one big async IIFE: ensures result/screenshot/pdf folders exist,
launches Puppeteer against a persistent Chrome profile with anti-detection
flags, restores `PatientStore` state from disk (`results/waiting-patients/
collectedPatients.json`) and `casesLetters.db`, wires up the Telegram bot,
starts the background collector loop, registers two cron jobs (nightly
case-letter-file cleanup, weekly report), and starts an HTTPS+WebSocket
server (Express) alongside it. `shutdown()` handles `SIGINT`/`SIGTERM`/
`unhandledRejection`/`uncaughtException` uniformly and notifies the
Telegram admin on crash.

### The core loop: collect → store → schedule → act

1. **`waitForWaitingCountWithInterval.mjs`** runs forever on a ~70s
   interval. Each tick it makes sure the browser is logged in
   (`makeUserLoggedInOrOpenHomePage.mjs`), calls the portal's internal API
   for the "Pending Referrals" tab (`fetchPatientsFromAPI.mjs`), checks
   already-accepted cases for status changes
   (`checkReferralSelectedStatus.mjs`), and hands new cases to
   `processCollectingPatients.mjs`. It's built around `PauseController.mjs`
   so any in-flight human action can pause/resume this loop.
2. **`processCollectingPatients.mjs`** fetches full case detail
   (`getPatientReferralDataFromAPI.mjs`), computes the case's real
   Saudi-time deadline window (`getSaudiStartAndEndDate`, using both
   server-reported and client-side timestamps to be resilient to clock
   drift), pre-generates both acceptance and rejection PDF letters
   (`generatePdfs.mjs`, one of several `LETTER_LAYOUT_TYPES`), and adds the
   case to `PatientStore`.
3. **`PatientStore.mjs`** (an `EventEmitter`) is the in-memory source of
   truth for all open cases, keyed by `referralId`. It persists to
   `results/waiting-patients/collectedPatients.json` on every mutation and
   mirrors history into `patientsWeeklyHistory.db`. Scheduling a case
   (`schedulePatientAction`) arms a precise timer
   (`waitMinutesThenRun.mjs`) that fires right at the case's actionable
   deadline and emits `patientAccepted` / `patientRejected` /
   `patientFakeRejectProbe`.
4. **`handleCaseAcceptanceOrRejection.mjs`** is the listener for those
   events: it opens a fresh page, navigates to the case's details view
   in-app (`navigateToNewDetailsPage`, via `history.pushState` rather than a
   real reload, to look like normal in-app navigation), waits until the
   exact right moment to click via `waitUntilCanTakeActionByWindow.mjs`
   (measuring server clock skew/RTT), applies a deliberate humanizing wait
   (`WAIT_FOR_ACCEPT_MS` + optional auto-computed extra wait from
   `getExtraTimeBasedLogs.mjs`), and reports outcome timing to Telegram/ntfy
   and to the case-timing log (`summarizeLogsAfterAcceptance.mjs`,
   `timingLogsHelpers.mjs`).
5. Human operators intervene through **either** the Telegram bot's inline
   buttons/commands or the Express `POST /action` route — both funnel into
   the single **`handleUserActionOnCase.mjs`**, which validates the action
   is still within the allowed processing window
   (`PatientStore.canStillProcessPatient`) before scheduling it.

### Browser bundle patching

`src/index.mjs` intercepts requests for the portal's own JS bundle
(`/assets/index-*.js`) and rewrites it on the fly via
`modifyGlobMedSourceCode.mjs` before it reaches the page (currently disabled
— the `setupPage`/`targetcreated` wiring is commented out). This function
does source-level pattern matching (finding a minified React renderer near
a `referral-button-container` marker) to strip UI it doesn't want rendered;
treat it as fragile/build-specific and expect it to need re-tuning whenever
GlobeMed ships a new bundle hash.

### Telegram bot (`installTelegramBotApi.mjs`)

Single active "on duty" operator model: chat IDs are added via `/add`
(shares phone number) then become allowed; `/me` / `/activate` switch which
chat ID is currently "active" and thus the target of new-case
notifications (persisted into `.env` as `TG_CHAT_ID`). Non-active
authorized users can still act on a case, which triggers an "online cascade"
(`pendingOnlineChecks`/`processNextOnlineCheck`) that walks down the
authorized list asking who's available. Commands are declared in the
`COMMANDS` map (regex-matched) — add new bot commands there and register
them with `bot.onText`, then call `/update_commands` (or the
`updateCmds`/`clearCmds` handlers) to push the command list to Telegram.

### Persistence

Three separate `better-sqlite3` databases opened in `src/db.mjs`, all
gitignored and per-deployment:
- `patients.db` — current patients table (helper functions not filtered by
  active/history, mainly used by report generation).
- `patientsWeeklyHistory.db` — full history of every case seen, source for
  weekly/monthly Excel reports (`createAndSendWeeklyReport.mjs`,
  `createAndSendInvoiceReport.mjs`).
- `casesLetters.db` — caches generated letter PDFs by Telegram
  `file_id` (`casesFilesDb` table) so `/letter` can resend without
  regenerating; nightly-cron-cleaned via `deleteOldCaseFiles`.

Both `patients`/`patientsWeeklyHistory` tables accept rows in either the
GlobeMed API shape (`idReferral`, `adherentName`, `adherentNationalId`,
`sourceProvider`, …) or the internal DB shape (`referralId`, `patientName`,
`nationalId`, `provider`, …) — `toDbRow()`/`createPatientRowKey()` normalize
between the two; keep supporting both shapes when touching this file rather
than picking one.

### Reports and letters

- `generatePdfs.mjs` renders acceptance/rejection letters as HTML
  (`generateAcceptanceLetterHtml.mjs`) then to PDF via a Puppeteer page,
  with several visual `LETTER_LAYOUT_TYPES` (see `constants.mjs`) chosen
  randomly or via `LETTER_TYPE` env override — deliberate variation to avoid
  every letter looking identical.
- `createAndSendWeeklyReport.mjs` / `createAndSendInvoiceReport.mjs` build
  Excel workbooks (`exceljs`, column defs in `constants.mjs`) from
  `patientsWeeklyHistory.db` and ship them through the Telegram sender.
- `formatPatientToTelegramOrWA.mjs` / `formatPatientToNtfy.mjs` format a
  patient record for their respective channels.

### Files intentionally outside `src/`

`abc.js`, `tries.mjs`, `navigate.mjs`, `test-change-source.mjs`,
`original-gm-index*.js`, `proxy.mhs`, and everything in `scripts/` are
scratch/experimentation files (most are explicitly `.gitignore`d) used
while reverse-engineering the GlobeMed bundle or one-off migrations — they
are not part of the running app and don't need to stay consistent with
`src/`.
