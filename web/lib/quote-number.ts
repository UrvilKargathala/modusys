// Sub-quotes: a customer's repeat quotes share the number of their oldest quote and carry a letter in brackets,
// QT-020926-03(A), (B), (C). The earlier no-bracket form (QT-020926-03A) is still read as the same thing.
const SUB_NUMBER = /^(QT-\d{6}-\d+)(?:\(([A-Z])\)|([A-Z]))?$/;

// Splits a quote number into its base and sub-quote letter ("" when it has none); null for an unrecognised format.
export function parseQuoteNumber(n: string): { base: string; letter: string } | null {
  const m = n.match(SUB_NUMBER);
  return m ? { base: m[1], letter: m[2] ?? m[3] ?? "" } : null;
}

const groupKey = (customerId: string | null, base: string) => `${customerId}|${base}`;

// Ids of sub-quotes that have a later letter for the same customer: only the last sub-quote (C of A, B, C) counts as the deal.
export function supersededSubQuoteIds(quotes: { id: string; customerId: string | null; quoteNumber: string }[]): Set<string> {
  const lastLetter = new Map<string, string>();
  for (const q of quotes) {
    const p = parseQuoteNumber(q.quoteNumber);
    if (!p?.letter) continue;
    const k = groupKey(q.customerId, p.base);
    if (p.letter > (lastLetter.get(k) ?? "")) lastLetter.set(k, p.letter);
  }
  return new Set(
    quotes
      .filter((q) => {
        const p = parseQuoteNumber(q.quoteNumber);
        return !!p?.letter && p.letter < lastLetter.get(groupKey(q.customerId, p.base))!;
      })
      .map((q) => q.id)
  );
}
