import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

// Last line of defense: a render error anywhere below would otherwise
// white-screen the whole PWA. Data is server-side, so a reload recovers.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>😵</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Listo hit a snag</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 6 }}>
            This screen crashed. Your lists are safe — they live in the cloud.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 18, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload Listo
          </button>
        </div>
      </div>
    )
  }
}
