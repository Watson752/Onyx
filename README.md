# Onyx

An ordering agent for the suppliers a business already buys from, without asking any supplier to integrate.

Built for Agentic Commerce Pioneers Edition II, Track 1 (Agentic Checkout).

Live demo: https://onyx-five-lemon.vercel.app

## The problem

A cafe orders the same things every week. Beans from a roaster, cups and lids from a packaging supplier, cleaning supplies from somewhere else. Each one is a separate website, a separate login, a separate checkout, and a separate delivery charge. Someone does this by hand every week, and they pay more than they need to, because comparing delivered cost across three carts by hand is tedious enough that nobody actually does it.

None of those suppliers have an API. Most of them are small businesses on Shopify who will never build an agent integration. The long tail of commerce doesn't integrate, and no amount of protocol adoption changes that.

Onyx works with that instead of waiting for it to change.

## What Onyx does

1. Onboard. Paste a supplier's store URL. Onyx learns that merchant's checkout and saves the products it finds. No integration, no API key, no relationship with the supplier.
2. Understand. The manager types what they need in plain language, with a budget.
3. Price. Onyx quotes each supplier separately against the real store, then assembles the cheapest basket that fulfils the request within budget.
4. Confirm. One approval screen for the whole basket, recording the exact items and the exact spending caps.
5. Order and prove. An order goes to each supplier independently, and each one returns auditable evidence.

## How Onyx uses Agnic

Agnic's Checkout Engine can complete a purchase at a merchant that has never heard of it. It drives the real checkout, and the merchant stays merchant of record. Onyx is the layer above it.

| Agnic call | What Onyx does with it |
|---|---|
| `POST /explore` | Onboards a supplier by driving its live checkout read-only and stopping before payment. Charges nothing. Onyx stores the returned merchant id, rail, currency and discovered catalogue. |
| `GET /products/search` | Finds candidate items across the vetted network when a supplier's own catalogue doesn't match a requested item. |
| `POST /shopify/quote` | Prices one supplier's cart against the real store, with `max_total_minor` and `max_shipping_minor` sent on every call. Free, no browser, no charge. |
| `POST /dispatch` | Places the approved order. The only call that spends money. |
| `GET /orders/{id}` | Polls to a terminal state and reads `status`, `amount_charged_minor`, `retryable`, `retry_action` and evidence. |

Spending authority comes from a passkey-signed mandate in CAD with its own per-purchase and daily limits, against a vaulted card that Onyx never sees. Three separate layers have to allow a purchase before the card is touched: the API token's own limits, the signed mandate, and the per-order caps recorded at approval.

### What Agnic doesn't do, and Onyx does

Agnic quotes and buys from one merchant at a time. There is no cross-merchant cart. Everything below is Onyx's own logic.

- Which suppliers exist. Onboarding is a decision, not a lookup. Onyx manages the supplier roster and the state machine around a two-minute asynchronous explore.
- Assignment by delivered cost. Each supplier ships separately, so a cheaper unit price can still lose once its own shipping is counted. Onyx compares delivered totals, not shelf prices.
- One budget, many carts. An exact-cover search finds the cheapest non-overlapping set of supplier carts that covers every requested item within a single budget, with a greedy fallback.
- Ceilings against totals. When a merchant adds tax at checkout, the quoted figure is a ceiling, not a settled charge. Onyx labels it and won't compare it head to head with a final amount.
- Partial failure. Three orders, one sells out. Each supplier is claimed, dispatched and tracked independently, so a refusal at one never touches the others.

## Architecture

```
Browser
  |
  |-- /suppliers --> startSupplierExplore --> POST /explore  (returns immediately)
  |      \-- polls /api/suppliers/[id]/explore --> GET /orders/{id} --> persist supplier + catalogue
  |
  |-- /request  --> LLM parse --> strict JSON --> zod validation --> Request row
  |
  |-- /price    --> per-supplier POST /shopify/quote (caps attached)
  |                   \-- delivered-cost assignment --> exact-cover basket
  |
  |-- /approve  --> immutable Approval row per supplier cart
  |                   (exact items + ship_to + caps + confirmation + timestamp)
  |
  \-- /dispatch --> atomic claim --> POST /dispatch --> persist order_id
         \-- polls /api/dispatch/[id] --> GET /orders/{id} --> terminal state + evidence
```

Long operations never hold a request open. Explore and dispatch both persist state first and let the browser poll a short-lived route, so a serverless function dying mid-flight can't lose an in-flight order.

### Safety rules, enforced in code

These are the product, not error handling.

1. No dispatch without an approval. The stored items, destination and caps are sent verbatim. Nothing is recomputed between approval and purchase.
2. Duplicate protection is atomic. A conditional `approved -> dispatching` update returns zero rows if another request already claimed the order. A double dispatch is a double charge.
3. The order id is persisted before anything else. A timeout is an uncertain purchase, not a failure. Never blind-retry, poll instead.
4. `retryable: null` stops everything. Money may have moved, so no retry, no automatic refund, flagged for a human.
5. Refusals are first-class outcomes. A cap breach, an undeliverable destination, or an unmatched item shows up as a deliberate, labelled skip, never as a red error.

## Results

Six real Canadian suppliers were attempted through `/explore`, with no integration on their side.

| Supplier | Result | Rail |
|---|---|---|
| pilotcoffeeroasters.com | onboarded, 19 products | Shopify |
| bulkmart.ca | onboarded, 20 products | Shopify |
| kimecopak.ca | onboarded, 10 products | Shopify |
| a1cashandcarry.com | onboarded, 6 products | Shopify |
| eightouncecoffee.ca | onboarded | Shopify |
| swish.ca | refused, catalogue gated behind a trade account | n/a |

Five of six. The failure is the interesting one, because the engine stopped instead of guessing its way into a checkout it couldn't complete.

## What's real and what isn't

Real: supplier onboarding against live stores, product search, live quotes with real shipping, cap enforcement, the passkey-signed CAD mandate, and the full dispatch path.

Simulated: settlement only. Purchases run against the `untitled-fidget.shop` sandbox with a test card. Real cart, real checkout, real card rail, no money moves.

Known limitation: our dispatch came back with `retryable: null`, and Onyx stopped rather than retrying or auto-refunding. That's the intended behaviour for an uncertain purchase, and the demo shows it rather than hiding it.

## Stack

Next.js (App Router), TypeScript, Prisma, PostgreSQL (Neon), Tailwind, Agnic Checkout REST API, and a swappable LLM provider for request parsing.

## Running it

```bash
cp .env.example .env     # fill in every value
npm install
npx prisma migrate deploy
npm run dev
```

Required environment variables: `DATABASE_URL`, `DATABASE_URL_POOLED`, `AGNIC_TOKEN`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, and `SHIP_TO_NAME`, `SHIP_TO_STREET`, `SHIP_TO_CITY`, `SHIP_TO_REGION`, `SHIP_TO_POSTAL`, `SHIP_TO_COUNTRY`.

Then go to /suppliers to onboard, /request to describe a restock, /price to compare, and /approve to confirm.

## Team

Srivathsan Murali, solo build. watson.cu.28@gmail.com

## Licence

MIT
