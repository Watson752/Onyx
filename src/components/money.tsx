export function formatMoney(
  amountMinor: number | null | undefined,
  currency: string,
) {
  if (amountMinor === null || amountMinor === undefined) return "Unavailable";
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
    }).format(amountMinor / 100);
  } catch {
    return `${amountMinor} ${currency} minor units`;
  }
}

export function Money({
  amountMinor,
  currency,
}: {
  amountMinor: number | null | undefined;
  currency: string;
}) {
  return <>{formatMoney(amountMinor, currency)}</>;
}
