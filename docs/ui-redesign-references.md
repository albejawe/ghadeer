# UI Redesign Reference Notes

## UI UX Pro Max

The reference emphasizes treating visual styles as engineering decisions rather than isolated aesthetics. Applicable principles for Hisabati are a deliberate design system before components, strong contrast, responsive layout, SVG icons instead of emoji, visible hover/focus feedback, accessible dark/light contrast, and restrained motion limited primarily to loading and state feedback. The reference also presents tokenized color systems and reusable style rules rather than ad-hoc component styling.

## 21st.dev

The reference presents a registry of copy-owned React components and templates. Its applicable direction is to compose an interface from crafted, reusable primitives—navigation, cards and grids, buttons, sign-in/widgets, and sections—while preserving ownership and adapting components to the product. For Hisabati this means a coherent component grammar: a compact command/header area, a clear responsive sidebar, metric cards with hierarchy, an actionable filter toolbar, a readable invoice table, and focused dialogs rather than a collection of unrelated controls.

## Decisions for Hisabati

The redesign will keep Arabic RTL and Cairo typography, use a calm finance-oriented navy/teal palette with a warm neutral background, increase hierarchy through spacing and type scale, keep interactions keyboard-visible, use consistent 10–16px radii and soft elevation, avoid marketing copy, and reserve animation for loading, hover, and drawer transitions. Desktop and mobile will share the same component language; the sidebar remains closed by default and opens as an overlay from the RTL right edge.

## Live Verification Note

The live `/api/invoices` endpoint returned four cached invoices with HTTP 200, and `/api/shared-links` returned persisted links with HTTP 200. The current page can remain visually in its loading state while `/api/sync/run` is pending, so export and shared-link testing should use the cached data path or a bounded sync fallback rather than blocking the whole dashboard indefinitely.

## Export Verification Note

The redesigned dashboard loaded four live invoices after the sync completed. Clicking the Excel action produced the success toast `تم تنزيل النتائج الحالية`, confirming that the current filtered rows are passed to the new `.xls` download path.

## PDF Verification Note

The PDF action changed the document title to `تقرير الفواتير - حساباتي` and invoked the browser print flow. The print-specific CSS is configured to hide navigation, filters, controls, and row actions while preserving the RTL invoice table, so the browser's Save as PDF flow produces the report document.

## Shared Link Verification Note

The shared-link POST endpoint succeeds and persists links, but opening `/shared/{id}` currently renders a blank root in the preview. The management endpoint is working; the public read-only route still needs an implementation or route registration fix before the shared-link requirement can be marked complete.

## Shared Route Debug Note

The public API returns HTTP 200 with the expected link metadata and four invoices, while the React route still renders an empty root and the browser console shows no reported error. The route component will be hardened with an explicit loading/error shell and a stable route-id extraction fallback so the read-only view cannot remain visually blank when the router parameter is unavailable.

## Second Shared Link Attempt

A newly created link returned HTTP 201, but the browser still showed an empty root during the initial and post-load views. This indicates the issue is in the client route lifecycle or preview rendering rather than link persistence alone; the next check should inspect the live DOM and the public fetch response for the new ID before marking the feature complete.
