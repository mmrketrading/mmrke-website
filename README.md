# MMRKE Trading Global Solutions

Plain HTML, CSS and JavaScript website with Supabase bookings and PayPal payments for approved quotes. No React, Next.js or build step is needed.

## Files
- index.html — website and forms
- styles.css — responsive navy and gold styling
- script.js — service selection, validation, bookings, receipts and checkout
- config.js — public connection settings
- supabase/setup.sql — private booking table and booking submission function
- supabase/functions/payments/index.ts — server-side payment verification

## Connect bookings
1. Create a Supabase project. Run supabase/setup.sql once in SQL Editor.
2. In config.js, fill in supabaseUrl and supabasePublishableKey using your project URL and publishable (or legacy anon) key.
3. Serve the frontend with VS Code Live Server, or upload the frontend files to your web host. Do not open using file://.
4. Submit a test booking and confirm it appears in Table Editor → service_bookings. No notification email is sent automatically.

Clients cannot read or change the booking table. They can only call the submission function. Keep the private booking key safe; it grants limited access to the quote and payment status, not the client’s contact details.

## Activate PayPal
1. Create a PayPal developer REST application with sandbox credentials first.
2. Put the public sandbox client ID in config.js as paypalClientId.
3. Deploy the payments Edge Function to the same Supabase project. supabase/config.toml disables JWT verification because the function authenticates payment operations using the secret booking key. If deploying in Dashboard, disable Verify JWT for this function.
4. Set Edge Function secrets PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV=sandbox and ALLOWED_ORIGINS. Origins must be exact, comma-separated, for example http://127.0.0.1:5500,https://your-domain.com. No trailing slash. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are supplied by Supabase.
5. In Table Editor, set a booking’s quote_amount in USD and status to quoted. Agree on that quote with the client before approving it. No sample prices are assumed.
6. On the website enter that booking’s private key under “Already booked?”. Pay with a sandbox buyer account. Confirm paid status and the capture ID in Supabase.
7. After testing, use matching live credentials in the frontend and function; set PAYPAL_ENV=live. Confirm your PayPal merchant account can receive payments before launching.

The server chooses the amount from the approved database quote and verifies PayPal’s completed capture before marking paid. The frontend never receives a PayPal secret or service-role key. Once checkout starts the quote is locked. Payment reconciliation can be retried with the same booking key if the buyer closes the page after paying. This version does not include automatic PayPal webhooks, refund handling, an admin dashboard or automatic client emails. Manage quotes through Supabase Table Editor. For refunds, reconcile the database after processing in PayPal.

## Hosting
Upload index.html, styles.css, script.js, config.js and favicon.svg to your hosting public folder. Keep supabase files and this README outside the public folder. No npm command is required.

## Before public launch
Activate the Supabase connection and sandbox-test booking and payment. Add your real contact details. Add CAPTCHA/rate limiting to the anonymous booking endpoint for public traffic. The database collects personal data: provide your business’s privacy notice and retention rules before launch. This supplied site has no active credentials and cannot accept bookings or collect payments until configured.

References: https://supabase.com/docs/reference/javascript/initializing and https://developer.paypal.com/api/rest/integration/orders-api

## Updated experience and Mobile Money / Card
Selecting a service takes clients directly to payment preferences, then project details and review. A preference does not charge the client. Approved quotes are paid through the separate returning-client checkout.

Animations include entrance transitions, scroll reveals, responsive service-card feedback and a page progress bar. A project brief builder adds selected requirements to the editable brief. Mobile visitors get a booking shortcut. Reduced-motion preferences disable motion.

### Pesapal setup
Deploy supabase/functions/pesapal/index.ts with JWT verification disabled. Configure PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_ENV=sandbox, SITE_URL (the full HTTPS website URL), and ALLOWED_ORIGINS as for PayPal. Register a GET IPN URL pointing to https://YOUR_PROJECT.supabase.co/functions/v1/pesapal through Pesapal RegisterIPN, then set the returned PESAPAL_IPN_ID as a secret. Set pesapalEnabled=true in config.js after setup.

Mobile Money and Card buttons open Pesapal’s hosted checkout. Available methods depend on your merchant configuration, currency and customer location. Both buttons use the same hosted checkout, where the client selects the actual method. Quotes currently use USD; check your merchant configuration supports the intended currency and methods. Do not assume MTN/Airtel are activated until confirmed in the merchant account.

The IPN and returning-client verification check the provider status, merchant reference, currency and amount before marking a booking paid. Checkout locks the booking to one provider to prevent parallel payment through two gateways. Test IPN delivery and payment confirmation in sandbox before live use. Do not manually clear the provider lock while a payment may still be in progress.

If you already ran v1 setup.sql, run upgrade-v1.sql instead of rerunning setup.sql, then redeploy both payment functions. New installations use setup.sql only. All secrets remain server-side. No live checkout has been tested without your credentials.

Pesapal API references:
https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest
https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus

## Mobile update
Single-column service cards on phones, large payment choices, 16px form inputs, 44px+ touch controls, safe-area spacing and a keyboard-aware booking shortcut. Choosing a payment preference scrolls to the details step without opening the phone keyboard automatically.
