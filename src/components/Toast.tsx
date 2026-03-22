import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: ToastMessage[]
  addToast: (type: ToastType, message: string, duration?: number) => string
  removeToast: (id: string) => void
  clearToasts: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => string
  success: (message: string, duration?: number) => string
  error: (message: string, duration?: number) => string
  warning: (message: string, duration?: number) => string
  info: (message: string, duration?: number) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

type GlobalToastDispatcher = {
  addToast: (type: ToastType, message: string, duration?: number) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

let globalToastDispatcher: GlobalToastDispatcher | null = null

export const toast = {
  showToast(message: string, type: ToastType = 'info', duration?: number): string | null {
    if (!globalToastDispatcher) return null
    return globalToastDispatcher.addToast(type, message, duration)
  },
  success(message: string, duration?: number): string | null {
    if (!globalToastDispatcher) return null
    return globalToastDispatcher.addToast('success', message, duration)
  },
  error(message: string, duration?: number): string | null {
    if (!globalToastDispatcher) return null
    return globalToastDispatcher.addToast('error', message, duration)
  },
  warning(message: string, duration?: number): string | null {
    if (!globalToastDispatcher) return null
    return globalToastDispatcher.addToast('warning', message, duration)
  },
  info(message: string, duration?: number): string | null {
    if (!globalToastDispatcher) return null
    return globalToastDispatcher.addToast('info', message, duration)
  },
  remove(id: string): void {
    globalToastDispatcher?.removeToast(id)
  },
  clear(): void {
    globalToastDispatcher?.clearToasts()
  },
}

interface ToastItemProps {
  toast: ToastMessage
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id)
    }, toast.duration || 4000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  }

  const bgColors = {
    success: 'bg-green-500/10 border-green-500/30',
    error: 'bg-red-500/10 border-red-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    info: 'bg-blue-500/10 border-blue-500/30',
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColors[toast.type]} 
        backdrop-blur-sm shadow-lg animate-slide-in-right min-w-[280px] max-w-[400px]`}
    >
      {icons[toast.type]}
      <span className="text-white text-sm flex-1">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4 text-dark-400" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setToasts((prev) => [...prev, { id, type, message, duration }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  useEffect(() => {
    globalToastDispatcher = { addToast, removeToast, clearToasts }
    return () => {
      globalToastDispatcher = null
    }
  }, [addToast, removeToast, clearToasts])

  const success = useCallback((message: string, duration?: number) => addToast('success', message, duration), [addToast])
  const error = useCallback((message: string, duration?: number) => addToast('error', message, duration), [addToast])
  const warning = useCallback((message: string, duration?: number) => addToast('warning', message, duration), [addToast])
  const info = useCallback((message: string, duration?: number) => addToast('info', message, duration), [addToast])
  const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => addToast(type, message, duration), [addToast])

  const value = useMemo<ToastContextValue>(() => ({
    toasts,
    addToast,
    removeToast,
    clearToasts,
    showToast,
    success,
    error,
    warning,
    info,
  }), [toasts, addToast, removeToast, clearToasts, showToast, success, error, warning, info])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

// Hook for global toast access
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}
