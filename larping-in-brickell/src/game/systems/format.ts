export function money(n: number, compact = false): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (compact) {
    if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
    if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  }
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`;
}

export function num(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-US');
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function clock(minute: number): string {
  const m = Math.floor(minute) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm.toString().padStart(2, '0')} ${ampm}`;
}

export function dateLabel(day: number, monthDays: number): string {
  const month = Math.floor((day - 1) / monthDays) + 1;
  const d = ((day - 1) % monthDays) + 1;
  return `Month ${month} · Day ${d}`;
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
