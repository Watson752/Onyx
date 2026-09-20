// Seeds the four already-explored suppliers pulled from the old local
// dev.db so the deployed site isn't empty. Idempotent: safe to re-run.
//
// Note: eightouncecoffee.ca was requested but was never found in the old
// SQLite dev.db (only pilotcoffeeroasters.com, kimecopak.ca, bulkmart.ca,
// and a1cashandcarry.com were there). Onboard it live via /suppliers after
// deploy — explore now runs async, so it will survive on Hobby.
//
// Run with: node prisma/seed.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const suppliers = [
  {
    url: "https://pilotcoffeeroasters.com/",
    name: "pilotcoffeeroasters.com",
    agnicMerchantId: "merchant_pilotcoffeeroasters_com",
    status: "explored",
    rail: "shopify",
    currency: "CAD",
    catalogItems: [
      { sku: "gid://shopify/ProductVariant/48209302978838", title: "Heritage Blend — Whole Bean / 300 G", priceMinor: 2295, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48324077879574", title: "Academy Blend — Whole Bean / 300 G", priceMinor: 2295, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48324117725462", title: "Catalyst Blend – Decaf — Whole Bean / 300 G", priceMinor: 2375, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48324122280214", title: "Community Blend — Whole Bean / 300 G", priceMinor: 2575, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48324153082134", title: "Monument Blend — Whole Bean / 300 G", priceMinor: 2295, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48724192428310", title: "V60 Paper Filters – Hario", priceMinor: 1350, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48884408353046", title: "Roaster’s Choice — Whole Bean", priceMinor: 2675, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48898886500630", title: "Heritage Instant Coffee", priceMinor: 2195, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48900159766806", title: "AUTOPILOT Subscription: Espresso", priceMinor: 5400, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48900160160022", title: "AUTOPILOT Subscription: Discovery", priceMinor: 5400, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48931237822742", title: "Feature Espresso — Whole Bean", priceMinor: 2675, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/48990982340886", title: "Gift Cards — $15", priceMinor: 1500, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/49391064973590", title: "Las Palmas 'Espresso' – Colombia — 300g / Whole bean", priceMinor: 2850, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/49654185722134", title: "Catalan 'Red Bourbon' - Guatemala — 300g / Whole bean", priceMinor: 2675, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/50065171317014", title: "Community Instant Coffee", priceMinor: 2195, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/50372489380118", title: "Ana Sora – Ethiopia — 300g / Whole bean", priceMinor: 2900, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/50579187663126", title: "Sumava 'Black Moon' – Costa Rica — 250g / Whole bean", priceMinor: 2995, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/51440618701078", title: "Kunjin – Papua New Guinea — 300g / Whole bean", priceMinor: 2675, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/51567116910870", title: "Anahi – Brazil — 300g / Whole bean", priceMinor: 2675, currency: "CAD" },
    ],
  },
  {
    url: "https://www.kimecopak.ca/",
    name: "www.kimecopak.ca",
    agnicMerchantId: "merchant_www_kimecopak_ca",
    status: "explored",
    rail: "shopify",
    currency: "CAD",
    catalogItems: [
      { sku: "gid://shopify/ProductVariant/42975071371415", title: "Ice Cream Paper Cups Custom Logo Wholesale Pricing in Canada — 8 Oz | $0.125-> $0.307/pcs / 10 000 Pcs | Free 1 Color LOGO", priceMinor: 306900, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/43260454764695", title: "Individually Wrapped Wooden Knife 6.3 inch | Biodegradable Party Supplies, Sturdy, Heat Tolerant | 1000 Pcs/Case", priceMinor: 12900, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/43420364669079", title: "1.5 oz Clear Portion Cups WITHOUT Lids | Wholesale Price in Canada | 2500 CUPS/CASE", priceMinor: 10900, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/43431287750807", title: "2 Oz Clear Portion Cups WITHOUT Lids | For Sauce & Seasoning Bulk Canada | 2500 CUPS/CASE", priceMinor: 11900, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/43528790540439", title: "Single Kraft Cake Boxes 2 with Handle & Insert | Bulk Canada | 200 SETS (BOX + INSERT)", priceMinor: 12500, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/43691563810967", title: "White Dispenser Napkins 1-Ply l Wholesale Price Canada — 3000 Packes | 500 Pcs/Pack | NO LOGO", priceMinor: 1619300, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/43697042587799", title: "1/8 Fold Paper Napkin | 2 ply l Custom Logo Wholesale Canada — NO LOGO | 20.000 PCS", priceMinor: 192100, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/43864366579863", title: "Individually Wrapped Biodegradable Sugarcane Straw | 12mm | Wholesale Canada — 50.000 PCS", priceMinor: 554200, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/44324808065175", title: "44 Oz Paper Bowl with Lids | Wholesale in Canada | 300 SETS (BOWL + LIDS) — 1 Case x SET 300 (Bowl + Lid)", priceMinor: 23900, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/44569130500247", title: "Custom Printed Snack Bags in Canada | LOW MOQ 5000 — 1 LBS | $0.767 -> $1.472/pcs / MOQ 5.000", priceMinor: 736300, currency: "CAD" },
    ],
  },
  {
    url: "https://bulkmart.ca/",
    name: "bulkmart.ca",
    agnicMerchantId: "merchant_bulkmart_ca",
    status: "explored",
    rail: "shopify",
    currency: "CAD",
    catalogItems: [
      { sku: "gid://shopify/ProductVariant/19271301955654", title: "Canola Oil Box - 16 L", priceMinor: 4249, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19271304937542", title: "Cavendish - Clear Coat 3/8\" Straight Cut Fries # 05315 - 6  x 4.5 Lb", priceMinor: 3499, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19271331381318", title: "Diamond - Crystal Kosher Salt - 1.36 Kg", priceMinor: 1599, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19271352418374", title: "SUPER SALE - Gay Lea Unsalted Butter - 454 g", priceMinor: 649, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19271370342470", title: "Hellmann's - Real Mayonnaise - 16 L", priceMinor: 9509, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19271382663238", title: "Lactantia - 10% Half & Half Cream - 1 L", priceMinor: 429, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19271432372294", title: "Sifto - Hy Grade Food Grade Salt - 20 Kg", priceMinor: 1499, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19271446855750", title: "Wonder - White Bread - Each", priceMinor: 379, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/19976740012102", title: "Nitrile Gloves Black Large Powder Free 5 Mil - 100/Pack", priceMinor: 699, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/20255574523974", title: "Canada Dry - Ginger Ale Can - 24 x 355 ml / Pack", priceMinor: 1599, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/20255575113798", title: "Coca-Cola - Classic - 24 x 355 ml / Pack", priceMinor: 1599, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/20255577604166", title: "Sprite - Regular Soda - 24 x 355 ml", priceMinor: 1599, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/20255585730630", title: "Eska - Natural Spring Water - 24 x 500 ml", priceMinor: 699, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/20604610084934", title: "Redpath - Fine Sugar - 20 Kg", priceMinor: 2999, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/20741450694726", title: "Vegetable Oil Box - 16 L", priceMinor: 3999, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/29077598371910", title: "ADM - Bakers Roses All Purpose Flour - 20 Kg", priceMinor: 2499, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/32567397810250", title: "Beatrice - 3.25% Homogenized Milk - 4 L", priceMinor: 799, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/32567402365002", title: "Lactantia - 18% Table Cream - 1 L", priceMinor: 570, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/32567402692682", title: "Lactantia - 35% Whipping Cream - 1 L", priceMinor: 699, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/39257118965834", title: "White Wiping Rags - 20 Lbs", priceMinor: 3699, currency: "CAD" },
    ],
  },
  {
    url: "https://www.a1cashandcarry.com/",
    name: "www.a1cashandcarry.com",
    agnicMerchantId: "merchant_www_a1cashandcarry_com",
    status: "explored",
    rail: "shopify",
    currency: "CAD",
    catalogItems: [
      { sku: "gid://shopify/ProductVariant/37637263622305", title: "Paper Bags - Brown/Kraft - #2 - Made in Canada — [500 ct]", priceMinor: 1679, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/37637264081057", title: "Paper Bags - Brown/Kraft - #10 - Made in Canada — [500 ct]", priceMinor: 2199, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/37637264179361", title: "Paper Bags - Brown/Kraft - #12 - Made in Canada — [500 ct]", priceMinor: 2649, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/37637264277665", title: "Paper Bags - Brown/Kraft - #14 - Made in Canada — [500 ct]", priceMinor: 3079, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/37637264539809", title: "Paper Bags - Brown/Kraft - #20 - Made in Canada — [500 ct]", priceMinor: 3079, currency: "CAD" },
      { sku: "gid://shopify/ProductVariant/37637265391777", title: "Paper Bags - White - #20 - Made in Canada — [500 ct]", priceMinor: 4999, currency: "CAD" },
    ],
  },
];

async function main() {
  for (const entry of suppliers) {
    const supplier = await prisma.supplier.upsert({
      where: { url: entry.url },
      create: {
        url: entry.url,
        name: entry.name,
        agnicMerchantId: entry.agnicMerchantId,
        status: entry.status,
        rail: entry.rail,
        currency: entry.currency,
        exploredAt: new Date(),
        explorePhase: "done",
      },
      update: {
        name: entry.name,
        agnicMerchantId: entry.agnicMerchantId,
        status: entry.status,
        rail: entry.rail,
        currency: entry.currency,
        exploredAt: new Date(),
        explorePhase: "done",
        exploreOrderId: null,
        exploreError: null,
      },
    });

    await prisma.catalogItem.deleteMany({ where: { supplierId: supplier.id } });
    await prisma.catalogItem.createMany({
      data: entry.catalogItems.map((item) => ({
        supplierId: supplier.id,
        sku: item.sku,
        title: item.title,
        priceMinor: item.priceMinor,
        currency: item.currency,
      })),
    });

    console.log(`Seeded ${entry.name}: ${entry.catalogItems.length} item(s).`);
  }

  console.log(
    "\neightouncecoffee.ca was NOT in the old dev.db — onboard it live via /suppliers after deploy.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
