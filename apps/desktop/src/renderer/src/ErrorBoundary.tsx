import React from 'react'
import { sharedTokens } from '@baishou/ui/theme/tokens'

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: sharedTokens.spacing.mdPlus, color: 'red' }}>
          <h1>React Error</h1>
          <pre>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
