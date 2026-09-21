import "server-only";

/**
 * A cheap reachability + rail check run *before* we spend an explore on a URL.
 *
 * Agnic's autofill rail can only drive a Shopify checkout to pay-ready, so a
 * dead domain or a WooCommerce storefront costs a 45s start plus minutes of
 * polling only to come back as `worker_error` with a raw Playwright call log.
 * Two HTTP requests here turn that into an instant, readable rejection.
 */

const PREFLIGHT_TIMEOUT_MS = 8_000;

// Only platforms we can positively identify from markup. Anything we can't
// place is allowed through — see `preflightSupplier` on why we never block on
// the absence of evidence.
const RIVAL_PLATFORMS: Array<{ label: string; pattern: RegExp }> = [
  { label: "BigCommerce", pattern: /bigcommerce\.com|BigCommerce/ },
  { label: "WooCommerce", pattern: /woocommerce|WooCommerce/ },
  { label: "Squarespace", pattern: /squarespace\.com|Squarespace/ },
  { label: "Wix", pattern: /wix\.com|_wixCssStates/ },
  { label: "Magento", pattern: /\/static\/version\d|Magento_/ },
  { label: "PrestaShop", pattern: /prestashop/i },
  { label: "Salesforce Commerce", pattern: /demandware\.static|dwstore/ },
];

const SHOPIFY_MARKERS = /cdn\.shopify\.com|myshopify\.com|Shopify\.theme|shopify-features/;

export type PreflightResult =
  | { ok: true; canonicalUrl: string }
  | { ok: false; reason: "unreachable" | "unsupported_rail"; message: string };

async function get(url: string, signal: AbortSignal) {
  return fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal,
    // Some storefronts 403 an obviously scripted client; look like a browser so
    // a block doesn't read as a dead domain.
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
}

/** True when the host serves Shopify's cart endpoint, which only Shopify does. */
async function servesShopifyCart(origin: string, signal: AbortSignal) {
  try {
    const response = await get(new URL("/cart.js", origin).toString(), signal);
    if (!response.ok) return false;
    const type = response.headers.get("content-type") ?? "";
    return type.includes("json");
  } catch {
    return false;
  }
}

/**
 * Blocks a URL only on *positive* evidence that an explore cannot succeed:
 * the host does not resolve, or its markup identifies a non-Shopify platform.
 * An inconclusive check (bot wall, timeout, headless storefront, odd markup)
 * falls through to Agnic rather than risk rejecting a supplier that works.
 */
export async function preflightSupplier(url: string): Promise<PreflightResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await get(url, controller.signal);
    } catch (error) {
      const code =
        error instanceof Error && error.cause instanceof Error
          ? (error.cause as NodeJS.ErrnoException).code
          : undefined;

      if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
        return {
          ok: false,
          reason: "unreachable",
          message: `${new URL(url).hostname} does not resolve — check the spelling, or the store may have shut down.`,
        };
      }
      // A TLS error, refused connection or timeout is ambiguous: the site may
      // still be reachable from Agnic's network, so let the explore decide.
      return { ok: true, canonicalUrl: url };
    }

    const canonicalUrl = response.url || url;
    if (!response.ok) return { ok: true, canonicalUrl };

    const html = (await response.text()).slice(0, 400_000);
    if (SHOPIFY_MARKERS.test(html)) return { ok: true, canonicalUrl };

    const rival = RIVAL_PLATFORMS.find((entry) => entry.pattern.test(html));
    if (!rival) return { ok: true, canonicalUrl };

    // Markup says it's a rival platform. Confirm against /cart.js before
    // blocking, so a Shopify store that merely embeds a rival's widget passes.
    if (await servesShopifyCart(canonicalUrl, controller.signal)) {
      return { ok: true, canonicalUrl };
    }

    return {
      ok: false,
      reason: "unsupported_rail",
      message: `${new URL(canonicalUrl).hostname} runs on ${rival.label}. Onyx can only transact on Shopify storefronts, so this supplier can't be onboarded.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
