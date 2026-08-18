# Project TODO

- [ ] Establish password-only Arabic authentication with bcrypt hashing and secure session cookies
- [ ] Add password-change flow from the Sidebar with current-password verification
- [ ] Define invoice, payment_state, shared_links, settings, and synchronization metadata schema
- [x] Add Turso/libSQL-compatible database configuration using environment variables only
- [ ] Implement Google Sheets server integration for spreadsheet 165i0kvqpZNNufPdD6AjPW3AsDcSBAAlokNlPc4Ylp8E and tab sheet1
- [x] Add Google Apps Script integration template targeting the configured spreadsheet and sheet1
- [x] Preserve Google Sheets formulas for due date, remaining amount, and payment status in the Apps Script upsert contract
- [x] Implement stable invoice IDs in column L and backfill missing IDs safely
- [x] Implement Google Apps Script installable-trigger template and sync-token loop protection
- [ ] Implement page-load sync status check and periodic fallback synchronization
- [x] Build invoice CRUD with permanent deletion confirmation and paid-state tracking
- [x] Build Arabic RTL mobile-first dashboard with Sidebar and premium visual system
- [x] Add dropdown values derived dynamically from Google Sheets with deduplication and sorting
- [x] Add combined filters, quick filters, invoice-number search, and 100-row table limit in the dashboard UI
- [x] Add live filtered dashboard statistics for invoice and debt totals
- [x] Add read-only shared links that persist filters and refresh from current data
- [x] Add initial shared-links management page shell in the Sidebar
- [x] Add shared-link management page with open, copy, enable, disable, and delete actions
- [ ] Add filtered RTL Excel export with report title, filters, statistics, table, and totals
- [ ] Add filtered RTL PDF export with Cairo typography and pagination-safe tables
- [x] Add PWA manifest and install metadata
- [x] Add PWA icons and safe static-shell service worker caching
- [x] Add Vitest coverage for invoice logic, filtering/statistics, derived fields, and sync idempotency
- [ ] Add Vitest coverage for authentication and shared links
- [x] Run typecheck, tests, visual verification, and production build
- [x] Document required external setup for Google Apps Script, Turso, and production secrets in docs/production-setup.md
- [x] Wire the configured secrets and backend procedures for production data access (live Google doGet and Turso read verified)

# Repair Pass — User Requirements

- [x] Replace all default-looking controls with a consistent modern accounting SaaS control system
- [x] Remove non-essential marketing copy and duplicate headings from the primary workflow
- [ ] Make the header practical: title, compact sync button, and add-invoice action only
- [ ] Rework invoice form sections, polished dropdowns, and readonly calculated fields
- [ ] Rework filters toolbar with due/status/date filters and mobile-friendly interaction
- [ ] Rework statistics cards, table, badges, actions, search, pagination, and modal styling
- [x] Remove placeholder sync messaging and connect the sync button to a real backend operation
- [x] Make the Google Apps Script deliverable copy-paste ready with the exact spreadsheet schema and safe formula handling
- [x] Implement real Google Sheets ↔ Backend ↔ Turso ↔ Website sync contracts for create/update/delete
- [x] Load dropdown options from synchronized Google Sheet data only; never hardcode business values
- [x] Add sync loading/success/failure states with concise Arabic user messages
- [ ] Verify the seven requested sync and dropdown scenarios with automated tests or explicit configuration checks
- [x] Re-test desktop and mobile UX after the repair pass and save a new checkpoint

# Full Integration Pass — User Requirements

- [x] Add a real Turso/libSQL adapter using TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
- [x] Create runtime Turso schema for invoices cache, payment state, shared links, settings, and sync metadata; applying it requires configured Turso credentials
- [x] Persist Google Sheet full snapshots in Turso using ID as the stable key
- [x] Protect /api/sync/sheets with the shared token and reject replayed/duplicate snapshots
- [x] Make full sync update Turso before returning data to the website
- [x] Connect website create/update to Backend validation, Google Apps Script upsert, Sheet recalculation request, Turso update, and UI refresh
- [x] Connect website delete to Backend, Apps Script deleteRow, Turso deletion, and UI refresh
- [x] Add idempotent sync event records and origin metadata to prevent duplicate full snapshots
- [x] Load current dropdown options from synchronized data returned by full sync
- [x] Connect the CRUD sync functions to Backend endpoints and remove sync placeholder actions from CRUD flow
- [x] Add automated integration-contract tests for Apps Script upsert, delete, snapshot parsing, and missing-secret behavior
- [x] Execute live end-to-end checks after user supplies Turso credentials and publishes Apps Script; document external setup

# Sync Safety Fixes

- [x] Validate Apps Script doPost JSON responses and reject ok:false or malformed responses
- [x] Remove create/update fallback success when post-write full sync does not return the saved invoice
- [x] Confirm delete success and post-delete synchronization before deleting from Turso and UI
- [x] Add tests covering Apps Script ok:false responses and CRUD confirmation failures

# Final Review Gaps

- [x] Align Apps Script README backend URL instructions with Code.gs path concatenation
- [x] Replace invoice form company/governorate/warehouse inputs with synchronized dropdowns
- [x] Add backend confirmation-failure tests for create/update/delete after post-write full sync

# Route-Level Sync Tests

- [x] Add route-level-equivalent handler coverage for POST and PATCH invoice confirmation failures
- [x] Add route-level-equivalent handler coverage for DELETE invoice confirmation failure

# Shared Link Review Fix

- [x] Add an explicit open/view action for each shared link in the management page

# Google Apps Script Final Review

- [x] Separate backfillMissingIds from snapshotRows so reads never mutate the Sheet
- [x] Add explicit full-snapshot semantics and prevent destructive deletes for event snapshots
- [x] Make Apps Script upsert/delete responses semantically accurate, including NOT_FOUND and unknown action errors
- [x] Add try/catch JSON error handling in doGet and doPost
- [x] Ensure setupTriggers creates one trigger per function after deleting old triggers
- [x] Verify Code.gs contract against current Backend token and endpoint behavior
- [x] Update Script Properties and deployment instructions with no secret values
- [x] Test the final Code.gs contract and save a checkpoint before delivery

# Arabic RTL UI Polish

- [x] Remove remaining marketing copy and replace hero messaging with practical invoice context
- [x] Make all visible interface copy consistently Arabic and RTL-oriented
- [x] Redesign primary, secondary, ghost, icon, filter, and row-action buttons
- [x] Improve spacing, focus states, hover states, disabled states, and mobile button sizing
- [x] Polish sidebar, header, cards, filters, modal, table, and empty states without changing business logic
- [x] Verify typecheck/tests/build and desktop/mobile RTL visual captures after the new checkpoint preview
- [x] Save a checkpoint for the UI polish pass

# UI Verification Follow-up

- [x] Add explicit disabled-state styling for polished buttons
- [x] Capture and review the refreshed mobile RTL screenshot after the UI changes; Service Worker v3 no longer caches HTML

# Full Stability and Sync Repair

- [x] Fix every Select.Item empty-value path in dashboard and invoice form
- [x] Add a safe option normalizer for blank, null, and duplicate Google Sheet values
- [x] Verify frontend sync does not render or overwrite data before a valid snapshot arrives
- [x] Inspect and fix Google Apps Script live snapshot parsing and field mapping
- [x] Verify Backend sync response and Turso persistence with current secrets
- [x] Add regression tests for blank Sheet options and empty/malformed snapshot rows
- [x] Re-run desktop/mobile preview, typecheck, full tests, live sync check, and build
- [x] Save a stability repair checkpoint

# Snapshot Validation Follow-up

- [x] Reject Google Sheet rows that lack required business fields or a stable ID
- [x] Add tests for malformed row shapes and missing required invoice fields
- [x] Re-run live sync and confirm blank business-field records are excluded

# Stable ID Enforcement

- [x] Reject Google Sheet rows without a stable ID in column L instead of generating a random ID
- [x] Add regression coverage for missing IDs and short malformed rows
- [x] Re-run live sync and verify returned invoices all have stable IDs

# Vite HMR WebSocket Repair

- [x] Inspect Vite server HMR host/port/protocol settings and recent logs
- [x] Configure the managed preview to avoid the unreachable internal HMR WebSocket without breaking production
- [x] Restart the dev server and verify a cache-busted browser page has no console output or failed WebSocket connection
- [x] Run typecheck, tests, build, and save a repair checkpoint

# HMR Follow-up

- [x] Prevent Vite browser HMR client from attempting the unreachable internal 5173 WebSocket
- [x] Verify the preview remains fully functional with manual reload when HMR is unavailable

# User Request — Sidebar and CRUD Sync Verification

- [x] Keep the sidebar hidden by default on mobile and reveal it only after the sidebar toggle is clicked
- [x] Verify invoice creation writes to Google Sheets and returns to the website/Turso
- [x] Verify invoice editing updates the website, Turso, and Google Sheets details
- [x] Verify invoice deletion removes the record from the website, Turso, and Google Sheets
- [x] Add regression tests for create/update/delete synchronization
- [x] Add regression coverage for sidebar default-hidden and open-on-toggle behavior
- [x] Re-test the live preview, Google Apps Script sync path, typecheck, tests, build, and save a checkpoint

# Desktop Sidebar Visibility Fix

- [x] Ensure the desktop sidebar is hidden on initial page load and opens only through the menu button
- [x] Verify desktop initial state and toggle behavior visually, then run tests/build and save a checkpoint

# Full UI Redesign and Export Verification

- [x] Study the provided UI UX Pro Max and 21st.dev references and record applicable design decisions
- [x] Redesign the complete Arabic RTL dashboard, sidebar, header, filters, cards, table, dialogs, empty states, and shared-links view
- [x] Verify Excel export downloads a valid workbook-compatible file with the current filtered data
- [x] Verify PDF export produces a readable RTL document with the current filtered data
- [x] Verify creating a shared link persists it and opens a working read-only filtered view
- [x] Add regression tests for exports and shared-link creation via export helpers plus live endpoint/read-only route verification
- [x] Run visual checks, typecheck, tests, build, and save a redesign checkpoint
