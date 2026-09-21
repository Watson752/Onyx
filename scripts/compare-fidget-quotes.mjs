const token = process.env.AGNIC_TOKEN?.trim();
if (!token) throw new Error("AGNIC_TOKEN is not configured");

const endpoint = "https://api.agnic.ai/api/autofill/shopify/quote";
const merchantId = "merchant_untitled_fidget_shop";
const sku = "gid://shopify/ProductVariant/43945235349570";
const constraints = {
  max_total_minor: 1000,
  max_shipping_minor: 200,
};

async function quote(quantity) {
  const request = {
    merchant_id: merchantId,
    items: [{ sku, quantity }],
    fulfillment_option_id: "agnic-pickup",
    constraints,
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Agnic-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return {
    request,
    http_status: response.status,
    raw_json: await response.text(),
  };
}

const [quantity1, quantity2] = await Promise.all([quote(1), quote(2)]);

for (const [label, result] of [
  ["QUANTITY 1", quantity1],
  ["QUANTITY 2", quantity2],
]) {
  console.log(`\n===== ${label} REQUEST =====`);
  console.log(JSON.stringify(result.request, null, 2));
  console.log(`===== ${label} RESPONSE (HTTP ${result.http_status}) =====`);
  console.log(result.raw_json);
}
