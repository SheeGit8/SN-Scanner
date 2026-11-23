import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names, letting later Tailwind utilities override earlier ones. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** True when any of the values contains the query (case-insensitive); empty query matches all. */
export function matchesQuery(values, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return values.some((v) => String(v ?? '').toLowerCase().includes(q))
}

/** Visible 3 px focus ring for keyboard users, at full opacity. */
export const focusRing = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:border-ring'
