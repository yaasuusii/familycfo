// Ethiopian Calendar conversion utilities
// Uses Julian Day Number (JDN) as intermediary for conversions

const ETH_MONTHS = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
  "Megabit", "Miyazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
];

export interface EthiopianDate {
  year: number;
  month: number; // 1-13
  day: number;
}

function gregorianToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

function ethiopianToJDN(year: number, month: number, day: number): number {
  return 1724221 + 365 * (year - 1) + Math.floor((year - 1) / 4) + 30 * (month - 1) + day - 1;
}

export function toEthiopian(date: Date): EthiopianDate {
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return jdnToEthiopian(jdn);
}

export function toGregorian(ethYear: number, ethMonth: number, ethDay: number): Date {
  const jdn = ethiopianToJDN(ethYear, ethMonth, ethDay);
  // Convert JDN back to Gregorian
  const l = jdn + 68569;
  const n = Math.floor(4 * l / 146097);
  const l2 = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor(4000 * (l2 + 1) / 1461001);
  const l3 = l2 - Math.floor(1461 * i / 4) + 31;
  const j = Math.floor(80 * l3 / 2447);
  const day = l3 - Math.floor(2447 * j / 80);
  const l4 = Math.floor(j / 11);
  const month = j + 2 - 12 * l4;
  const year = 100 * (n - 49) + i + l4;
  return new Date(year, month - 1, day);
}

export function getEthiopianMonthName(month: number): string {
  return ETH_MONTHS[month - 1] || "";
}

export function formatEthiopianDate(date: Date): string {
  const eth = toEthiopian(date);
  return `${eth.day} ${getEthiopianMonthName(eth.month)} ${eth.year}`;
}

export function getCurrentEthiopianMonth(): EthiopianDate {
  const eth = toEthiopian(new Date());
  return { year: eth.year, month: eth.month, day: eth.day };
}

/** Returns Gregorian start and end dates for an Ethiopian month (for DB queries) */
export function getEthiopianMonthDateRange(ethYear: number, ethMonth: number): { start: string; end: string } {
  const startDate = toGregorian(ethYear, ethMonth, 1);
  const daysInMonth = ethMonth <= 12 ? 30 : isEthiopianLeapYear(ethYear) ? 6 : 5;
  const endDate = toGregorian(ethYear, ethMonth, daysInMonth);
  
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(startDate), end: fmt(endDate) };
}

export function isEthiopianLeapYear(ethYear: number): boolean {
  return (ethYear % 4) === 3;
}

export function getEthiopianDaysInMonth(ethMonth: number, ethYear: number): number {
  if (ethMonth <= 12) return 30;
  return isEthiopianLeapYear(ethYear) ? 6 : 5;
}

/** Get current Ethiopian month identifier string like "2018-06" */
export function getCurrentEthMonth(): string {
  const eth = getCurrentEthiopianMonth();
  return `${eth.year}-${String(eth.month).padStart(2, "0")}`;
}

/** Parse Ethiopian month string "YYYY-MM" */
export function parseEthMonth(ethMonth: string): { year: number; month: number } {
  const [y, m] = ethMonth.split("-").map(Number);
  return { year: y, month: m };
}

/** Get list of Ethiopian months for selectors (last 12 months) */
export function getEthiopianMonthOptions(): { value: string; label: string }[] {
  const current = getCurrentEthiopianMonth();
  const arr: { value: string; label: string }[] = [];
  let y = current.year;
  let m = current.month;
  for (let i = 0; i < 13; i++) {
    const val = `${y}-${String(m).padStart(2, "0")}`;
    const label = `${getEthiopianMonthName(m)} ${y}`;
    arr.push({ value: val, label });
    m--;
    if (m < 1) { m = 13; y--; }
  }
  return arr;
}

/** Format a Gregorian date string (YYYY-MM-DD) to Ethiopian display */
export function formatGregorianToEthiopian(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return formatEthiopianDate(d);
}
