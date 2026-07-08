// Vitest setup — jest-dom matchers (toBeInTheDocument, toHaveAttribute, …).
// Loaded for every test file; harmless in node-environment logic tests.
import '@testing-library/jest-dom/vitest'

// Node exposes a partial experimental localStorage global that shadows
// jsdom's and breaks zustand's persist middleware in node-env tests.
// Install a complete in-memory Storage when the real one is unusable.
const ls = (globalThis as { localStorage?: Storage }).localStorage
if (!ls || typeof ls.clear !== 'function') {
  const backing = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => { backing.set(k, String(v)) },
      removeItem: (k: string) => { backing.delete(k) },
      clear: () => { backing.clear() },
      key: (i: number) => [...backing.keys()][i] ?? null,
      get length() { return backing.size },
    } as Storage,
  })
}
