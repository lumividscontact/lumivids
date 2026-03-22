import React from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { reportError } from '@/lib/errorMonitoring'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryTexts {
  title: string
  description: string
  technicalDetails: string
  retry: string
  goHome: string
}

interface ErrorBoundaryInnerProps extends ErrorBoundaryProps {
  texts: ErrorBoundaryTexts
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundaryInner extends React.Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught app error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
    reportError(error, {
      source: 'react.error-boundary',
      componentStack: errorInfo.componentStack,
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-500/20 bg-dark-900/70 backdrop-blur-sm p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>

          <h1 className="text-xl font-semibold text-white mb-2">{this.props.texts.title}</h1>
          <p className="text-dark-300 mb-6">
            {this.props.texts.description}
          </p>

          {this.state.error?.message && (
            <div className="mb-6 rounded-xl bg-dark-800/80 border border-dark-700 p-3 text-left">
              <p className="text-xs text-dark-400 mb-1">{this.props.texts.technicalDetails}</p>
              <p className="text-xs text-red-300 break-words">{this.state.error.message}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex-1 py-2.5 rounded-xl bg-dark-800 text-white font-medium hover:bg-dark-700 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {this.props.texts.retry}
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex-1 py-2.5 rounded-xl bg-purple-500/20 text-purple-300 font-medium hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              {this.props.texts.goHome}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default function ErrorBoundary(props: ErrorBoundaryProps) {
  const { t } = useLanguage()

  return (
    <ErrorBoundaryInner
      {...props}
      texts={{
        title: t.errorBoundary.title,
        description: t.errorBoundary.description,
        technicalDetails: t.errorBoundary.technicalDetails,
        retry: t.errorBoundary.retry,
        goHome: t.errorBoundary.goHome,
      }}
    />
  )
}
