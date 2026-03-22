import { supabase } from '@/lib/supabase'
import { getRuntimeMessage } from '@/i18n/runtime'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const SESSION_EXPIRED_FOR_DELETE = {
  pt: 'Sua sessão expirou. Faça login novamente para excluir sua conta.',
  en: 'Your session has expired. Please sign in again to delete your account.',
  es: 'Tu sesión expiró. Inicia sesión nuevamente para eliminar tu cuenta.',
} as const

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

  const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'x-supabase-auth': session.access_token,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ confirm: true }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete account')
  }

  await supabase.auth.signOut()
}
