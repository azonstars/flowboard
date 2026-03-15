import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../constants/roles'
import {
  getMyConversations, getBroadcastConversations,
  getOrCreateP2P, createGroupConversation, createBroadcast,
  getMessages, sendMessage, deleteMessage,
  uploadChatFile, toggleReaction, markAsRead, getAllUsers,
  subscribeToMessages,
} from '../../services/chatService'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  central_checker: 'bg-primary-100 text-primary-700',
  divisional_checker: 'bg-cyan-100 text-cyan-700',
  regional_checker: 'bg-teal-100 text-teal-700',
  branch_manager: 'bg-green-100 text-green-700',
  branch_employee: 'bg-gray-100 text-gray-600',
}

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts), now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}

const formatLastSeen = (ts) => {
  if (!ts) return 'কখনো না'
  const d = new Date(ts), now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'এইমাত্র'
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}

const formatFileSize = (b) => {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

const Avatar = ({ name, size = 'md', online }) => {
  const sc = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-base'
  const colors = ['bg-primary-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-teal-500']
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div className="relative shrink-0">
      <div className={`${sc} ${color} rounded-full flex items-center justify-center text-white font-bold`}>
        {name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
      )}
    </div>
  )
}

export default function ChatPage() {
  const { profile } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [allUsers, setAllUsers] = useState([])
  const [onlineUsers, setOnlineUsers] = useState({})
  const [hierarchyLoading, setHierarchyLoading] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [groupName, setGroupName] = useState('')
  const [broadcastName, setBroadcastName] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [searchMsg, setSearchMsg] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [reactionTarget, setReactionTarget] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [pinnedMsg, setPinnedMsg] = useState(null)
  const [typingUsers, setTypingUsers] = useState({})
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [newChatStep, setNewChatStep] = useState('compose')
  const [newChatText, setNewChatText] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showNewBroadcast, setShowNewBroadcast] = useState(false)
  const [showStarred, setShowStarred] = useState(false)
  const [msgMenu, setMsgMenu] = useState(null)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const subscriptionRef = useRef(null)
  const typingRef = useRef(null)
  const audioChunksRef = useRef([])
  const typingChannelRef = useRef(null)
  const presenceChannelRef = useRef(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('profiles').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', profile.id)
    const handleUnload = () => supabase.from('profiles').update({ is_online: false, last_seen_at: new Date().toISOString() }).eq('id', profile.id)
    window.addEventListener('beforeunload', handleUnload)
    const interval = setInterval(() => {
      supabase.from('profiles').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', profile.id)
    }, 30000)
    presenceChannelRef.current = supabase.channel('online_status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setOnlineUsers(prev => ({ ...prev, [payload.new.id]: { is_online: payload.new.is_online, last_seen_at: payload.new.last_seen_at } }))
      }).subscribe()
    supabase.from('profiles').select('id, is_online, last_seen_at').then(({ data }) => {
      if (data) {
        const map = {}
        data.forEach(u => { map[u.id] = { is_online: u.is_online, last_seen_at: u.last_seen_at } })
        setOnlineUsers(map)
      }
    })
    return () => {
      handleUnload()
      window.removeEventListener('beforeunload', handleUnload)
      clearInterval(interval)
      presenceChannelRef.current?.unsubscribe()
    }
  }, [profile?.id])

  const loadConversations = useCallback(async () => {
    if (!profile?.id) return
    try {
      const [mine, broadcasts] = await Promise.all([getMyConversations(profile.id), getBroadcastConversations()])
      const myConvs = mine.map(p => ({ ...p.chat_conversations, last_read_at: p.last_read_at, participants: p.chat_conversations.chat_participants }))
      const broadcastConvs = broadcasts.filter(b => !myConvs.find(c => c.id === b.id))
      const allConvs = [...myConvs, ...broadcastConvs]
      setConversations(allConvs)
      const counts = {}
      await Promise.all(allConvs.map(async (conv) => {
        if (!conv.last_read_at) { counts[conv.id] = 99; return }
        const { count } = await supabase.from('chat_messages').select('id', { count: 'exact' })
          .eq('conversation_id', conv.id).neq('sender_id', profile.id).gt('created_at', conv.last_read_at)
        counts[conv.id] = count || 0
      }))
      setUnreadCounts(counts)
    } catch (err) { console.error(err) }
  }, [profile?.id])

  useEffect(() => { loadConversations() }, [loadConversations])

  useEffect(() => {
    if (!activeConvId) return
    const conv = conversations.find(c => c.id === activeConvId)
    setActiveConv(conv)
    setReplyTo(null)
    setShowSearch(false)
    setSearchMsg('')
    setUnreadCounts(prev => ({ ...prev, [activeConvId]: 0 }))
    loadMessages(activeConvId)
    markAsRead(activeConvId, profile.id)
    supabase.from('chat_messages').select('*, profiles(full_name,role)').eq('conversation_id', activeConvId).eq('is_pinned', true).maybeSingle().then(({ data }) => setPinnedMsg(data))
    if (subscriptionRef.current) subscriptionRef.current.unsubscribe()
    subscriptionRef.current = subscribeToMessages(activeConvId, (payload) => fetchNewMessage(payload.new))
    if (typingChannelRef.current) typingChannelRef.current.unsubscribe()
    typingChannelRef.current = supabase.channel(`typing:${activeConvId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== profile.id) {
          setTypingUsers(prev => ({ ...prev, [payload.userId]: { name: payload.name } }))
          setTimeout(() => setTypingUsers(prev => { const n = { ...prev }; delete n[payload.userId]; return n }), 3000)
        }
      }).subscribe()
    return () => { subscriptionRef.current?.unsubscribe(); typingChannelRef.current?.unsubscribe() }
  }, [activeConvId])

  const loadMessages = async (convId) => {
    setLoading(true)
    try { const data = await getMessages(convId); setMessages(data); setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  const fetchNewMessage = async (newMsg) => {
    const { data } = await supabase.from('chat_messages')
      .select('*, profiles(id,full_name,role), chat_reactions(id,emoji,user_id)')
      .eq('id', newMsg.id).single()
    if (data) {
      setMessages(prev => [...prev.filter(m => m.id !== data.id), data])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      markAsRead(newMsg.conversation_id, profile.id)
      if (newMsg.conversation_id === activeConvId) {
        setUnreadCounts(prev => ({ ...prev, [newMsg.conversation_id]: 0 }))
      }
      const seenBy = data.seen_by || []
      if (!seenBy.includes(profile.id)) supabase.from('chat_messages').update({ seen_by: [...seenBy, profile.id] }).eq('id', data.id)
    }
    loadConversations()
  }

  const handleTyping = () => {
    if (!typingChannelRef.current || !activeConvId) return
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: profile.id, name: profile.full_name } })
    clearTimeout(typingRef.current)
  }

  const getConvName = (conv) => {
    if (!conv) return ''
    if (conv.type === 'group' || conv.type === 'broadcast') return conv.name || 'Unnamed'
    return conv.participants?.find(p => p.user_id !== profile.id)?.profiles?.full_name || 'Unknown'
  }

  const getConvOtherUserId = (conv) => {
    if (!conv || conv.type !== 'p2p') return null
    return conv.participants?.find(p => p.user_id !== profile.id)?.user_id
  }

  const getConvSubtitle = (conv) => {
    if (!conv) return ''
    if (conv.type === 'broadcast') return '📢 Broadcast'
    if (conv.type === 'group') return `👥 ${conv.participants?.length || 0} জন`
    const otherId = getConvOtherUserId(conv)
    const status = onlineUsers[otherId]
    if (status?.is_online) return '🟢 Online'
    if (status?.last_seen_at) return `Last seen: ${formatLastSeen(status.last_seen_at)}`
    return ROLE_LABELS[conv.participants?.find(p => p.user_id !== profile.id)?.profiles?.role] || ''
  }

  const handleSend = async () => {
    if (!text.trim() || !activeConvId) return
    setSending(true)
    const tempText = text, tempReply = replyTo
    setText(''); setReplyTo(null)
    try {
      const msg = await sendMessage({ conversationId: activeConvId, senderId: profile.id, content: tempText, replyToId: tempReply?.id })
      setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      loadConversations()
    } catch (err) { toast.error(err.message); setText(tempText) }
    finally { setSending(false) }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 10485760) { toast.error('ফাইল ১০MB এর বেশি হবে না!'); return }
    setUploading(true)
    try {
      const url = await uploadChatFile(file, profile.id)
      const msg = await sendMessage({ conversationId: activeConvId, senderId: profile.id, type: file.type.startsWith('image/') ? 'image' : 'file', content: file.name, fileUrl: url, fileName: file.name, fileSize: file.size })
      setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      loadConversations()
    } catch (err) { toast.error(err.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        setUploading(true)
        try {
          const url = await uploadChatFile(file, profile.id)
          const msg = await sendMessage({ conversationId: activeConvId, senderId: profile.id, type: 'voice', content: 'Voice message', fileUrl: url, fileName: file.name, fileSize: file.size })
          setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          loadConversations()
        } catch (err) { toast.error(err.message) }
        finally { setUploading(false) }
      }
      mr.start(); setMediaRecorder(mr); setRecording(true)
    } catch { toast.error('Microphone access দিন!') }
  }

  const stopRecording = () => { mediaRecorder?.stop(); setRecording(false); setMediaRecorder(null) }

  const handleReaction = async (messageId, emoji) => {
    try {
      await toggleReaction(messageId, profile.id, emoji)
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const existing = m.chat_reactions?.find(r => r.user_id === profile.id)
        let reactions = m.chat_reactions || []
        if (existing) {
          if (existing.emoji === emoji) reactions = reactions.filter(r => r.user_id !== profile.id)
          else reactions = reactions.map(r => r.user_id === profile.id ? { ...r, emoji } : r)
        } else reactions = [...reactions, { id: Date.now(), message_id: messageId, user_id: profile.id, emoji }]
        return { ...m, chat_reactions: reactions }
      }))
    } catch (err) { toast.error(err.message) }
    setReactionTarget(null)
  }

  const handleDelete = async (msgId) => {
    if (!confirm('Message মুছে ফেলবেন?')) return
    try { await deleteMessage(msgId); setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, content: null } : m)) }
    catch (err) { toast.error(err.message) }
    setMsgMenu(null)
  }

  const handleStar = async (msg) => {
    const isStarred = (msg.starred_by || []).includes(profile.id)
    const newStarred = isStarred ? msg.starred_by.filter(id => id !== profile.id) : [...(msg.starred_by || []), profile.id]
    await supabase.from('chat_messages').update({ starred_by: newStarred }).eq('id', msg.id)
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, starred_by: newStarred } : m))
    setMsgMenu(null)
    toast.success(isStarred ? 'Star সরানো হয়েছে' : '⭐ Star করা হয়েছে')
  }

  const handlePin = async (msg) => {
    const isPinned = msg.is_pinned
    await supabase.from('chat_messages').update({ is_pinned: !isPinned }).eq('id', msg.id)
    if (!isPinned) {
      await supabase.from('chat_messages').update({ is_pinned: false }).eq('conversation_id', activeConvId).neq('id', msg.id)
      setPinnedMsg({ ...msg, is_pinned: true })
    } else setPinnedMsg(null)
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: !isPinned } : { ...m, is_pinned: false }))
    setMsgMenu(null)
    toast.success(isPinned ? 'Pin সরানো হয়েছে' : '📌 Pin করা হয়েছে')
  }

  const handleForward = async (targetConvId) => {
    if (!forwardMsg) return
    try {
      await sendMessage({ conversationId: targetConvId, senderId: profile.id, content: forwardMsg.content || forwardMsg.file_name, type: forwardMsg.message_type, fileUrl: forwardMsg.file_url, fileName: forwardMsg.file_name, fileSize: forwardMsg.file_size, forwardedFrom: forwardMsg.id })
      toast.success('Message forward করা হয়েছে!')
    } catch (err) { toast.error(err.message) }
    setShowForwardModal(false); setForwardMsg(null)
  }

  const getSeenStatus = (msg) => {
    if (!msg || msg.sender_id !== profile.id || msg.is_deleted) return null
    const othersSeen = (msg.seen_by || []).filter(id => id !== profile.id)
    if (activeConv?.type === 'p2p') return othersSeen.length > 0 ? '✓✓' : '✓'
    return othersSeen.length > 0 ? `✓✓ ${othersSeen.length}` : '✓'
  }

  const filteredMessages = searchMsg ? messages.filter(m => m.content?.toLowerCase().includes(searchMsg.toLowerCase())) : messages

  const loadHierarchyData = async () => {
    setHierarchyLoading(true)
    try { const users = await getAllUsers(profile.id); setAllUsers(users || []) }
    catch (err) { toast.error(err.message) }
    finally { setHierarchyLoading(false) }
  }

  const handleStartP2P = async (user) => {
    try {
      const convId = await getOrCreateP2P(profile.id, user.id)
      await loadConversations()
      setActiveConvId(convId)
      setNewChatText(''); setNewChatStep('compose'); setSearchUser('')
      if (newChatText.trim()) {
        const msg = await sendMessage({ conversationId: convId, senderId: profile.id, content: newChatText.trim() })
        setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        loadConversations()
      }
    } catch (err) { toast.error(err.message) }
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { toast.error('Group নাম দিন!'); return }
    if (selectedUsers.length < 1) { toast.error('কমপক্ষে ১ জন select করুন!'); return }
    try {
      const convId = await createGroupConversation(groupName, selectedUsers, profile.id)
      await loadConversations(); setActiveConvId(convId)
      setShowNewGroup(false); setGroupName(''); setSelectedUsers([])
    } catch (err) { toast.error(err.message) }
  }

  const handleCreateBroadcast = async () => {
    if (!broadcastName.trim()) { toast.error('Broadcast নাম দিন!'); return }
    try {
      const allIds = allUsers.map(u => u.id)
      const convId = await createBroadcast(broadcastName, profile.id, allIds)
      await loadConversations(); setActiveConvId(convId)
      setShowNewBroadcast(false); setBroadcastName('')
    } catch (err) { toast.error(err.message) }
  }

  const groupReactions = (reactions) => {
    const g = {}
    reactions?.forEach(r => { g[r.emoji] = g[r.emoji] || []; g[r.emoji].push(r.user_id) })
    return g
  }

  const UserList = ({ onSelect, selectedIds = [], multiSelect = false }) => {
    const sl = searchUser.toLowerCase()
    const filtered = sl ? allUsers.filter(u => u.full_name?.toLowerCase().includes(sl) || u.email?.toLowerCase().includes(sl)) : allUsers
    if (filtered.length === 0) return <p className="text-center text-gray-400 text-sm py-4">কোনো user পাওয়া যায়নি</p>
    return (
      <div className="space-y-1">
        {filtered.map(u => (
          <button key={u.id} onClick={() => !selectedIds.includes(u.id) && onSelect(u)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${selectedIds.includes(u.id) ? 'bg-primary-50 opacity-60' : 'hover:bg-gray-50'}`}>
            <Avatar name={u.full_name} size="sm" online={onlineUsers[u.id]?.is_online} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-gray-800 truncate">{u.full_name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
              </div>
              <p className="text-xs text-gray-400 truncate">{u.email}</p>
            </div>
            {multiSelect && selectedIds.includes(u.id) && <span className="text-primary-500">✓</span>}
          </button>
        ))}
      </div>
    )
  }

  const MessageBubble = ({ msg }) => {
    const isMine = msg.sender_id === profile.id
    const reactions = groupReactions(msg.chat_reactions)
    const seenStatus = getSeenStatus(msg)
    const isStarred = (msg.starred_by || []).includes(profile.id)
    const replyMsg = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null

    return (
      <div className={`flex items-end gap-2 mb-1 group ${isMine ? 'flex-row-reverse' : ''}`}>
        {!isMine && <Avatar name={msg.profiles?.full_name} size="sm" online={onlineUsers[msg.sender_id]?.is_online} />}
        <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isMine && activeConv?.type !== 'p2p' && (
            <span className="text-xs text-gray-500 mb-1 px-1">{msg.profiles?.full_name}</span>
          )}
          <div className="relative">
            <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${isMine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'} ${msg.is_deleted ? 'opacity-60 italic' : ''}`}>
              {msg.is_pinned && <p className="text-xs mb-1 opacity-70">📌 Pinned</p>}
              {replyMsg && !msg.is_deleted && (
                <div className={`text-xs px-2 py-1 rounded-lg mb-2 border-l-2 ${isMine ? 'bg-primary-500 border-primary-300' : 'bg-gray-100 border-gray-300'}`}>
                  <p className={`font-semibold ${isMine ? 'text-primary-200' : 'text-gray-500'}`}>{replyMsg.profiles?.full_name || 'You'}</p>
                  <p className={`truncate ${isMine ? 'text-primary-100' : 'text-gray-600'}`}>{replyMsg.content || replyMsg.file_name}</p>
                </div>
              )}
              {msg.forwarded_from && <p className={`text-xs mb-1 italic ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>↗ Forwarded</p>}
              {msg.is_deleted ? <span className="text-sm">🚫 Message মুছে ফেলা হয়েছে</span>
                : msg.message_type === 'image' ? <img src={msg.file_url} alt="img" className="max-w-xs rounded-lg cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')} />
                : msg.message_type === 'voice' ? <div className="flex items-center gap-2"><span>🎤</span><audio controls src={msg.file_url} className="h-8 max-w-[200px]" /></div>
                : msg.message_type === 'file' ? (
                  <a href={msg.file_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 hover:opacity-80 ${isMine ? 'text-white' : 'text-primary-600'}`}>
                    <span className="text-2xl">📎</span>
                    <div><p className="text-sm font-medium truncate max-w-[150px]">{msg.file_name}</p><p className={`text-xs ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>{formatFileSize(msg.file_size)}</p></div>
                  </a>
                ) : <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
              <div className="flex items-center gap-1 justify-end mt-1">
                {isStarred && <span className="text-xs">⭐</span>}
                <p className={`text-xs ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>{formatTime(msg.created_at)}</p>
                {seenStatus && <span className={`text-xs font-bold ${seenStatus.includes('✓✓') ? (isMine ? 'text-primary-200' : 'text-primary-500') : 'text-gray-400'}`}>{seenStatus}</span>}
              </div>
            </div>
            {!msg.is_deleted && (
              <button onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                className={`absolute top-0 ${isMine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition text-lg`}>😊</button>
            )}
            {reactionTarget === msg.id && (
              <div className={`absolute ${isMine ? 'right-0' : 'left-0'} -top-12 bg-white border border-gray-200 rounded-full shadow-lg px-2 py-1 flex gap-1 z-20`}>
                {EMOJIS.map(e => <button key={e} onClick={() => handleReaction(msg.id, e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}
              </div>
            )}
            {msgMenu === msg.id && (
              <div className={`absolute ${isMine ? 'right-0' : 'left-0'} top-8 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1 min-w-[160px]`}>
                {!msg.is_deleted && <>
                  <button onClick={() => { setReplyTo(msg); setMsgMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">↩ Reply</button>
                  <button onClick={() => { setForwardMsg(msg); setShowForwardModal(true); setMsgMenu(null) }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">↗ Forward</button>
                  <button onClick={() => handleStar(msg)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{isStarred ? '★ Unstar' : '⭐ Star'}</button>
                  {isAdmin && <button onClick={() => handlePin(msg)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">{msg.is_pinned ? '📌 Unpin' : '📌 Pin'}</button>}
                </>}
                {isMine && !msg.is_deleted && <button onClick={() => handleDelete(msg.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600">🗑 Delete</button>}
              </div>
            )}
          </div>
          {Object.keys(reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMine ? 'justify-end' : ''}`}>
              {Object.entries(reactions).map(([emoji, users]) => (
                <button key={emoji} onClick={() => handleReaction(msg.id, emoji)}
                  className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition ${users.includes(profile.id) ? 'bg-primary-100 border-primary-300' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'}`}>
                  {emoji} <span>{users.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {!msg.is_deleted && (
          <button onClick={() => setMsgMenu(msgMenu === msg.id ? null : msg.id)}
            className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-gray-600 text-base mb-2 px-1">⋮</button>
        )}
      </div>
    )
  }

  return (
    <div className="chat-fullpage flex bg-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 bg-white border-r border-gray-200 shrink-0`}>
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">💬 Chat</h2>
            <div className="flex gap-1">
              <button onClick={() => { setActiveConvId(null); setNewChatStep('compose'); setNewChatText(''); setSearchUser('') }} title="নতুন Chat" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition">✏️</button>
              <button onClick={() => { setShowNewGroup(true); loadHierarchyData() }} title="Group" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition">👥</button>
              {isAdmin && <button onClick={() => { setShowNewBroadcast(true); loadHierarchyData() }} title="Broadcast" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition">📢</button>}
              <button onClick={() => setShowStarred(!showStarred)} className={`p-2 hover:bg-gray-100 rounded-full transition ${showStarred ? 'text-yellow-500' : 'text-gray-600'}`}>⭐</button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {showStarred ? (
            <div className="p-4">
              <p className="text-sm font-bold text-gray-700 mb-3">⭐ Starred Messages</p>
              {messages.filter(m => (m.starred_by || []).includes(profile.id)).length === 0
                ? <p className="text-xs text-gray-400 text-center py-4">কোনো starred message নেই</p>
                : messages.filter(m => (m.starred_by || []).includes(profile.id)).map(m => (
                  <div key={m.id} className="p-2 bg-yellow-50 rounded-lg mb-2 text-sm cursor-pointer hover:bg-yellow-100"
                    onClick={() => { setShowStarred(false); setTimeout(() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300) }}>
                    <p className="text-gray-800 truncate">{m.content || m.file_name}</p>
                    <p className="text-xs text-gray-400">{formatTime(m.created_at)}</p>
                  </div>
                ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-400"><p className="text-4xl mb-2">💬</p><p className="text-sm">কোনো chat নেই।<br />✏️ বাটন দিয়ে শুরু করুন!</p></div>
          ) : conversations.map(conv => {
            const unread = unreadCounts[conv.id] || 0, isActive = activeConvId === conv.id
            const otherId = getConvOtherUserId(conv), isOnline = otherId && onlineUsers[otherId]?.is_online
            return (
              <button key={conv.id} onClick={() => { setActiveConvId(conv.id); setShowSidebar(false); setShowStarred(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${isActive ? 'bg-primary-50 border-r-2 border-primary-600' : ''}`}>
                <div className="relative shrink-0">
                  {conv.type === 'broadcast' ? <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white text-lg">📢</div>
                    : conv.type === 'group' ? <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-lg">👥</div>
                    : <Avatar name={getConvName(conv)} online={isOnline} />}
                  {unread > 0 && !isActive && (
                    <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold shadow">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className={`text-sm truncate ${unread > 0 && !isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{getConvName(conv)}</p>
                    <span className={`text-xs shrink-0 ml-1 ${unread > 0 && !isActive ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}>{formatTime(conv.updated_at)}</span>
                  </div>
                  <p className={`text-xs truncate ${unread > 0 && !isActive ? 'text-primary-500 font-medium' : 'text-gray-500'}`}>{getConvSubtitle(conv)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0`}>
        {!activeConvId ? (
          <div className="flex flex-col flex-1 bg-gray-50">
            {newChatStep === 'compose' && <div className="flex-1 flex items-center justify-center"><div className="text-center text-gray-300"><p className="text-6xl mb-3">💬</p><p className="text-base font-medium">নিচে message লিখুন</p></div></div>}
            {newChatStep === 'select_user' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b bg-white">
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setNewChatStep('compose')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
                    <div><p className="font-semibold text-gray-800 text-sm">কাকে পাঠাবেন?</p><p className="text-xs text-gray-400 truncate max-w-xs">"{newChatText}"</p></div>
                  </div>
                  <input type="text" placeholder="নাম বা email দিয়ে খুঁজুন..." value={searchUser} onChange={e => setSearchUser(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" autoFocus />
                </div>
                <div className="overflow-y-auto flex-1 px-4 py-3">
                  {hierarchyLoading ? <div className="text-center py-10 text-gray-400">⏳ Loading...</div> : <UserList onSelect={handleStartP2P} />}
                </div>
              </div>
            )}
            {newChatStep === 'compose' && (
              <div className="bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea value={newChatText} onChange={e => setNewChatText(e.target.value)} placeholder="নতুন message লিখুন..." rows={1}
                    className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none max-h-32" style={{ minHeight: '44px' }}
                    onKeyDown={async e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!newChatText.trim()) return; setNewChatStep('select_user'); await loadHierarchyData() } }} />
                  <button onClick={async () => { if (!newChatText.trim()) { toast.error('Message লিখুন!'); return }; setNewChatStep('select_user'); await loadHierarchyData() }}
                    className="p-2.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition shrink-0">➤</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
              <button onClick={() => setShowSidebar(true)} className="md:hidden p-1 text-gray-600">←</button>
              {activeConv?.type === 'broadcast' ? <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white">📢</div>
                : activeConv?.type === 'group' ? <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">👥</div>
                : <Avatar name={getConvName(activeConv)} online={onlineUsers[getConvOtherUserId(activeConv)]?.is_online} />}
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{getConvName(activeConv)}</p>
                <p className="text-xs text-gray-500">{getConvSubtitle(activeConv)}</p>
              </div>
              <button onClick={() => setShowSearch(!showSearch)} className={`p-2 hover:bg-gray-100 rounded-full transition ${showSearch ? 'text-primary-600' : 'text-gray-500'}`}>🔍</button>
            </div>
            {showSearch && (
              <div className="bg-white border-b border-gray-100 px-4 py-2">
                <input type="text" value={searchMsg} onChange={e => setSearchMsg(e.target.value)} placeholder="Message search করুন..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" autoFocus />
                {searchMsg && <p className="text-xs text-gray-400 mt-1">{filteredMessages.length} টি result পাওয়া গেছে</p>}
              </div>
            )}
            {pinnedMsg && (
              <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-2 flex items-center gap-2 cursor-pointer"
                onClick={() => document.getElementById(`msg-${pinnedMsg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                <span>📌</span>
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-yellow-700">Pinned Message</p><p className="text-xs text-gray-600 truncate">{pinnedMsg.content || pinnedMsg.file_name}</p></div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)' }}>
              {loading ? <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
                : filteredMessages.length === 0 ? <div className="flex items-center justify-center h-full text-gray-400 text-sm">{searchMsg ? 'কোনো result নেই' : 'এখনো কোনো message নেই। প্রথম message পাঠান! 👋'}</div>
                : filteredMessages.map((msg, i) => {
                  const prevMsg = filteredMessages[i - 1]
                  const showDate = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                  return (
                    <div key={msg.id} id={`msg-${msg.id}`}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <span className="bg-white text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm border border-gray-100">
                            {new Date(msg.created_at).toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <MessageBubble msg={msg} />
                    </div>
                  )
                })}
              <div ref={messagesEndRef} />
            </div>
            {Object.keys(typingUsers).length > 0 && (
              <div className="px-4 py-1"><p className="text-xs text-gray-500 italic">{Object.values(typingUsers).map(u => u.name).join(', ')} লিখছে...</p></div>
            )}
            {replyTo && (
              <div className="bg-primary-50 border-t border-primary-100 px-4 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-primary-600">↩ Reply to {replyTo.profiles?.full_name || 'You'}</p><p className="text-xs text-gray-600 truncate">{replyTo.content || replyTo.file_name}</p></div>
                <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            )}
            {(activeConv?.type !== 'broadcast' || isAdmin) && (
              <div className="bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-end gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-full transition shrink-0">{uploading ? '⏳' : '📎'}</button>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
                  <textarea value={text} onChange={e => { setText(e.target.value); handleTyping() }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Message লিখুন... (Enter = Send, Shift+Enter = নতুন লাইন)"
                    rows={1} className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none max-h-32" style={{ minHeight: '44px' }} />
                  <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                    className={`p-2 rounded-full transition shrink-0 ${recording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-primary-600 hover:bg-primary-50'}`}>🎤</button>
                  <button onClick={handleSend} disabled={!text.trim() || sending} className="p-2.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition disabled:opacity-50 shrink-0">{sending ? '⏳' : '➤'}</button>
                </div>
                {recording && <p className="text-xs text-red-500 text-center mt-1 animate-pulse">🔴 Recording... ছেড়ে দিলে send হবে</p>}
              </div>
            )}
            {activeConv?.type === 'broadcast' && !isAdmin && (
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-center text-sm text-gray-400">📢 এটি একটি Broadcast channel — শুধু Admin message পাঠাতে পারবে</div>
            )}
          </>
        )}
      </div>

      {showNewGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b shrink-0"><h3 className="font-bold text-gray-800">👥 নতুন Group</h3><button onClick={() => { setShowNewGroup(false); setSelectedUsers([]); setGroupName(''); setSearchUser('') }} className="text-gray-400 hover:text-gray-600">✕</button></div>
            <div className="p-4 space-y-3 shrink-0">
              <input type="text" placeholder="Group নাম..." value={groupName} onChange={e => setGroupName(e.target.value)} autoFocus className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="text" placeholder="Member খুঁজুন..." value={searchUser} onChange={e => setSearchUser(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedUsers.map(uid => { const u = allUsers.find(u => u.id === uid); return u ? <span key={uid} className="flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">{u.full_name}<button onClick={() => setSelectedUsers(prev => prev.filter(id => id !== uid))}>✕</button></span> : null })}
                </div>
              )}
            </div>
            <div className="overflow-y-auto flex-1 px-4">{hierarchyLoading ? <div className="text-center py-8 text-gray-400">⏳ Loading...</div> : <UserList onSelect={u => setSelectedUsers(prev => [...prev, u.id])} selectedIds={selectedUsers} multiSelect />}</div>
            <div className="p-4 border-t shrink-0"><button onClick={handleCreateGroup} className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition">Group তৈরি করুন ({selectedUsers.length} জন)</button></div>
          </div>
        </div>
      )}

      {showNewBroadcast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b"><h3 className="font-bold text-gray-800">📢 Broadcast</h3><button onClick={() => setShowNewBroadcast(false)} className="text-gray-400 hover:text-gray-600">✕</button></div>
            <div className="p-4 space-y-3">
              <input type="text" placeholder="Broadcast নাম..." value={broadcastName} onChange={e => setBroadcastName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p className="text-xs text-gray-500">সব active user automatically এই channel এ যোগ হবে।</p>
              <button onClick={handleCreateBroadcast} className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition">Broadcast তৈরি করুন</button>
            </div>
          </div>
        </div>
      )}

      {showForwardModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between p-5 border-b shrink-0"><h3 className="font-bold text-gray-800">↗ কোথায় Forward করবেন?</h3><button onClick={() => { setShowForwardModal(false); setForwardMsg(null) }} className="text-gray-400 hover:text-gray-600">✕</button></div>
            <div className="overflow-y-auto flex-1 p-3">
              {conversations.map(conv => (
                <button key={conv.id} onClick={() => handleForward(conv.id)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition text-left">
                  {conv.type === 'broadcast' ? <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm">📢</div>
                    : conv.type === 'group' ? <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">👥</div>
                    : <Avatar name={getConvName(conv)} size="sm" />}
                  <p className="text-sm font-medium text-gray-800">{getConvName(conv)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reactionTarget && <div className="fixed inset-0 z-10" onClick={() => setReactionTarget(null)} />}
      {msgMenu && <div className="fixed inset-0 z-10" onClick={() => setMsgMenu(null)} />}
    </div>
  )
}