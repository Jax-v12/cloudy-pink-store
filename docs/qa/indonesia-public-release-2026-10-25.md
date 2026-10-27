# Indonesia market and Indonesian copy release — 25 October 2026

## Scope and source

The owner approved an Indonesia-only storefront release and selected Indonesian as the default language while retaining English and Malay. The existing LanguageContext already defaults to ID independently of browser language and preserves a saved EN/MY preference; its behavior is unchanged.

The release is prepared from Production source `fbe7e62e611971ee7708296a6564f57921f64016`, selectively applying Indonesia-market commit `5b2b85b6a80d370530401899e1d4f9de9dee4e9f` without committing its unrelated descendants. Admin consolidation commit `c43407d` and the primary checkout's unrelated local work are excluded. No schema, dependency, environment variable, payment mode, Telegram configuration, database write, stock change, or provider transaction is included.

## Resulting behavior

- New purchases and Apps renewals require trusted Indonesia location and IDR. MY/PH/unknown locations fail closed; stored regional prices and historical invoices remain intact. Existing committed checkout replay occurs before the new-purchase location gate.
- Apps Premium and all three Roblox methods remain present. The Game journey is preserved without activating a provider.
- Indonesian storefront, package forms, invoice, help, privacy, admin labels, and metadata use clearer Indonesian wording. Technical identifiers, translation placeholders, batch-input formats, Roblox product names and official Roblox menu labels are preserved.
- QRIS wording no longer advertises DuitNow or unsupported foreign wallets. Gateway errors no longer promise stock release, expired payment instructions ask already-paid customers to contact support, and contact-email wording no longer promises unverified email delivery. These factual corrections also apply to EN/MY.

## Verification on this release snapshot

| Check | Result and boundary |
| --- | --- |
| Unit/regression `tests/*.test.mjs` through `tests/register.mjs` | **226 PASS / 0 FAIL / 9 SKIP**; skipped groups require separately authorized disposable MySQL/HTTP/migration setup. No remote DB used. |
| TypeScript | PASS, zero errors |
| ESLint | PASS, zero errors; three pre-existing warnings (`StoreShell` image and two staging-test unused variables) |
| Production dependency audit (`npm audit --omit=dev`) | Zero reported vulnerabilities; no dependency changes |
| Translation keys/placeholders | 796 strings checked across ID/EN/MY; parity PASS |
| Isolated Next.js 16.4.2 production build, Node 24.22.1 | PASS with synthetic localhost-only configuration, no environment files; additional-lockfile root warning only |
| `tests/indonesia-copy.e2e.mjs` | **9 PASS**: 375×812, 810×1080, 1440×900 × ID/EN/MY; ID default despite en-US browser, language persistence, public routes and synthetic pending QRIS invoice; no horizontal overflow or page errors |
| `tests/indonesia-market.e2e.mjs` | **45 PASS**: same viewport/language matrix; catalog/detail location gating, Roblox method links, location drift, renewal rejection with invoice access preserved |
| Representative screenshot review | ID mobile home, MY tablet invoice, EN desktop invoice inspected; existing accepted mobile horizontal navigation retained |
| Independent code review and diff whitespace checks | PASS, no release-blocking finding |

Browser evidence uses local production rendering, in-memory catalog fixtures and intercepted invoice/payment APIs. It proves UI and handler behavior, not a real customer purchase, real account entitlement, Telegram delivery or live payment readiness. The new copy test initially exposed an in-flight renderer request during context teardown; waiting for route handlers before closing the context fixed the harness, and all nine cases then passed. An initial C-drive build snapshot could not follow the dependency junction outside the Turbopack root; the isolated D-drive snapshot built successfully.

The 24 October QA document contains historical integration results from its original task. Those are not reruns or substitutes for the nine skips reported above.

## Publication and operational boundaries

Publication target is the existing `origin/main`, existing Vercel project `cloudy-pink-store`, and `https://cloudy-pink-store.vercel.app`. At preparation, remote main is still `fbe7e62`. After pushing, verify the automatic deployment's exact source SHA, Ready state and Production alias, then run read-only smoke checks. Do not create a duplicate deployment or change the working feature branch.

A read-only public catalog check during preparation found one active CapCut package with one stock entry. Its public configuration still says testing draft/not for sale, device limits unconfirmed, and account coverage unverified. Stock count does not prove account validity. Final product terms and sale readiness require the owner's confirmation; this release does not invent those terms or rewrite remote catalog data. Live-payment approval and operational service readiness remain separate gates.
