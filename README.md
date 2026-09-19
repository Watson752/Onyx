# Onyx

Onyx turns the suppliers a business already buys from into an ordering API —
without asking a single supplier to integrate.

A café manager types "two bags of medium roast, 200 12oz cups, and a case of
napkins, under $300." Onyx finds those items across the business's own
suppliers, prices each cart delivered to the café's address, assembles the
cheapest basket that fits the budget, takes one approval, and places an order
at each supplier.

Built for the Agentic Commerce Pioneers Hackathon (Edition II), Track 1 —
Agentic Checkout.

## Why this is different

Agnic's Checkout Engine can complete a checkout at a merchant that has never
heard of it. Onyx is the layer above that: it decides *which* suppliers to
onboard, *which* of them can actually fulfil each item, how to spend *one*
budget across several separate carts, and what to do when one order fails while
another succeeds.

- **Supplier onboarding, not a fixed catalogue.** Paste any supplier's store
  URL. Onyx learns its checkout read-only, charging nothing, and saves the
  products it finds. Four of five real Canadian suppliers onboarded with no
  integration work; the fifth gates its catalogue behind an account, so the
  engine refused rather than guessing.
- **One budget, many carts.** There is no cross-merchant cart, so each supplier
  is quoted separately and items are assigned by *delivered* cost, not unit
  price — a cheaper bag can lose once its own shipping is counted.
- **Refusals are outcomes, not errors.** A shipping cap breach, an
  undeliverable destination, or an unmatched item is shown as a deliberate,
  labelled skip. Nothing is charged.
- **Ceilings are labelled.** When a merchant adds tax at checkout, the quote is
  a ceiling, not a total, and the UI says so rather than comparing it
  head-to-head with a final amount.

## Onboarded suppliers (live, no integration)

| Supplier | Rail | Products |
|---|---|---|
| pilotcoffeeroasters.com | Shopify | 19 |
| bulkmart.ca | Shopify | 20 |
| kimecopak.ca | Shopify | 10 |
| a1cashandcarry.com | Shopify | 6 |
| eightouncecoffee.ca | Shopify | — |

## Stack

Next.js (App Router), TypeScript, Prisma + SQLite, Tailwind, Agnic Checkout
REST API, swappable LLM provider for request parsing.

## Running it

```bash
cp .env.example .env    # add AGNIC_TOKEN, LLM_API_KEY, SHIP_TO_* values
npm install
npx prisma migrate dev
npm run dev
```

1. **/suppliers** — paste a supplier store URL to onboard it (takes ~2 minutes).
2. **/request** — describe a restock in plain language.
3. **/price** — see per-supplier quotes, the chosen basket, and any skips.

No endpoint that spends money is called outside the approval flow.
