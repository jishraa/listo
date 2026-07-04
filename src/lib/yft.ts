// YFT (Your Financial Tracker) — companion app integration.
// Principle: manage shopping in Listo, spending in YFT. Surfaces only at
// contextual moments (shopping complete, insights, reports) — never as ads.
export const YFT_URL = 'https://yft.grk766.workers.dev'

export function openYft(path: '/tracker/monthly' | '/insights' | '' = '') {
  window.open(`${YFT_URL}${path}`, '_blank', 'noopener')
}
