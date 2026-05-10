import { supabase } from '@/lib/supabase'
import { getRuntimeMessage } from '@/i18n/runtime'

const SESSION_EXPIRED_FOR_DELETE = {
  pt: 'Sua sessão expirou. Faça login novamente para excluir sua conta.',
  en: 'Your session has expired. Please sign in again to delete your account.',
  es: 'Tu sesión expiró. Inicia sesión nuevamente para eliminar tu cuenta.',
} as const

const DELETE_ACCOUNT_NETWORK_ERROR = {
  pt: 'Falha de conexão ao excluir conta. Verifique sua internet, VPN/adblock e tente novamente.',
  en: 'Connection failed while deleting account. Check your internet, VPN/adblock, and try again.',
  es: 'Error de conexión al eliminar la cuenta. Revisa tu internet, VPN/adblock e inténtalo de nuevo.',
} as const

function isTransportError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('failed to send a request to the edge function') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('connection') ||
    normalized.includes('refused_stream')
  )
}

function normalizeDeleteAccountError(error: unknown): Error {
  if (error instanceof Error) {
    if (isTransportError(error.message)) {
      return new Error(getRuntimeMessage(DELETE_ACCOUNT_NETWORK_ERROR))
    }
    return error
  }

  return new Error('Failed to delete account')
}

async function invokeDeleteAccountWithRetry(maxAttempts = 2): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: true },
    })

    if (!error) {
      return
    }

    lastError = new Error(error.message || 'Failed to delete account')
    const shouldRetry = attempt < maxAttempts && isTransportError(lastError.message)
    if (!shouldRetry) {
      throw lastError
    }

    // Refreshing the session can recover from token/connection edge states between retries.
    await supabase.auth.refreshSession()
  }

  if (lastError) {
    throw lastError
  }
}

export async function deleteAccount(): Promise<void> {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }

  if (!session?.access_token) {
    await supabase.auth.signOut()
    throw new Error(getRuntimeMessage(SESSION_EXPIRED_FOR_DELETE))
  }

  try {
    await invokeDeleteAccountWithRetry(2)
  } catch (error) {
    throw normalizeDeleteAccountError(error)
  }

  await supabase.auth.signOut()
}
