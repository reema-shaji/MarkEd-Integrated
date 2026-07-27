// Shared date formatting so every surface renders dates the same way.
// The app previously drifted across five formats (DD/MM/YYYY HH:MM:SS,
// DD Mon, DD Mon YYYY, …); standardise on a single readable one:
//   formatDateTime → "23 Jul 2026, 15:08"  (day month year, 24h, no seconds)
//   formatDate     → "23 Jul 2026"

type DateInput = string | number | Date | null | undefined

function toDate(value: DateInput): Date | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value)
  if (!d) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDate(value: DateInput): string {
  const d = toDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
