# Premium/Pro Membership Flow

This document outlines the end-to-end architecture and logic for the Premium ("Pro") membership features within the Exam Planner application. It serves as a guide to understanding how plans are structured, how users interact with premium content, and how administrators manage subscriptions, discounts, and overrides.

## 1. Core Concepts & Models

The Premium system revolves around three primary entities:

*   **Subscription Plan (`SubscriptionPlan`)**: Defines what is being sold (e.g., "Pro Monthly", "Pro Annual"). Plans have a base price, a billing interval (monthly, yearly, lifetime), and are linked to specific features.
*   **User Subscription (`UserSubscription`)**: Represents a specific user's active, past, or cancelled subscription. This records the exact price they paid, the duration of their access (start/end dates), and the current status (e.g., `ACTIVE`, `CANCELLED`, `EXPIRED`).
*   **Discount Offer (`DiscountOffer`)**: Allows for promotional pricing. Discounts can be percentage-based (e.g., 20% off) or flat-amount (e.g., ₹500 off), and can be public (reusable codes) or private (targeted).

## 2. Administrator Capabilities (Super Admin)

Super Admins have full control over the premium ecosystem through a dedicated set of APIs.

### Plan Management
Admins can **create**, **update**, **deactivate**, and **reactivate** subscription plans. 
*   **Deactivation is soft**: Existing subscribers to a deactivated plan will continue to have access until their billing period ends, but no *new* users can subscribe to it.
*   **Feature Linking**: Admins link plans to specific system features (e.g., "Advanced Analytics", "Unlimited Mock Exams") using `PlanFeatureLink`.

### Discount Management
Admins can create flexible promotional campaigns:
*   **Types**: Set a fixed amount off or a percentage reduction.
*   **Constraints**: Limit the total number of times an offer can be redeemed globally (e.g., "First 100 users"), or limit redemptions per individual user.
*   **Targeting**: Restrict discounts so they only apply to specific plans.

### Subscription Overrides (Grants & Revocations)
In situations like customer support, beta testing, or manual sales, an admin can bypass the payment gateway:
*   **Manual Grants**: Admins can instantly grant any user `ACTIVE` access to any plan for a specified number of days. They must provide a `grant_reason` for auditing purposes.
*   **Conflict Resolution**: If the user already has an active subscription, the admin chooses to either `REPLACE` it, `EXTEND` it, or `REJECT` the new grant to prevent accidental overwrites.
*   **Revocation**: Admins can immediately cancel and revoke a user's access, logging the reason.

### Audit Logging
Every action taken by an admin (creating a plan, modifying a discount, granting/revoking access) is permanently recorded in the `subscription_audit_logs` table. This ensures complete traceability of revenue-impacting actions.

## 3. User Experience Flow

How a standard user interacts with the premium system:

1.  **Viewing Options**: The user views available (active) plans and their associated features via the frontend (which calls the core backend `GET /plans` endpoint).
2.  **Applying Promos**: Before checkout, the user can input a promo code. The system validates the code against the `DiscountOffer` rules (is it expired? has the usage limit been reached? is it applicable to the selected plan?) and returns the newly calculated discounted price.
3.  **Checkout & Payment (Gateway)**: *[Note: The external payment gateway integration (like Razorpay/Stripe) is managed by the core microservice, not the admin service.]* The user completes the transaction.
4.  **Activation**: Upon successful payment, a `UserSubscription` record is created (with `source = PAYMENT`), and a `DiscountRedemption` record is created if a promo code was used.
5.  **Access Verification**: When the user tries to access premium features (like starting a Pro-only mock exam), the system checks if they have a `UserSubscription` where `status == ACTIVE` and the current date falls between `current_period_start` and `current_period_end`.

## 4. Subscription State Machine

A `UserSubscription` moves through a defined lifecycle:
*   `PENDING`: Awaiting payment confirmation.
*   `ACTIVE`: The user currently has access.
*   `CANCELLED`: The user has cancelled, but access might continue until the end of the current billing period (depending on implementation specifics).
*   `EXPIRED`: The billing period has ended, and access is revoked.
*   `REVOKED`: An admin forcefully terminated the subscription early.
