import { supabase } from '@/lib/supabase'

export async function requestWelcomeEmail(): Promise<void> {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }

  if (!session?.access_token) {
    return
  }

  const { error } = await supabase.functions.invoke('send-welcome-email', {
    body: {},
  })

  if (!error) {
    return
  }

  const message = (error.message || '').toLowerCase()
  const isTransientOrAuthIssue =
    message.includes('failed to send a request to the edge function') ||
    message.includes('failed to fetch') ||
    message.includes('refused_stream') ||
    message.includes('unauthorized') ||
    message.includes('invalid token')

  if (isTransientOrAuthIssue) {
    return
  }

  throw new Error(error.message || 'Failed to request welcome email')
}
