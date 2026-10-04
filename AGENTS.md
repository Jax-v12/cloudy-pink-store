<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


Role & Context:
You are an Expert Fullstack & Security Engineer working on "Cloudy Pink Store", a Next.js App Router digital product e-commerce. You prioritize security, atomic database operations, and clean architecture.

Architecture & Tech Stack:

Framework: Next.js App Router (TypeScript).

Database & ORM: PostgreSQL/MySQL via Prisma (src/lib/prisma.ts).

Payments: Midtrans (Snap & Core API).

State Management: React Context (specifically for Language/i18n handling).

Strict Development Rules:

Atomic Transactions Only: Whenever updating AccountStock and Order status, ALWAYS use prisma.$transaction. Never write sequential database updates that could cause race conditions.

Encryption by Default: Any sensitive digital product credentials (passwords, license keys) that must be stored must be encrypted using src/lib/crypto.ts before database insertion. Decryption of sensitive credentials must only occur server-side after proper authorization. Never expose encryption keys or perform cryptographic decryption in client-side code.

Cron Job Integrity: Do not modify src/app/api/cron/cleanup/route.ts without ensuring that the query strictly targets expired lock-times and safely releases AccountStock back to 'READY' status.

No Secrets in Notifications: When invoking src/lib/telegram.ts, only send non-sensitive metadata (Invoice ID, Total Amount, Status). Never log or transmit user emails, product credentials, or API keys in messages.

Multi-Language UI: Hardcoding text strings in UI components is forbidden. All new text must use the translation maps and be consumed via LanguageContext from src/context/LanguageContext.tsx.

Webhook Validation: All changes to src/app/api/webhook/payment/route.ts must maintain strict SHA-512 signature verification. Do not trust incoming gross_amount without matching it against the database totalAmount.

Agent Skill Syncing: If implementing new Prisma patterns, refer to the established core concepts defined in .agents/skills/prisma-platform-core-concepts/SKILL.md.

## Product Architecture

Cloudy Pink Store has three major service categories:

1. Apps Premium
2. Roblox Top-up
3. Game Top-up

Apps Premium is an existing mature feature. Do not redesign, remove, or break
existing Apps Premium behavior unless the task explicitly requires it.

Current development priority is Roblox Top-up.
Game Top-up will be developed later.

## Roblox Architecture

Roblox must support all three fulfillment methods:

- GAMEPASS
- LOGIN
- GIFT_USERNAME / Username

Do not remove one method simply because another method is currently being worked on.

### Gamepass Flow

The intended Gamepass checkout flow is:

1. Customer selects Robux amount using a slider.
2. Amount follows the configured min, max, and step values.
3. Price is calculated from the admin-configured Gamepass rate.
4. Customer enters Roblox username/customer information.
5. Show the exact Gamepass price the customer must create.
6. Customer creates the Gamepass.
7. Customer submits the Gamepass URL.
8. Customer proceeds to payment.
9. Payment is verified.
10. Order enters Roblox fulfillment.
11. Admin processes the Gamepass purchase.
12. Order is marked completed.

The server must always recalculate Robux quantities and prices.
Never trust price or Robux values submitted by the browser.

### Roblox Via Login

Via Login remains a supported Roblox method.

Keep its workflow separated from Gamepass and Username fulfillment.

Avoid permanently storing Roblox passwords.
Do not expose credentials in logs, notifications, analytics, or URLs.

If sensitive account access is ever required, it must use a dedicated secure
server-side workflow and strong admin authorization.

### Roblox Via Username

Via Username remains a supported Roblox method.

It has its own checkout and fulfillment workflow and must not be merged into
Gamepass simply for implementation convenience.

## Roblox Admin

### Top-up Catalog

"Katalog top-up" is the admin configuration area for Roblox products and methods.

It may manage:

- Roblox fulfillment method
- active/inactive status
- pricing or rate
- fixed packages
- minimum Robux
- maximum Robux
- quantity step/increment
- other method-specific configuration

Gamepass may use dynamic Robux quantities instead of requiring fixed packages.

### Fulfillment Room

"Ruang pengiriman" is the Roblox fulfillment dashboard.

It should let the admin review and process orders from:

- Gamepass
- Login
- Username

Use clear business-facing statuses rather than exposing implementation details
such as workers unless those details are genuinely useful to the admin.

Typical statuses may include:

- awaiting payment
- payment confirmed
- awaiting customer data
- ready for fulfillment
- processing
- completed
- requires review

## Development Workflow

Before modifying Roblox functionality:

1. Inspect the existing implementation and current git/worktree changes.
2. Preserve completed work unless it conflicts with the current task.
3. Do not recreate features that already exist.
4. Read plan.md for the broader implementation plan.
5. Make the smallest coherent change necessary.
6. Run relevant Prisma validation, typecheck, tests, and/or production build.
7. Fix errors caused by the change before declaring the task complete.

When AGENTS.md and plan.md overlap:

- AGENTS.md contains persistent project rules and architectural constraints.
- plan.md contains the current implementation roadmap and task details.

Do not assume unfinished plan items are already implemented. Verify the codebase.

## Current Priority

The current development priority is completing the Roblox module.

Unless explicitly requested otherwise:

1. Prioritize Roblox work over Game Top-up.
2. Preserve the existing Apps Premium implementation.
3. Do not implement Game Top-up yet.
4. When working on Roblox, follow the architecture defined above and the current plan.md.
5. If the user's latest instruction conflicts with plan.md, follow the user's latest instruction and update the implementation accordingly.

## Roblox Via Username Persistent Rules

When working on Roblox Via Username (`GIFT_USERNAME` / Username):

- Keep it as a distinct fulfillment method; do not merge it into Gamepass or Login.
- Never request or store Roblox passwords, OTPs, cookies, backup codes, or other account secrets.
- Customer flow should use: information -> account details -> payment -> final confirmation -> payment page/invoice.
- Username lookup must distinguish "not found" from temporary Roblox API failure.
- Amount selection may use a slider/input driven by admin configuration (`baseUnits`, `basePriceIdr` or equivalent rate, `minUnits`, `maxUnits`, `unitStep`).
- Do not hardcode example prices. Server-side code must recalculate and validate amount and price before creating the order.
- Do not create an order/payment transaction merely because the customer changes wizard steps; create it only at final confirmation.
- After payment confirmation, the order must enter Roblox fulfillment as Username and remain incomplete until admin/worker fulfillment is confirmed.
- Reuse existing payment, invoice, i18n, and Roblox checkout components when possible instead of duplicating flows.

