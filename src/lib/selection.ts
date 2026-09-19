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
  strategy: "exact" | "greedy-fallback";
  includesCeiling: boolean;
};

function greedySelection(
  quotes: SelectableSupplierQuote[],
  itemCount: number,
  budgetMinor: number,
): Omit<CombinationSelection, "strategy"> | undefined {
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
    includesCeiling: selected.some((quote) => !quote.amountIsFinal),
  };
}

function exactSelection(
  quotes: SelectableSupplierQuote[],
  itemCount: number,
  budgetMinor: number,
): Omit<CombinationSelection, "strategy"> | undefined {
  const usable = quotes.filter(
    (quote) => quote.ready && quote.totalMinor !== null,
  );
  if (usable.length > 24) {
    throw new Error("Exact-cover candidate limit exceeded.");
  }

  let best:
    | {
        selected: SelectableSupplierQuote[];
        totalMinor: number;
      }
    | undefined;

  function search(
    covered: Set<number>,
    selected: SelectableSupplierQuote[],
    totalMinor: number,
  ) {
    if (totalMinor > budgetMinor || (best && totalMinor >= best.totalMinor)) {
      return;
    }
    if (covered.size === itemCount) {
      best = { selected, totalMinor };
      return;
    }

    const nextItem = Array.from({ length: itemCount }, (_, index) => index).find(
      (index) => !covered.has(index),
    );
    if (nextItem === undefined) return;

    for (const quote of usable) {
      const indexes = quote.items.map((item) => item.requestItemIndex);
      if (!indexes.includes(nextItem)) continue;
      if (indexes.some((index) => covered.has(index))) continue;

      const nextCovered = new Set(covered);
      indexes.forEach((index) => nextCovered.add(index));
      search(
        nextCovered,
        [...selected, quote],
        totalMinor + (quote.totalMinor ?? 0),
      );
    }
  }

  search(new Set(), [], 0);
  if (!best) return undefined;
  return {
    merchantIds: best.selected.map((quote) => quote.merchantId),
    totalMinor: best.totalMinor,
    includesCeiling: best.selected.some((quote) => !quote.amountIsFinal),
  };
}

export function selectCombination(
  quotes: SelectableSupplierQuote[],
  itemCount: number,
  budgetMinor: number,
): CombinationSelection | undefined {
  try {
    const exact = exactSelection(quotes, itemCount, budgetMinor);
    if (exact) return { ...exact, strategy: "exact" };
  } catch (error) {
    console.warn("[Onyx selection] Exact cover failed; using greedy.", error);
  }

  const greedy = greedySelection(quotes, itemCount, budgetMinor);
  return greedy ? { ...greedy, strategy: "greedy-fallback" } : undefined;
}
