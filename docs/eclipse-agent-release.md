# Eclipse Agent: implementation and release gates

Prepared 31 October 2026. This is a product/implementation review, not legal certification.

## Implemented

`/agent` offers explanations, practice, revision planning and drafts through an isolated Firebase function at `/api/eclipse-agent`. Uses the existing Gemini SDK, one bounded model request per task, 1,024 output tokens and a 45-second provider timeout. No external tools, Sparx login, automatic homework submission, spending, email or background execution. ChatGPT's model selection does not select this function's model.

Server verifies a revoked-token-aware Firebase identity, verified email matching the Stripe customer, active subscription with matching user metadata, and the actual server-configured Stripe price. Client tier/profile flags alone never grant access. All configured paid tiers qualify, including legacy paid Admin, without conferring administrator permissions. Non-Stripe/manual subscriptions need an independently verified entitlement integration before access can be enabled.

Proposed limits: Serious 10 agent requests/day, Premium/legacy paid Admin 25. Separate from tutor prompts. Atomic Firestore reservation enforces per-user and global capacity, plus one in-flight request per user. UTC daily reset. Failed provider attempts consume quota to prevent unlimited retries and unbounded costs. Global cap must be explicitly configured between 1 and 1,000; default zero. Global count is a request limit, not a currency budget.

No new student conversations are stored by the agent. Up to eight recent messages are sent with the new prompt to Gemini. They clear on leaving the page. Provider retention and existing privacy notice require review before public activation. Do not log prompts or credentials.

## Activation deliberately blocked

`ECLIPSE_AGENT_ENABLED` defaults off. No paid API calls were made during development. Owner must approve usage costs before setting it to `true` and choosing `ECLIPSE_AGENT_DAILY_CAP`. Configure GEMINI_API_KEY, STRIPE_SECRET_KEY and STRIPE_PRICE_ID_SERIOUS/PREMIUM (ADMIN only for existing legacy paid accounts) securely on this separate function. Existing keys on the tutor function do not automatically transfer. Do not paste secrets into chat or commit them.

Existing deployment fails at Firebase Rules test permission HTTP 403 (run 41125920087). This change does not grant permissions or skip that safety step. After the authorised deployment identity is fixed, deploy rules, the function and Hosting in order. Verify unauthenticated 401, disabled status, a test paid identity, expired/free rejection, quota exhaustion, and actual provider behaviour before activation. Use Stripe test mode and non-student test accounts. No live billing or student data was inspected for this review.

The UI labels this as a preview, not a current paid benefit. After activation and validation, update that wording and publish exact allowances. The public URL will be https://eclipseapp.co.uk/agent only after successful deployment.

## Paid plan review

| Tier | Source price | Existing tutor allowance | Review |
| --- | --- | --- | --- |
| Serious | £15/month | 40/day | Card agrees with constants. Actual Stripe Price amount, currency, recurrence and tax remain unverified. |
| Premium | £40/month | 500/day | Card agrees with constants. Faster-response and priority-support promises have no verified service guarantees. |
| Legacy Admin | £250/month in source | Unlimited in source | Hidden from new plan selection. Existing paid access must never imply administrator privileges. Actual legacy subscriptions unverified. |

Existing tutor quota uses client-side checks/increments. It must be migrated to an authenticated server-side usage transaction before it can be treated as an abuse-resistant paid allowance. This agent's separate quota is enforced server-side.

Existing checkout handler accepts client price/user metadata, including legacy Admin. Existing billing links and webhook handling require a separate end-to-end security review; do not treat this agent change as fixing checkout. Agent verifies Stripe customer email, user metadata and configured prices independently as a compensating entitlement control.

Current purchase page directs customers to Stripe to review recurring terms. Cancellation timing, refunds, taxes, trader identity, minor/guardian purchase terms, support service levels and provider privacy disclosures have not been verified. Preserve existing promises until deliberately reviewed; do not silently claim legal compliance or alter customer contracts.

## Validation

Run `npm run lint`, `npm run test:eclipse-agent`, existing transport/agent suites and `npm run build`. Pure tests cover verified ownership, wrong identities, inactive plans, unknown prices, all paid tiers, malformed input, quota expiry, concurrent request lock and global cap. Live Stripe, Gemini and authenticated student sessions are intentionally not exercised without a dedicated test setup and usage approval.
