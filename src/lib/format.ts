export function formatETB(amount: number): string {
  return `ETB ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export { formatEthiopianDate, formatGregorianToEthiopian } from "./ethiopian-calendar";
