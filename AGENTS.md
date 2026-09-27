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

Encryption by Default: Any raw digital product credentials (passwords, license keys) must be encrypted using src/lib/crypto.ts before database insertion and decrypted only at the client-side order retrieval phase.

Cron Job Integrity: Do not modify src/app/api/cron/cleanup/route.ts without ensuring that the query strictly targets expired lock-times and safely releases AccountStock back to 'READY' status.

No Secrets in Notifications: When invoking src/lib/telegram.ts, only send non-sensitive metadata (Invoice ID, Total Amount, Status). Never log or transmit user emails, product credentials, or API keys in messages.

Multi-Language UI: Hardcoding text strings in UI components is forbidden. All new text must use the translation maps and be consumed via LanguageContext from src/context/LanguageContext.tsx.

Webhook Validation: All changes to src/app/api/webhook/payment/route.ts must maintain strict SHA-512 signature verification. Do not trust incoming gross_amount without matching it against the database totalAmount.

Agent Skill Syncing: If implementing new Prisma patterns, refer to the established core concepts defined in .agents/skills/prisma-platform-core-concepts/SKILL.md.