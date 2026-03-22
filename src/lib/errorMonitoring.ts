type ErrorContext = {
  source?: string
  componentStack?: string
  extra?: Record<string, unknown>
}

let monitoringInitialized = false

const ERROR_REPORT_ENDPOINT = import.meta.env.VITE_ERROR_REPORT_ENDPOINT as string | undefined

function getUserAgent() {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }

  return navigator.userAgent
}

function postErrorReport(payload: Record<string, unknown>) {
  if (!ERROR_REPORT_ENDPOINT) {
    return
  }

  const body = JSON.stringify(payload)

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(ERROR_REPORT_ENDPOINT, blob)
    return
  }

  fetch(ERROR_REPORT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore network/reporting failures to avoid recursive errors
  })
}

export function reportError(error: unknown, context: ErrorContext = {}) {
  const normalizedError = error instanceof Error ? error : new Error(String(error))

  const payload = {
    message: normalizedError.message,
    name: normalizedError.name,
    stack: normalizedError.stack,
    source: context.source ?? 'frontend',
    componentStack: context.componentStack,
    extra: context.extra,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: getUserAgent(),
    timestamp: new Date().toISOString(),
  }

  postErrorReport(payload)
}

export function initErrorMonitoring() {
  if (monitoringInitialized || typeof window === 'undefined') {
    return
  }

  monitoringInitialized = true

  window.addEventListener('error', (event) => {
    reportError(event.error ?? new Error(event.message), {
      source: 'window.error',
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), {
      source: 'window.unhandledrejection',
    })
  })
}
