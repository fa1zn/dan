export const fmt = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("en-US");

export const pct = (num: number, den: number): string =>
  den === 0 ? "0%" : `${((100 * num) / den).toFixed(1)}%`;
