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
=======
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
>>>>>>> 97f01a2 (Initial commit from Create Next App)
