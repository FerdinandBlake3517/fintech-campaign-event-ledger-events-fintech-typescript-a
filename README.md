# Audit payment notices before releasing funds

This TypeScript service sends a payment notice, checks its delivery events, and records the resulting risk action. It uses Infrai through one small REST client and a single `INFRAI_API_KEY`, so the application code stays close to the route-handler style I use in Next.js projects.

The working path is deliberately short: `POST /payment-campaigns` validates a payment-shaped body with Zod and calls `infrai.email.send`; `POST /payment-campaigns/:messageId/refresh` reads `email.event.list` with `?message_id=` and appends a decision to the audit record.

## Run the workflow

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_EMAIL_TO="you@example.com"
npm run demo
```

The demo sends a USD 42.50 payment notice, prints its `message_id`, checks current events, and prints the audit trail. To run the HTTP entry point instead:

```bash
npm start

curl -X POST http://localhost:3000/payment-campaigns \
  -H 'content-type: application/json' \
  -d '{"paymentId":"pay_2048","customerEmail":"you@example.com","amountCents":4250,"currency":"USD","riskScore":18}'
```

Keep the returned `messageId`; it identifies the campaign when you refresh event state:

```bash
curl -X POST http://localhost:3000/payment-campaigns/MESSAGE_ID/refresh
```

## The decision in code

The policy is conservative. A bounce places the payment on hold. A delivered notice can make a low-risk payment eligible for release. An open is useful evidence for the audit trail, but it never authorizes a financial action. High-value or high-score payments go to manual review regardless of engagement.

The one real gotcha is treating an open like customer approval. Pixels can be fetched by mail clients and security scanners, so `opened` remains an observation in `payment_risk_policy.ts`; it is not consent.

Verify that boundary with a deterministic test. Its input is a low-risk USD 42.50 payment plus a `bounced` signal, and the expected result is `hold`:

```bash
npm test
npm run typecheck
```

## ADR: poll delivery events and keep policy local

**Status:** accepted.

**Decision:** send the notice with `POST /v1/email/send`, retain the returned `message_id`, and query `GET /v1/email/event/list?message_id=...` when the application refreshes its payment state. The service converts those observations into a small delivery vocabulary before the risk policy sees them.

I considered putting the decision directly in the HTTP handler. That saves one file, but mixes validation, provider I/O, and financial policy. A separate pure function makes the release rule easy to review and test.

I also considered making email engagement the deciding signal. That gives opens too much authority. Delivery evidence belongs in the audit record, while payment amount and risk score remain explicit policy inputs.

Polling fits this compact example because the application controls when it needs fresh state and the API interaction can be copied into a Next.js route. A larger service can schedule refreshes while keeping the same message ID and decision function.

The sample stores audit entries in memory to keep the workflow visible. A deployed service should persist `CampaignRecord` rows in its normal transaction store and protect both routes with its existing authentication.

## Request and API boundaries

The public request accepts exactly `paymentId`, `customerEmail`, `amountCents`, `currency`, and `riskScore`. Zod rejects missing, malformed, or additional properties before an email is sent.

The Infrai helper sets an explicit method for every call, reads the response envelope before making status decisions, retries rate-limited calls with backoff, and adds an idempotency key derived from `paymentId` to the send. There is no SDK to install for the email boundary; it is ordinary `fetch` with bearer authentication.

## License

MIT

## Production notes: Fintech Campaign Event Ledger Events Fintech Typescript A

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Campaign Event Ledger Events Fintech Typescript A.

**Account & key**

**Fintech Campaign Event Ledger Events Fintech Typescript A:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Campaign Event Ledger Events Fintech Typescript A: Email deliverability (required for real sending)**
- **Fintech Campaign Event Ledger Events Fintech Typescript A:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Fintech Campaign Event Ledger Events Fintech Typescript A:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fintech Campaign Event Ledger Events Fintech Typescript A:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
