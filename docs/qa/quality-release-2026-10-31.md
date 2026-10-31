# Browser reliability, admin and public metadata release — 31 October 2026

Owner selected item 1: publish the prepared browser-storage/invoice, language, admin, metadata/sitemap/contact and transitive Zod fixes to the existing Cloudy Pink Store Vercel project.

## Scope

- Keep successful checkout invoice access in tab memory if durable storage fails after checkout. Show an explicit unsaved-access warning and retry-save action; block new checkout when the storage preflight fails. Preserve legacy invoice locators and existing server authorization; no new token URLs or browser credential storage.
- Keep ID/EN/MY selection usable when localStorage reads or writes are denied, and preserve cross-tab updates.
- Admin Apps products can load older pages for both stock selectors and the product list, retaining selection after refresh. Top-up package editing reuses the accessible dialog, restores focus, retains failed input and reports inline errors; busy dialogs cannot be closed accidentally.
- Public metadata/share cards, sitemap and robots use a validated canonical origin, with a trusted Production platform-domain fallback. Preview indexing stays blocked. Help/privacy contact links and Login privacy copy are localized without inventing warranty, refund or service-hour commitments.
- Refresh isolated Login staging/Sandbox fixtures for the existing encrypted-secret contract; an unsupported or unconfirmed simulator remains SKIP and never fabricates provider settlement. No staging/Sandbox execution is authorized by this release.
- Update transitive development dependency Zod 4.6.5 → 4.6.7 in a separate dependency commit. The advisory affects versions below 4.6.6: [GitHub advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Reviewed [upstream 4.6.7 release](https://github.com/colinhacks/zod/releases/tag/v4.6.7); no manifest or dependency-family upgrade.

## Exact release boundary

The snapshot starts at `039aa1d6f78e9fcdb5ac14e87ef49ffa1fcfde00` and overlays 43 explicitly listed source/test/lockfile files from the prior reviewed P2/public-metadata allowlist. Forty-one retain their prior QA hashes; the only expected differences are StoreShell and TopupCatalog, which now also preserve the already-published Game purchase pause/navigation changes.

The 43-file allowlist is recorded locally in `.cache/quality-release-20261031/allowlist.json`. This report and a dedicated roadmap entry add two documentation files, for 45 files across the dependency and application commits. Inventory drafts, CapCut product data, scheduler/backup utilities, P3 workflow documents, old unrelated QA, screenshots/cache and local agent skills are excluded. No API/schema/migration, authentication policy, environment/payment mode, provider transaction or remote database action is included.

## Verification

| Check | Evidence |
| --- | --- |
| Clean dependencies | `npm ci --ignore-scripts --no-audit --no-fund` PASS, 457 packages; lifecycle scripts disabled. It ran in the primary checkout after an incorrect working directory was detected. Prisma Client 6.19.3 was then regenerated explicitly from the environment-free snapshot using an unusable local test URL. The snapshot reuses those clean dependencies; lockfile hashes match. No database connection or root-source rewrite was required. |
| Warning | Installer reports ESLint 9.39.5 is deprecated. It remains the existing pinned toolchain; no unrelated ESLint/Next upgrade is included. |
| Exact snapshot | `.cache/quality-release-20261031/app`, no env files, unusable loopback port 0 database named `cloudy_test_quality_no_connection`. All 43 files match the tested snapshot bytes. |
| Full suite | **254 PASS / 0 FAIL / 9 SKIP**. Missing MySQL/HTTP/migration prerequisites remain SKIP; these are not remote/provider integration results. |
| Build/typecheck | Next.js 16.4.2 production build and build TypeScript check PASS; BUILD_ID `kYpVKvchEvk_nir86QpCe`. Empty APP_ORIGIN plus the public platform-host fallback was used deliberately. Nested snapshot lockfile/root warning is expected. |
| ESLint | Full snapshot lint PASS. Initial runner resolution used a non-exported ESLint subpath; invoking the installed CLI file fixed the runner without changing application code or lint rules. |
| Audit | Full native npm audit: **0 advisories**. The installed Zod version is 4.6.7. |
| Storage browser | **36 PASS**: blocked reads, preflight failure, post-checkout quota failure, invoice API failure, save retry and no duplicate checkout. |
| Admin browser | **10 PASS**: pagination/selection plus editor focus, busy-close prevention and failed-input retention in all locales/viewports. Synthetic auth/data only. |
| Public browser | **45 PASS**: five public routes, localized help/privacy/contact, head metadata, sitemap/robots, focus and overflow. Synthetic empty catalog; contacts were not opened or messaged. |
| Game pause regression | **36 PASS**: the existing homepage/nav pause, two-card layout, legacy route and Apps/Roblox navigation remain intact. |
| Mutation | A storage preflight failure was inverted on the snapshot; regression detected it. Original bytes were restored and 13 focused invoice/language/metadata tests PASS. |
| Visual review | Mobile ID unsaved-invoice warning, tablet MY editor error state and desktop EN privacy screenshots inspected. All browser tests use 375×812, 810×1080 and 1440×900 where applicable. |

Browser evidence totals **127 isolated scenarios**; it is not proof of a real customer transaction, provider settlement, authenticated Production admin operation or Aiven recovery readiness.

## Publication

Preflight complete. Target: existing project `cloudy-pink-store` (`prj_Oz6McF6kBIkykqRNw8cqo5ousj9m`), team `team_xR3F67Zs5jclFdfh9XhzU7dx`, Production domain `cloudy-pink-store.vercel.app`. Publish both reviewed commits through `main` in one push and wait for the Git-triggered deployment; do not create a duplicate deployment. Rollback candidate is the preceding READY release at `039aa1d`. Final matching-SHA/alias/read-only smoke evidence is recorded after deployment.
