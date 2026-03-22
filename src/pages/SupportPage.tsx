import { useCallback, useEffect, useState } from 'react'
import { LifeBuoy, Loader2, MessageSquare, Send } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  createSupportTicketByUser,
  fetchMySupportTickets,
  fetchSupportMessages,
  sendSupportMessage,
  type SupportMessageRow,
  type SupportTicketRow,
} from '@/services/admin'

type TicketStatusFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'

export default function SupportPage() {
  const { user } = useAuth()

  const [tickets, setTickets] = useState<SupportTicketRow[]>([])
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>('all')
  const [loadingTickets, setLoadingTickets] = useState(true)

  const [selectedTicket, setSelectedTicket] = useState<SupportTicketRow | null>(null)
  const [messages, setMessages] = useState<SupportMessageRow[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [newSubject, setNewSubject] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)

  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true)
    try {
      const result = await fetchMySupportTickets(0, 50, statusFilter)
      setTickets(result.tickets)

      if (result.tickets.length === 0) {
        setSelectedTicket(null)
        setMessages([])
      } else if (!selectedTicket) {
        setSelectedTicket(result.tickets[0])
      } else {
        const stillExists = result.tickets.find((ticket) => ticket.id === selectedTicket.id)
        if (!stillExists) {
          setSelectedTicket(result.tickets[0])
        } else {
          setSelectedTicket(stillExists)
        }
      }
    } catch (error) {
      console.error('[SupportPage] Failed to load tickets:', error)
    } finally {
      setLoadingTickets(false)
    }
  }, [selectedTicket, statusFilter])

  const loadMessages = useCallback(async (ticketId: string) => {
    setLoadingMessages(true)
    try {
      const rows = await fetchSupportMessages(ticketId)
      setMessages(rows)
    } catch (error) {
      console.error('[SupportPage] Failed to load messages:', error)
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useEffect(() => {
    if (!selectedTicket) return
    loadMessages(selectedTicket.id)
  }, [selectedTicket, loadMessages])

  const handleCreateTicket = async () => {
    if (!user?.id || !newSubject.trim() || !newMessage.trim()) return

    setCreatingTicket(true)
    try {
      const result = await createSupportTicketByUser({
        userId: user.id,
        subject: newSubject.trim(),
        message: newMessage.trim(),
      })

      setNewSubject('')
      setNewMessage('')
      const refreshed = await fetchMySupportTickets(0, 50, statusFilter)
      setTickets(refreshed.tickets)
      const created = refreshed.tickets.find((item) => item.id === result.ticketId)
      if (created) setSelectedTicket(created)
    } catch (error) {
      console.error('[SupportPage] Failed to create ticket:', error)
      window.alert(error instanceof Error ? error.message : 'Falha ao criar ticket')
    } finally {
      setCreatingTicket(false)
    }
  }

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim() || !user?.id) return

    setSendingReply(true)
    try {
      await sendSupportMessage({
        ticketId: selectedTicket.id,
        message: reply.trim(),
        senderRole: 'user',
        senderUserId: user.id,
      })
      setReply('')
      await Promise.all([loadMessages(selectedTicket.id), loadTickets()])
    } catch (error) {
      console.error('[SupportPage] Failed to send message:', error)
      window.alert(error instanceof Error ? error.message : 'Falha ao enviar mensagem')
    } finally {
      setSendingReply(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dark-700 bg-dark-800/40 p-4">
        <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-primary-400" />
          Suporte
        </h2>
        <p className="text-sm text-dark-400 mt-1">Abra tickets e converse com nossa equipe.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-4">
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Assunto"
            className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
          />
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mensagem inicial"
            className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm lg:col-span-2"
          />
        </div>

        <button
          onClick={handleCreateTicket}
          disabled={creatingTicket || !newSubject.trim() || !newMessage.trim()}
          className="mt-3 btn-primary text-sm px-4 py-2 disabled:opacity-40"
        >
          {creatingTicket ? 'Criando...' : 'Criar ticket'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-dark-700 bg-dark-800/40 overflow-hidden">
          <div className="p-4 border-b border-dark-700 flex items-center justify-between gap-2">
            <h3 className="text-white font-semibold">Meus tickets</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatusFilter)}
              className="px-2 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-xs text-white"
            >
              <option value="all">Todos</option>
              <option value="open">Abertos</option>
              <option value="in_progress">Em andamento</option>
              <option value="resolved">Resolvidos</option>
              <option value="closed">Fechados</option>
            </select>
          </div>

          <div className="max-h-[28rem] overflow-y-auto divide-y divide-dark-800">
            {loadingTickets ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="p-4 text-sm text-dark-500">Você ainda não tem tickets.</p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full text-left p-3 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-dark-700/50' : 'hover:bg-dark-800/40'}`}
                >
                  <p className="text-sm text-white truncate">{ticket.subject}</p>
                  <p className="text-xs text-dark-400 mt-1">{ticket.status} · {new Date(ticket.updated_at).toLocaleString()}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-dark-700 bg-dark-800/40 overflow-hidden xl:col-span-2">
          <div className="p-4 border-b border-dark-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary-400" />
            <h3 className="text-white font-semibold">{selectedTicket ? selectedTicket.subject : 'Conversa'}</h3>
          </div>

          <div className="max-h-[24rem] overflow-y-auto divide-y divide-dark-800">
            {!selectedTicket ? (
              <p className="p-4 text-sm text-dark-500">Selecione um ticket para ver as mensagens.</p>
            ) : loadingMessages ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
              </div>
            ) : messages.length === 0 ? (
              <p className="p-4 text-sm text-dark-500">Sem mensagens ainda.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs ${message.sender_role === 'admin' ? 'text-primary-300' : 'text-dark-400'}`}>
                      {message.sender_role}
                    </span>
                    <span className="text-xs text-dark-500">{new Date(message.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-white mt-1 whitespace-pre-wrap">{message.message}</p>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-dark-700 flex items-center gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escreva sua mensagem..."
              disabled={!selectedTicket || sendingReply}
              className="flex-1 px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm disabled:opacity-50"
            />
            <button
              onClick={handleReply}
              disabled={!selectedTicket || !reply.trim() || sendingReply}
              className="btn-primary text-sm px-3 py-2 disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
              {sendingReply ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
