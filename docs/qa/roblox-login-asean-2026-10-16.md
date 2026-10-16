# Via Login ASEAN phone picker — local QA, 16 October 2026

Historical country-picker/mockup checkpoint. The owner subsequently approved
operational access; see [current operational QA](roblox-login-access-2026-10-16.md)
and the [updated implementation design](../plans/roblox-login-account-access.md).

Partial delivery: ASEAN country selection and flags are implemented. Password and
five backup-code fields are not implemented. A pending owner clarification asks
whether these should be a disabled visual mockup or operational admin access.
The concrete [access proposal](../plans/roblox-login-account-access.md) is ready for
review before changing the current account-secret contract.

## Change

- Prioritize ID, MY, PH, SG, TH, VN, BN, KH, LA, MM and TL in a localized ASEAN
  optgroup. Retain every other supported country in a separate group without
  duplicates. Country names use the existing ID/EN/MY locale mapping; calling codes
  still come from the installed libphonenumber metadata.
- Display a local SVG flag beside the selected ASEAN country, including on Windows.
  Keep the native select's keyboard interaction and accessible country-name label.
  The flag is decorative. No flags are promised for non-ASEAN selections.
- Do not alter phone normalization, GeoIP, pricing, checkout APIs, attempt recovery,
  payment adapters, persistence, credentials or fulfillment behavior.
- Local assets are the eleven 4:3 SVGs from
  [flag-icons v7.3.2](https://github.com/lipis/flag-icons/tree/v7.3.2/flags/4x3), with
  its MIT license retained in `public/flags/LICENSE.txt`. SVGs were checked for
  script/event handlers, foreignObject and external references before use. They are
  served locally without a runtime CDN or new package dependency.
- Membership checked against [ASEAN](https://asean.org/about-asean/); numbering
  references checked against [ITU](https://www.itu.int/oth/t0202/en).

## Evidence

| Check | Result | Limits |
| --- | --- | --- |
| Focused Login domain tests | 7 PASS, 0 FAIL | Existing mock/provider isolation |
| Full local test suite | 118 PASS, 0 FAIL, 9 SKIP | DB/HTTP/migration prerequisites not authorized/run |
| TypeScript | PASS | `tsc --noEmit` |
| Full lint | 0 errors, 3 warnings | Existing StoreShell image and two staging-script unused variables |
| Changed-file lint | PASS, no warnings | Includes final browser test edits |
| Production build | PASS | Isolated source copy, no environment files, closed synthetic localhost DB target |
| Login Playwright regression | 39 PASS, 0 FAIL | 9 new ASEAN cases plus 30 existing; all APIs are fixtures |
| Post-mutation focused browser | 1 PASS, 0 FAIL | Restored original build |
| Whitespace/staged checks | PASS | No staged changes |

The new cases cover all 11 flag decodes, ordering, localization, complete unique
international-country coverage, keyboard focus/selection, US compatibility,
Indonesian national-number normalization in the summary, no early orders, no contact
storage and no page overflow. Screenshots were captured for ID/EN/MY at 375×812,
810×1080 and 1440×900; representative mobile/tablet/desktop layouts were visually
inspected. Synthetic contacts only. Screenshot location:
`.cache/login-qa/attempt-flow/<width>-<locale>-asean-account.png` (not for Git).

TDD: the focused new browser test failed on the previous production build because
the ASEAN group was absent. Initial development-server probes timed out during cold
compilation and were not counted as product failures. The first new tests also
exposed an asynchronous test assertion before the summary had finished loading;
the test now waits for the actual normalized-number element, without changing its
expected value. During review, inverting the other-country exclusion in the isolated
compiled client made the focused test fail; the build was restored byte-for-byte
and the focused test passed again.

Build warnings: inferred workspace root/multiple lockfiles in the isolated nested
copy, and one generated CSS unexpected-token warning. The latter was not attributed
to a baseline or fixed by this scoped change; tested layouts passed. No quality gate
was disabled or configuration changed to suppress a warning.

## Handoff

Branch preserved: `feat/roblox-login-checkout-recovery`, baseline `22402a5`. Actual
Git state takes precedence over the older main-branch workflow note. Existing
untracked skills, skills-lock and workflow files were left untouched. This work is
local and uncommitted; no push/deploy, schema/environment change, database access,
real order/payment or customer credential collection. Goal remains incomplete
pending the account-access decision and the corresponding implementation.

## Complete field-layout preview

The follow-up adds only `docs/plans/roblox-login-account-preview.html`, a standalone
Indonesian design review artifact with username, password, WhatsApp/country flag,
notification email and five backup-code fields. It is not a storefront route and
does not enable collection. All nine inputs, one selector and both buttons are
disabled, every value is empty, and there are no forms or scripts. Its document CSP
also disallows submission. The page reuses the checked local ASEAN flags.

Three isolated Playwright preview checks PASS at 375×812, 810×1080 and 1440×900:
disabled-field counts, six masked password/code controls, empty values, successful
flag decoding, zero page errors/unexpected requests and no page overflow. Mobile
and desktop screenshots were visually inspected. Local screenshots are at
`.cache/login-qa/account-preview/{375,810,1440}.png`; they are excluded from Git.
No application code changed in this follow-up, so previous application checks were
not repeated. The goal remains active and incomplete pending the owner decision.
