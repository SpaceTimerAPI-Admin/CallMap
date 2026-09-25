import { CATEGORIES, MIN_RADIUS, MAX_RADIUS } from './config.js';

export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
// '' = none given, null = invalid, else +1XXXXXXXXXX
export function normPhone(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}
export const clampRadius = (r) => Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round((+r || 1) * 4) / 4));
export const cleanCats = (c) => [...new Set((Array.isArray(c) ? c : []).filter((x) => CATEGORIES.includes(x)))];
