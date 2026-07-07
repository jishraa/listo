// Bundle budget gate — run after `vite build`. Fails the build when the
// INITIAL JS payload (chunks referenced from dist/index.html: entry script +
// modulepreloads) exceeds the budget. Lazy route/report chunks are reported
// but not gated — they load on demand.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const INITIAL_BUDGET_KB = 300 // gzip, per QE framework quality gates

const dist = new URL('../dist', import.meta.url).pathname
const html = readFileSync(join(dist, 'index.html'), 'utf8')

const initial = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(m => m[1])
)

const gzKB = f => gzipSync(readFileSync(join(dist, f))).length / 1024

let initialKB = 0
console.log('Initial JS (entry + modulepreload):')
for (const f of initial) {
  const kb = gzKB(f)
  initialKB += kb
  console.log(`  ${kb.toFixed(1).padStart(7)} KB gz  ${f}`)
}

let lazyKB = 0
for (const f of readdirSync(join(dist, 'assets'))) {
  const rel = `assets/${f}`
  if (!f.endsWith('.js') || initial.has(rel)) continue
  if (!statSync(join(dist, rel)).isFile()) continue
  lazyKB += gzKB(rel)
}

console.log(`\nInitial total: ${initialKB.toFixed(1)} KB gz (budget ${INITIAL_BUDGET_KB} KB)`)
console.log(`Lazy total:    ${lazyKB.toFixed(1)} KB gz (not gated)`)

if (initialKB > INITIAL_BUDGET_KB) {
  console.error(`\n✗ Initial JS exceeds the ${INITIAL_BUDGET_KB} KB gzip budget.`)
  process.exit(1)
}
console.log('\n✓ Bundle budget OK')
