# Email & Automated Payment Flow Specification

## 1. Overview
This document outlines the architecture for transactional emails and the automated subscription flow. 

**Note on Authentication Emails:**
All authentication-related emails (e.g., "Forgot Password" OTPs) are natively handled by the **Clerk** infrastructure. We do not need to manage these flows in our backend.

Our custom email service will strictly be used for **Business & Transactional Logic** using a Hostinger-hosted email address (e.g., `support@examplanner.in`).

---

## 2. The User Journey & Flow

### Phase 1: Onboarding & Freemium Usage
1. **Sign Up:** The user signs up via Clerk.
2. **Database Sync:** The Clerk webhook triggers our backend to create a `User` and `StudentProfile` in the PostgreSQL database.
3. **Usage:** The user is granted the default "Freemium" tier, giving them access to their first 100 questions.

### Phase 2: Automated Payment & Instant Upgrade 
1. **Limit Reached:** The user exhausts their 100 free questions.
2. **Payment:** The user clicks "Upgrade / Subscribe", enters their payment details, and successfully completes the transaction via your payment gateway (e.g., Stripe/Razorpay).
3. **Webhook Verification:** The payment gateway securely pings your FastAPI backend (Payment Webhook). The backend verifies the cryptographic signature to ensure the payment is real.
4. **Instant Upgrade:** The backend automatically updates the user's `SubscriptionTier` to `PREMIUM` in the database.

### Phase 3: Automated Email Notifications (Hostinger SMTP)
Immediately upon the instant database upgrade, the FastAPI backend dispatches two simultaneous emails via Hostinger SMTP:

**Email 1: To the User (Instant Gratification)**
*   **Recipient:** The Student's Email Address.
*   **Content:** "Congratulations! Your payment was successful and your Premium Access to ExamPlanner is now active. You can now access all Mock Tests and AI Analytics instantly."

**Email 2: To the Admin (Audit & Review)**
*   **Recipient:** `admin@examplanner.in`
*   **Content:** "New Subscription Alert: A user (user@email.com) has successfully paid and been automatically upgraded to Premium. No manual action is required, this is just for your records."

---

## 3. Hostinger SMTP Technical Requirements

To implement the FastAPI email service (`fastapi-mail`), the following environment variables must be generated from the Hostinger Email Dashboard and injected into our `.env.production` file:

```env
# Email Configuration
MAIL_USERNAME=support@examplanner.in
MAIL_PASSWORD=your_hostinger_email_password
MAIL_FROM=support@examplanner.in
MAIL_PORT=465
MAIL_SERVER=smtp.hostinger.com
MAIL_STARTTLS=False
MAIL_SSL_TLS=True
```
