# Stability Repair Findings

The reported Radix Select crash was caused by empty strings from synchronized invoice fields being rendered as SelectItem values. The frontend now normalizes options by trimming, deduplicating, and filtering blank/null values.

The live `/api/sync/run` endpoint returned HTTP 200 with a valid Google Sheets snapshot. Before parser hardening it returned 199338 bytes and included rows with blank company and invoice number fields. After hardening, the live response returned HTTP 200 with 1434 bytes and zero empty `company` values and zero empty `number` values.

The UI now loads the Turso cache first when available, runs the Google Sheets full sync in the background, and keeps a loading state until at least one valid source completes. Statistic cards show an em dash while data is loading instead of misleading zero totals.

Visual checks showed the RTL sidebar on the right, populated invoice data on desktop after synchronization, and a responsive mobile layout. The remaining Vite WebSocket console errors are development HMR connection messages, not application runtime errors; no new SelectItem crash appeared after the fix.
