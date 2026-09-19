export type SelectableSupplierQuote = {
  merchantId: string;
  ready: boolean;
  totalMinor: number | null;
  amountIsFinal: boolean;
  items: Array<{ requestItemIndex: number }>;
};

export type CombinationSelection = {
  merchantIds: string[];
  totalMinor: number;
  strategy: "greedy";
  includesCeiling: boolean;
};

export function selectCombination(
  quotes: SelectableSupplierQuote[],
  itemCount: number,
  budgetMinor: number,
): CombinationSelection | undefined {
  const usable = quotes.filter(
    (quote) => quote.ready && quote.totalMinor !== null,
  );
  const covered = new Set<number>();
  const selected: SelectableSupplierQuote[] = [];
  let totalMinor = 0;

  while (covered.size < itemCount) {
    const candidate = usable
      .filter((quote) => {
        const indexes = quote.items.map((item) => item.requestItemIndex);
        return (
          indexes.some((index) => !covered.has(index)) &&
          indexes.every((index) => !covered.has(index))
        );
      })
      .sort((left, right) => {
        const leftCost =
          (left.totalMinor ?? Number.POSITIVE_INFINITY) / left.items.length;
        const rightCost =
          (right.totalMinor ?? Number.POSITIVE_INFINITY) / right.items.length;
        return leftCost - rightCost;
      })[0];

    if (!candidate || candidate.totalMinor === null) return undefined;
    selected.push(candidate);
    candidate.items.forEach((item) => covered.add(item.requestItemIndex));
    totalMinor += candidate.totalMinor;
  }

  if (totalMinor > budgetMinor) return undefined;
  return {
    merchantIds: selected.map((quote) => quote.merchantId),
    totalMinor,
    strategy: "greedy",
    includesCeiling: selected.some((quote) => !quote.amountIsFinal),
  };
}
