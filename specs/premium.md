# Business Requirements Document (BRD)
## Feature: Super Admin — Premium Plan, Discount & Manual Subscription Management

**Project:** ExamPlanner
**Document Version:** 1.0
**Status:** Draft for Engineering Handoff
**Owner:** Product / Platform Team

---

## 1. Purpose

Today, `SubscriptionPlan` records are seeded only via scripts (`seed_database.py`) and paid subscriptions are created only through the Razorpay checkout flow. There is no way for a Super Admin to:

1. Create or edit subscription plans from an admin UI (without a deploy/script run).
2. Create discount offers (percentage or flat) and control who can use them.
3. Manually attach a plan or offer to a specific user (e.g., goodwill upgrades, beta testers, refund corrections, partner/influencer grants) without that user going through payment.

This document defines the business requirements for building that capability. **Payment gateway integration is out of scope for this document** — Razorpay checkout already exists and is not being changed. This feature sits alongside it, not inside it.

---

## 2. Goals

- Give Super Admins full self-service control over plan catalog and pricing without engineering involvement.
- Enable promotional/discount campaigns (seasonal offers, referral codes, targeted retention offers).
- Allow support/ops teams to grant or revoke Premium access to individual users, with a clear audit trail of who did it and why.
- Preserve data integrity of the existing paid-subscription flow — admin actions must never silently break real payment records.

## 3. Non-Goals (Out of Scope)

- Changes to the Razorpay payment/checkout integration itself.
- Automated recurring-discount application (e.g., "auto-apply loyalty discount every renewal") — v1 is single-use-at-checkout or single-grant only.
- Multi-currency support (assume existing currency handling is unchanged).
- Refund processing automation.

---

## 4. Stakeholders / Personas

| Persona | Need |
|---|---|
| **Super Admin** | Create/edit/deactivate plans and features; create discount offers; view redemption analytics |
| **Support Admin** (subset of admin permissions) | Grant/revoke a user's premium access manually with a reason; view a user's subscription history |
| **End User (Free/Guest)** | See current plan pricing, apply a discount code at checkout, see if they've been manually upgraded and by when it expires |
| **End User (Premium)** | See who/what granted their access (paid vs. gifted), see discount applied on their invoice/receipt |

---

## 5. User Stories

### Super Admin
- As a Super Admin, I want to create a new `SubscriptionPlan` (name, price, billing interval, features, limits) from the dashboard so I don't need a script/deploy.
- As a Super Admin, I want to edit an existing plan's price or included features, and see that changes don't retroactively alter already-active subscriptions' locked-in price.
- As a Super Admin, I want to activate/deactivate a plan so it stops showing on the pricing page without deleting historical data.
- As a Super Admin, I want to create a discount offer with a code, a value (% or flat), an expiry window, and a usage cap (total and per-user).
- As a Super Admin, I want to restrict a discount to specific plans (or allow it on all plans).
- As a Super Admin, I want to view how many times a discount has been redeemed and by whom.
- As a Super Admin, I want to manually assign a plan to a specific user (search by email/ID) without requiring payment, and record a reason for the grant.
- As a Super Admin, I want to revoke a manually-granted or paid subscription early, with a reason logged.
- As a Super Admin, I want an audit log of every plan/discount/grant/revoke action, showing who did it and when.

### End User
- As a user, I want to see current active plans and pricing on the pricing page.
- As a user, I want to enter a discount code at checkout and see the discounted price before paying.
- As a user, I want to know why I have Premium access if I never paid (e.g., "Upgraded by ExamPlanner Support on 12 Oct 2026 — Beta Tester Program").
- As a user, I want a clear notification (email + in-app) when my access is upgraded, downgraded, or revoked by an admin, distinct from the normal payment confirmation email.

---

## 6. Functional Requirements

### 6.1 Plan Management (Admin)
- FR-1: Admin can create a plan with: name, description, price, billing interval (MONTHLY/YEARLY/LIFETIME), active flag, and attached features with optional usage limits.
- FR-2: Admin can edit a plan. Price/feature changes apply only to *future* subscriptions; existing `UserSubscription` records keep their original locked-in price (snapshot, not a live reference).
- FR-3: Admin can deactivate (not hard-delete) a plan. Deactivated plans are hidden from `/plans` but remain valid for existing subscribers until their period ends.
- FR-4: Plan changes are logged in an audit trail.

### 6.2 Discount Offer Management (Admin)
- FR-5: Admin can create a discount offer: name, optional code, type (PERCENTAGE or FLAT_AMOUNT), value, applicable plan(s) (or all), validity window (start/end), max total redemptions, max redemptions per user, active flag, public/private visibility.
- FR-6: A "private" offer (no public listing) can still be manually attached to a specific user by an admin, functioning as a targeted discount.
- FR-7: Only one discount can be applied per checkout — no stacking in v1.
- FR-8: Discount validity is checked twice: once when the user enters the code (pre-check for UX), and again server-side at the point of payment confirmation, since price must never be trusted from the frontend.
- FR-9: Admin can view redemption count and a list of users who redeemed a given offer.
- FR-10: Admin can deactivate an offer at any time; already-applied redemptions are unaffected.

### 6.3 Manual Subscription Assignment (Admin)
- FR-11: Admin can grant a plan directly to a user by searching for them (email or user ID), selecting a plan, optionally applying a discount offer or a custom duration override, and entering a mandatory reason.
- FR-12: A manually-granted subscription is flagged distinctly from a paid one (`source = ADMIN_GRANT`) so it's never confused with real revenue in reporting.
- FR-13: If a user already has an active subscription, the admin must explicitly choose to either (a) reject the grant, (b) extend the current period, or (c) replace/override it. No silent overwrite.
- FR-14: Admin can revoke a subscription (paid or granted) early, with a mandatory reason. This immediately reverts the user's tier to FREE and updates `StudentProfile.subscription_tier`.
- FR-15: All grants/revocations are logged with actor, target user, plan, reason, and timestamp.
- FR-16: Users receive a distinct email/notification for admin-granted or admin-revoked access (different template from the payment confirmation).

### 6.4 Reporting / Visibility
- FR-17: Admin dashboard shows: active plans, active discount campaigns with redemption stats, and a searchable log of manual grants/revocations.
- FR-18: A user's profile (admin view) shows their full subscription history: payments, grants, revocations, discounts used.

---

## 7. Business Rules Requiring Sign-off Before Build

These decisions materially affect implementation and should be confirmed by Product before engineering starts:

1. **Conflict handling**: If a user with an active PAID subscription is granted a plan manually, does the grant extend, queue-after, or override the paid period?
2. **Pricing snapshot**: Confirm that editing a live plan's price must never change the price already locked in for existing subscribers.
3. **Discount stacking**: Confirm v1 is strictly one discount per checkout.
4. **Grant expiry**: Do manual grants require an end date always, or can an admin grant indefinite/lifetime access?
5. **Permission tiers**: Does "Admin" (non-Super) get the same grant/revoke power as Super Admin, or only view access? (Recommendation: only Super Admin can revoke; regular Admins can grant with a lower-value cap.)
6. **Revenue reporting impact**: Confirm `ADMIN_GRANT` subscriptions must be excluded from revenue/MRR calculations everywhere they currently sum `UserSubscription`.

---

## 8. Non-Functional Requirements

- NFR-1: Every state-changing admin action (create/edit plan, create/edit discount, grant/revoke) must be audit-logged — actor, action, target, reason, timestamp. This is a compliance requirement, not optional.
- NFR-2: Discount validation must be re-verified server-side at payment time; never trust a client-computed discounted price.
- NFR-3: Manual grant/revoke actions must be idempotent-safe (no duplicate active subscriptions for the same user).
- NFR-4: Admin-only endpoints must be protected by existing role-based access control, distinguishing Super Admin vs. Admin permission levels.

## 9. Success Metrics

- Time for admin to launch a new plan or discount campaign: from a deploy cycle (hours/days) to under 5 minutes, self-service.
- % of support-driven premium grants that are fully audit-traceable (target: 100%).
- Discount redemption accurately reflected in revenue reporting (0 discrepancy vs. manual reconciliation).

## 10. Open Questions

- Should discount offers support a referral-code model (user-generated codes) in addition to admin-created ones? (Assumed out of scope for v1 unless confirmed.)
- Should manually granted subscriptions be cancellable by the user themselves, or admin-only?
- Do we need a user-facing "Redeem Code" entry point outside of checkout (e.g., account settings)?

---
---

# Technical Handoff Spec (for Copilot / Engineering)

> Use this section as the working spec when scaffolding code. It assumes the existing codebase structure (`app/db/models/subscription.py`, `app/core/deps.py`, `user_service.py`) as described in the current Premium Plan Flow documentation. Payment gateway (Razorpay) integration is **not** part of this build — assume checkout already exists and only needs a discount hook added.

## A. Data Model Changes

### A.1 New table: `DiscountOffer`
```
id: UUID/PK
code: string, nullable, unique (nullable = private/targeted offer with no public code)
name: string
description: text, nullable
discount_type: enum [PERCENTAGE, FLAT_AMOUNT]
value: Decimal
applicable_plan_ids: M2M -> SubscriptionPlan (empty/null = applies to all plans)
max_redemptions: int, nullable (null = unlimited)
redemptions_used: int, default 0
max_redemptions_per_user: int, default 1
valid_from: datetime
valid_until: datetime, nullable
is_active: bool, default true
is_public: bool, default true
created_by_admin_id: FK -> User
created_at, updated_at: datetime
```

### A.2 New table: `DiscountRedemption`
```
id: UUID/PK
offer_id: FK -> DiscountOffer
user_id: FK -> User
user_subscription_id: FK -> UserSubscription, nullable (set once payment/grant completes)
status: enum [RESERVED, APPLIED, EXPIRED_UNUSED]
amount_deducted: Decimal, nullable
redeemed_at: datetime
```

### A.3 Extend `UserSubscription`
Add columns:
```
source: enum [PAYMENT, ADMIN_GRANT, PROMO], default PAYMENT
granted_by_admin_id: FK -> User, nullable
grant_reason: text, nullable
discount_offer_id: FK -> DiscountOffer, nullable
original_price: Decimal, nullable   # snapshot at time of purchase/grant
discounted_price: Decimal, nullable # snapshot after discount applied
```

### A.4 New table: `SubscriptionAuditLog`
```
id: UUID/PK
actor_admin_id: FK -> User
action_type: enum [PLAN_CREATED, PLAN_UPDATED, PLAN_DEACTIVATED,
                    DISCOUNT_CREATED, DISCOUNT_UPDATED, DISCOUNT_DEACTIVATED,
                    SUBSCRIPTION_GRANTED, SUBSCRIPTION_REVOKED]
target_user_id: FK -> User, nullable
target_plan_id: FK -> SubscriptionPlan, nullable
target_offer_id: FK -> DiscountOffer, nullable
metadata: JSON   # freeform: old_price/new_price, reason text, duration_days, etc.
created_at: datetime
```

## B. Backend Modules to Scaffold

```
app/db/models/discount.py          # DiscountOffer, DiscountRedemption
app/db/models/audit_log.py         # SubscriptionAuditLog
app/db/models/subscription.py      # (edit) add new columns to UserSubscription

app/services/plan_service.py       # create/update/deactivate plan
app/services/discount_service.py   # create/update discount, validate(), redeem()
app/services/admin_grant_service.py# grant(), revoke() manual subscriptions
app/services/audit_service.py      # log(action_type, actor, target, metadata)

app/api/routes/admin_plans.py
app/api/routes/admin_discounts.py
app/api/routes/admin_grants.py
app/api/routes/discounts_public.py # POST /discounts/validate for checkout UX

app/core/permissions.py            # (edit) add SUPER_ADMIN vs ADMIN distinction if not present
app/emails/templates/
    admin_grant_confirmation.html
    admin_revoke_notice.html
```

## C. Core Business Logic Rules to Implement

1. **Price snapshotting**: When a `UserSubscription` is created (paid or granted), copy the plan's *current* price into `original_price`/`discounted_price` on the subscription row. Never compute price by joining live to `SubscriptionPlan.price` after the fact.
2. **Conflict check on grant**: `admin_grant_service.grant()` must check for an existing ACTIVE `UserSubscription` for the user and require the caller to pass an explicit `conflict_strategy`: `REJECT | EXTEND | REPLACE`. Never silently overwrite.
3. **Discount validation function** (`discount_service.validate(code, user, plan)`), used both pre-checkout and at server-side confirmation:
   - offer exists, `is_active = true`
   - `valid_from <= now <= valid_until`
   - `redemptions_used < max_redemptions` (if capped)
   - user's redemption count for this offer `< max_redemptions_per_user`
   - offer applies to the selected plan (`applicable_plan_ids` empty or contains plan)
   - Returns computed discounted price; raises typed exceptions for each failure reason (for clean API error codes).
4. **Redemption is atomic**: increment `redemptions_used` and create `DiscountRedemption` in the same transaction as `UserSubscription` creation, to avoid race conditions on capped offers.
5. **Tier sync**: Any place that creates/updates/revokes `UserSubscription` must call the existing tier-sync logic that updates `StudentProfile.subscription_tier`, so `PREMIUM`/`FREE` stays consistent — do not duplicate this logic in the new grant/revoke services; call the existing shared function.
6. **Revenue exclusion**: Anywhere `UserSubscription` is summed for revenue/MRR reporting, filter `source == PAYMENT`. Flag all existing reporting queries that need this filter added.
7. **Audit logging**: Every service function above must call `audit_service.log(...)` before returning success — treat this as mandatory, not optional middleware.

## D. API Endpoints (contract only, no implementation)

```
# Admin — Plans
POST   /admin/plans
PUT    /admin/plans/{plan_id}
POST   /admin/plans/{plan_id}/deactivate
GET    /admin/plans

# Admin — Discounts
POST   /admin/discounts
PUT    /admin/discounts/{offer_id}
POST   /admin/discounts/{offer_id}/deactivate
GET    /admin/discounts
GET    /admin/discounts/{offer_id}/redemptions

# Admin — Manual Grants
POST   /admin/users/{user_id}/subscription/grant
POST   /admin/users/{user_id}/subscription/revoke
GET    /admin/users/{user_id}/subscription/history

# Admin — Audit
GET    /admin/audit-logs?action_type=&user_id=&from=&to=

# Public / User
GET    /plans
POST   /discounts/validate        { code, plan_id } -> { valid, discounted_price, reason_if_invalid }
GET    /users/me/subscription     (extend existing response to include source, granted_by, reason if ADMIN_GRANT)
```

## E. Frontend Scope (React/whatever stack is in use)

- **Admin Dashboard**
  - Plans table: list, create/edit modal, activate/deactivate toggle.
  - Discounts table: list, create/edit modal (code, type, value, plans, dates, caps, public/private toggle), redemptions drill-down view.
  - User Grant tool: search user → select plan → optional discount → conflict resolution prompt if active sub exists → reason field (required) → confirm.
  - Audit Log viewer: filterable table.
- **User-Facing**
  - Pricing page: reads from `/plans`, unchanged in structure, just live-sourced now instead of hardcoded/seeded-only.
  - Checkout: add a discount code input, calling `/discounts/validate` on blur/submit, showing original vs. discounted price before redirecting to Razorpay.
  - Account/Billing page: if `source == ADMIN_GRANT`, show a badge/line: "Access granted by ExamPlanner team — {reason}" instead of an invoice.

## F. Acceptance Criteria (sample, expand per ticket)

- [ ] Super Admin can create a plan and it appears on `/plans` immediately, without deploy.
- [ ] Editing a plan's price does not change `original_price` on already-existing `UserSubscription` rows.
- [ ] A discount code with `max_redemptions = 1` cannot be applied twice, even under concurrent requests (verify with a race-condition test).
- [ ] Granting a plan to a user with no active subscription creates `UserSubscription(source=ADMIN_GRANT)` and flips `StudentProfile.subscription_tier` to `PREMIUM`.
- [ ] Granting a plan to a user with an active PAID subscription, without passing `conflict_strategy`, returns a 409 — not a silent overwrite.
- [ ] Revoking a subscription reverts tier to `FREE` and is reflected in `require_challenge_quota` immediately (existing dependency in `app/core/deps.py`).
- [ ] Every grant/revoke/plan/discount action produces exactly one `SubscriptionAuditLog` row.
- [ ] Revenue reports exclude `source = ADMIN_GRANT` rows.   can we work om thi