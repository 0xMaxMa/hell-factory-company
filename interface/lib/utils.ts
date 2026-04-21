export function parseEarnings(val: string | undefined): number {
  if (!val || val === 'N/A' || val === '0') return 0
  const match = val.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}
