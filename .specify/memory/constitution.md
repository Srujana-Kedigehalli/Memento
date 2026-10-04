<!--
Sync Impact Report
Version change: 2.1.0 → 3.0.0 (MAJOR: a principle's stated requirement is superseded)
3.0.0 amendment (2026-09-30): Principle VI no longer requires a phone OTP for guests. Guest
  verification now goes through a channel-agnostic VerificationProvider interface,
  send(identifier) / verify(identifier, code), with the identifier and channel configurable. The
  current channel is email, delivered through the existing Mailer. Everything else refers to a guest
  only by guest_id, never by the identifier, so a later switch to phone/SMS is one new provider
  implementation plus configuration. The self-checking placeholder provider and the MSG91 candidate
  are removed; there is no placeholder any more because the built-in email provider performs real
  verification. Principle XII generalized from phone numbers and OTP codes to guest identifiers and
  verification codes.
  Bump reasoning: the project's own policy makes redefining or removing a principle's requirement a
  MAJOR change. The intent of VI (real identity before uploading or reporting) is unchanged, but the
  requirement it stated (phone OTP) is replaced and everything built on phone identity is affected.
  Downstream: spec.md, plan.md, research.md, data-model.md, contracts/api.md, quickstart.md and
  tasks.md in specs/002-identity-trust-media updated to match ✅. README.md ⚠ still pending.
Prior 2.1.0 amendment (superseded by 3.0.0): Principle VI no longer names MSG91; guest OTP goes through a pluggable
  provider interface (send(phone), verify(phone, code)) with a self-checking placeholder
  provider for now. MSG91 is a candidate only, pending DLT registration feasibility.
  Additional templates/docs: spec.md Assumptions (002-identity-trust-media) ✅ updated to be
  provider-agnostic; README.md ⚠ pending (still describes Phase 1 model).
Prior 2.0.0 history (1.0.0 → 2.0.0, MAJOR: principles removed/redefined):
Modified principles:
  - I. Single Event, Single Host → I. Multi-Tenant: Many Hosts, Many Events (replaced)
  - II. YAGNI / Build for the Users We Have → II. Build Only for Observed Need (reworded, same intent)
  - III. One Application, No Separate Services → III. One Application, No Separate Services (unchanged in substance)
  - IV. Raw SQL, No ORM → IV. Raw SQL, No ORM; Data API Disabled (merged with old VII's Data API rule)
  - V. Synchronous by Default → V. No Queues Beyond the Daily Cron Sweep (narrowed to allow one daily cron)
  - VI. Open Access, No Gating → removed (superseded by VI. Real Identity, Viewing Stays Open)
  - VII. Server-Only Data Access → folded into IV
Added sections:
  - VI. Real Identity: Host Email+Password, Guest Phone OTP
  - VII. Server-Side Hashed Sessions
  - VIII. Validate All Input Server-Side
  - IX. Host Is Hands-Off During the Event
  - X. Reports Hide Immediately
  - XI. Harmful-Report Evidence Survives Deletion
  - XII. Never Log Secrets or Identifiers
  - Out of Scope for This Cycle
Removed sections: none (Deployment & Operations, Development Workflow retained; Development Workflow extended)
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no change needed (Constitution Check reads this file at plan time)
  - .specify/templates/spec-template.md ✅ no change needed
  - .specify/templates/tasks-template.md ✅ no change needed
  - .specify/templates/checklist-template.md ✅ not re-read; generic, no constitution placeholders expected
  - README.md ⚠ pending: still describes the Phase 1 PIN/anonymous-guest model and the
    SESSION_SECRET/PIN cookie; needs MSG91 env vars and the new auth model when implemented
Follow-up TODOs:
  - Direct-to-Storage photo uploads via presigned URL (README) are not addressed by these
    principles; decide explicitly at plan time rather than assuming.
-->

# Memento Constitution

## Core Principles

### I. Multi-Tenant: Many Hosts, Many Events
Memento supports many hosts, each managing many events. Every event, photo, report, and
session MUST be scoped to its owning host or event, and every query touching tenant data MUST
enforce that scope. This replaces the Phase 1 "one host, one event" rule entirely; nothing
in Phase 1's single-event, PIN-based design carries forward.

### II. Build Only for Observed Need
Build only for the users and problems actually observed. Infrastructure, scale-handling,
caching, and features MUST NOT be added ahead of a proven need. Speculative extensibility
MUST NOT influence current implementation decisions.

### III. One Application, No Separate Services
Next.js on Vercel is the entire application: frontend and API together. There is no
standalone backend service, no separate API server, and no microservices.

### IV. Raw SQL, No ORM; Data API Disabled (NON-NEGOTIABLE)
All database access uses raw SQL via the `pg` library against Postgres. No ORM (Prisma,
Drizzle, TypeORM, etc.) may be introduced. Supabase's Data API is disabled, and the browser
MUST NEVER connect to Postgres or the Data API. All database access happens server-side in
Next.js API routes / Server Actions.

### V. No Queues Beyond the Daily Cron Sweep
No queue, background job processing, or realtime subscription is permitted beyond the single
daily cron sweep, until a real need for more frequent or event-driven processing is observed
and recorded as an amendment.

### VI. Real Identity, Viewing Stays Open
Hosts authenticate with email + password. Guests verify their identity with a one-time
code before they can upload or report. Guests MUST NOT be required to verify before viewing:
viewing stays open to anyone with the event link. There is no PIN and no anonymous
session-only guest.

Guest verification MUST go through a channel-agnostic `VerificationProvider` interface with
exactly two operations: `send(identifier)` and `verify(identifier, code)`. The identifier and
the channel are configurable and MUST NOT be hardcoded to any one kind (email, phone, or
otherwise). The current channel is email, delivered through the existing Mailer. An
implementation owns validating and normalizing identifiers of its own channel. No code outside
the provider implementation may depend on which provider or channel is active, or name a
specific vendor. Sessions, consent, media, reports, and every other part of the system MUST
refer to a guest only by `guest_id`, never by the identifier itself. Switching channels, for
example to phone/SMS, MUST require only adding one provider implementation and changing
configuration. Verification codes are secrets: single-use, expiring, attempt-limited, and
stored only in hashed form.

### VII. Server-Side Hashed Sessions
Every session, host or guest, is stored server-side as a hashed token. Sessions MUST NOT be
JWTs, and tokens MUST NEVER be stored in plain text.

### VIII. Validate All Input Server-Side
Every piece of user-supplied input MUST be validated explicitly on the server. No field is
trusted because the frontend happens to constrain it.

### IX. Host Is Hands-Off During the Event
By default the host does nothing during their own event. Routine moderation queues silently
for after the event. Only a report classified `harmful` interrupts the host in real time.

### X. Reports Hide Immediately
A report MUST hide its target immediately, before any review. Visibility is the harm, so
removal first is the safer default.

### XI. Harmful-Report Evidence Survives Deletion
Evidence of a harmful report, whether upheld or auto-held with no review, MUST survive even
when its media and event are later deleted. This is a stated exception to normal cascade
deletion, not an oversight; schema and deletion logic MUST preserve it explicitly.

### XII. Never Log Secrets or Identifiers
Guest identifiers (email addresses or phone numbers), verification codes, and session tokens
MUST NEVER be logged anywhere, especially on auth routes. This includes error handlers,
request logging, and third-party call traces.

## Out of Scope for This Cycle

Pricing/payments, the NSFW classifier, co-hosts, accessibility beyond age/tech-comfort, and
video upload are out of scope. Any spec, plan, or task touching these MUST be flagged as an
open question rather than decided.

## Deployment & Operations

Deployment is Vercel, connected to the GitHub `main` branch, with auto-deploy on every push
to `main`. There is no separate staging infrastructure, manual deployment gate, or additional
environment unless a real need is observed and documented as an amendment.

## Development Workflow

When a decision is not explicitly covered by this constitution, it MUST be flagged as an open
question (e.g., `NEEDS CLARIFICATION` in the spec, or the plan's Complexity Tracking section)
rather than resolved by assumption. Implementers MUST NOT silently introduce an ORM, queue,
realtime feature, payments, additional services, or out-of-scope items to "future-proof" the
app; any such need MUST be raised explicitly and, if approved, folded in by amendment.

## Governance

This constitution supersedes all other practices, templates, and prior conventions for the
Memento project. Amendments require: (1) a documented rationale referencing a specific
observed need, not a hypothetical, (2) an update to this file with a version bump per the
policy below, and (3) a check of dependent templates (`plan-template.md`, `spec-template.md`,
`tasks-template.md`, `checklist-template.md`) and README for consistency.

Versioning policy: MAJOR for backward-incompatible governance changes or removal/redefinition
of a principle; MINOR for adding a principle or materially expanding guidance; PATCH for
clarifications and wording fixes.

All plans and reviews MUST verify compliance with these principles, in particular III, IV,
V, VI, VII, VIII, X, XI, and XII, which directly constrain architecture and data handling.
Any deviation MUST be justified in the plan's Complexity Tracking section or rejected in
favor of a simpler approach.

**Version**: 3.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-30
