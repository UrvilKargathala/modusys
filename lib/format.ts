const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInr(value: number) {
  return inrFormatter.format(value);
}

export function formatPercent(value: number) {
  return `${Math.abs(value).toFixed(1)}%`;
}
