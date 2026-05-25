import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: '#0a0a0a',
              color: '#f5f5f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ fontSize: 14, letterSpacing: '0.1em', color: '#f59e0b', marginBottom: 12 }}>
              SYSTEM ERROR
            </div>
            <div style={{ fontSize: 12, color: '#888', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
              The dashboard encountered an error and has been contained.
              <br />
              Reload the page to recover.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 20,
                padding: '10px 20px',
                background: '#f59e0b',
                color: '#0a0a0a',
                border: 'none',
                fontSize: 11,
                letterSpacing: '0.1em',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              RELOAD
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
