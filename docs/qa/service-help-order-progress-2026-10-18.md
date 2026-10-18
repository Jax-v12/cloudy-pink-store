# Customer help, invoice progress and Roblox comparison — 18 October 2026

Owner scope: implement improvement priorities 1, 2 and 3 from the preceding review.
Branch preserved: `feat/roblox-login-checkout-recovery`; HEAD at verification:
`553ad13802ce8f8b9be30abe2df5760c66ba9630`. Changes are local and uncommitted.

## Result

- `/help` provides eight keyboard-operable FAQ disclosures, service terms and
  support guidance. Apps footer placeholders now point to `/help` and
  `/help#terms`. Public StoreShell pages expose the same links.
- Invoice progress follows the existing server-reported state. Top-ups show
  payment, queue, processing and completion; Apps show payment, account
  preparation and completion only when paid account details are available.
  Waiting-customer, review, expired, cancelled and refund states explain the next
  action. Review/closed/refund states do not show a normal success timeline.
  Existing polling updates the display; no new API or mutation is introduced.
- Roblox method cards compare required account information, delivery process and
  timing dependencies. All three existing method-specific links and availability
  rules remain. Gamepass pending time is distinct from team processing. No second
  method selector, guessed delivery SLA, uniform warranty period, fee or new price
  is added.
- All new customer text, accessible step descriptions and help links use
  ID/EN/MY through the existing translation map and LanguageContext.

## Files

- `src/app/help/page.tsx`: help page and native FAQ disclosures.
- `src/components/ServiceHelpLinks.tsx`: shared help/terms destinations.
- `src/app/apps/page.tsx`, `src/components/StoreShell.tsx`: discoverable links.
- `src/lib/orderNotice.ts`, `src/components/OrderProgress.tsx`,
  `src/app/order/[id]/page.tsx`: progress derivation and invoice rendering.
- `src/components/RobloxServiceCards.tsx`: comparison within the existing cards.
- `src/lib/serviceHelpTranslations.ts`, `src/lib/translations.ts`: ID/EN/MY copy.
- `tests/order-notice.test.mjs`, `tests/service-help.e2e.mjs`: behavior checks.
- `plan.md`: current handoff.

Preexisting modifications to admin, Apps OTP, Telegram, recent orders and their
tests were preserved. The existing invoice timer fix is still present; this task
adds only the progress import and component to that file.

## Verification

| Check | Result |
| --- | --- |
| Focused invoice tests | 7 PASS, 0 FAIL; includes three new progress tests covering payment, delivery, Apps, closed states and refunds |
| Regression suite, isolated environment | 189 PASS, 0 FAIL, 9 SKIP (198 total) |
| Browser fixtures | 37 PASS, 0 FAIL; separate FAQ screenshot recapture 1 PASS, overlapping the 37 |
| TypeScript | PASS, `npx tsc --noEmit` |
| Full ESLint | PASS, zero errors and three existing warnings |
| Changed-file ESLint | PASS, only existing StoreShell image warning |
| Isolated production build | PASS, Next.js 16.3.8, including `/help` |
| Whitespace and final diff review | PASS |

TDD: importing the absent progress helper first failed; implementation then made
the assertions pass. Inverting its PENDING comparison to PAID was detected by the
focused tests; the file was restored byte-for-byte and all seven tests passed.

Browser matrix: 375×812, 810×1080 and 1440×900, each with ID/EN/MY. Checks include
Apps-footer navigation, FAQ Enter-key open/close, terms anchor, three separate
Roblox checkout links, invoice queued-to-completed polling and help navigation.
Additional mobile scenarios cover PENDING with a stale completed fulfillment,
waiting for customer, both review states, expiration, cancellation, both refund
states, Apps with missing account details and unknown-region checkout denial.
No horizontal page overflow or page errors were observed. Mobile, tablet and
desktop screenshots were inspected; artifacts contain synthetic data only.

The first browser run stopped on an in-flight asset response being disposed
during context shutdown. The harness now waits for route handlers through
`unrouteAll({ behavior: 'wait' })` before closing. The subsequent complete run
passed all 37 cases. No application assertion or request-isolation check was
removed. The focused screenshot recapture scrolls back to the top after checking
the terms anchor, avoiding the full-page capture artifact from fixed backgrounds.

Build used a source copy under ignored `.cache/service-help-20261018/app`, with
no environment files and a dummy loopback database target on a closed port.
The Next build CLI was invoked directly; no Prisma generation was needed because
schema and generated-client contracts are unchanged. The nested-copy workspace
root warning and previously documented generated-CSS optimizer warning remain.
Lint warnings are the StoreShell image and two unused variables in staging tests.

The nine skips are six resource-gated MySQL/HTTP groups and three migration
suites. They were not run or counted as passing. All browser APIs are isolated
fixtures; these results do not establish real Roblox, Midtrans, remote database
or deployed integration behavior.

## Boundaries

No environment/credential change, database operation, provider call, customer
Order/payment creation, dependency change, schema/migration change, commit, push
or deployment was performed. The outstanding Login operational release checks
in the 17 October release QA remain separate. Product-specific warranty/refund
rules and response/delivery times require actual store policy before adding
specific promises to customer copy.

## Selected commit verification — 18 October 2026

The owner subsequently requested a commit on the existing feature branch and a
Vercel Preview review. Only the fourteen files for priorities 1–3 were selected.
The invoice file was partially staged: the new progress import/render are
included, while the preexisting uncommitted timer change remains unstaged with
the other Apps/admin/OTP/recent-order work.

An isolated snapshot of the Git index, including tracked test-support scripts,
passes 187 tests with zero failures and nine resource-gated skips. This differs
from the 189-pass working-tree result because unrelated local changes are
excluded. TypeScript/build and lint pass on the selected snapshot, with the three
existing lint warnings. The selected snapshot also passes all 37 isolated browser
cases described above. The initial snapshot runner was started before copying
finished, then lacked two tracked support scripts; those harness setup errors
were corrected before counting the final passing results.

The existing linked Vercel project has production branch `main`. The feature
branch Preview at `18162451b13a08acb9d7c8d9426f69945c0f0b3c` is READY, with `/`,
`/apps`, `/roblox` and `/games` returning HTTP 200; `/help` returns 404 because
this new implementation is not published there. That is a version mismatch,
not deployed evidence for the new feature. The local parent `553ad13` is also
unpublished and contains separate Apps OTP/schema changes; publishing this
branch would include that commit. No push or replacement deployment is implied
by this read-only review.

Authenticated real-Preview browser review used development OIDC authentication
scoped to the exact Preview origin. Nine page/viewport combinations (`/`, `/apps`,
`/roblox` at 375×812, 810×1080 and 1440×900) returned HTTP 200 without horizontal
overflow, page errors or blocked requests. Both public catalogs returned HTTP
200 at every size. `/help` returned the expected version-mismatch 404 at all
three sizes. No API fixture was used for this remote review. Only GET/HEAD and
the public product API were allowed; no checkout, payment, admin or real invoice
was opened. Evidence and public-page screenshots are under ignored
`.cache/service-help-preview-20261018/remote/`. These are screenshots of the
existing `1816245` Preview, not the new priorities 1–3 UI.

The Vercel connector lacked team access (403), and its deployment-card operation
was unavailable. The existing authenticated Vercel CLI succeeded for the same
linked project/team; no protection setting or environment value was changed.
