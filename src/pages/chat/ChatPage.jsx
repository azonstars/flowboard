import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../constants/roles'
import {
  getMyConversations, getBroadcastConversations,
  getOrCreateP2P, createGroupConversation, createBroadcast,
  getMessages, sendMessage, deleteMessage,
  uploadChatFile, toggleReaction, markAsRead, getAllUsers,
  subscribeToMessages, subscribeToConversations,
} from '../../services/chatService'
import { getDivisions, getRegions, getBranches } from '../../services/branchService'
import toast from 'react-hot-toast'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  central_checker: 'bg-blue-100 text-blue-700',
  divisional_checker: 'bg-cyan-100 text-cyan-700',
  regional_checker: 'bg-teal-100 text-teal-700',
  branch_manager: 'bg-green-100 text-green-700',
  branch_employee: 'bg-gray-100 text-gray-600',
}

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const Avatar = ({ name, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-base'
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-teal-500']
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {name?.charAt(0)?.toUpperCase() || '?'}
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
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatStep, setNewChatStep] = useState('compose') // 'compose' | 'select_user'
  const [newChatText, setNewChatText] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showNewBroadcast, setShowNewBroadcast] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [divisions, setDivisions] = useState([])
  const [regions, setRegions] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [groupName, setGroupName] = useState('')
  const [broadcastName, setBroadcastName] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [reactionTarget, setReactionTarget] = useState(null)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [showSidebar, setShowSidebar] = useState(true)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const subscriptionRef = useRef(null)
  const audioChunksRef = useRef([])

  const isAdmin = profile?.role === 'admin'
  const [unreadCounts, setUnreadCounts] = useState({})

  const loadConversations = useCallback(async () => {
    if (!profile?.id) return
    try {
      const [mine, broadcasts] = await Promise.all([
        getMyConversations(profile.id),
        getBroadcastConversations(),
      ])
      const myConvs = mine.map(p => ({
        ...p.chat_conversations,
        last_read_at: p.last_read_at,
        participants: p.chat_conversations.chat_participants,
      }))
      const broadcastConvs = broadcasts.filter(b => !myConvs.find(c => c.id === b.id))
      const allConvs = [...myConvs, ...broadcastConvs]
      setConversations(allConvs)

      // unread count calculate
      const { supabase } = await import('../../services/supabase')
      const counts = {}
      await Promise.all(allConvs.map(async (conv) => {
        const lastRead = conv.last_read_at
        if (!lastRead) { counts[conv.id] = 99; return }
        const { count } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact' })
          .eq('conversation_id', conv.id)
          .neq('sender_id', profile.id)
          .gt('created_at', lastRead)
        counts[conv.id] = count || 0
      }))
      setUnreadCounts(counts)
    } catch (err) {
      console.error(err)
    }
  }, [profile?.id])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Load messages ──
  useEffect(() => {
    if (!activeConvId) return
    const conv = conversations.find(c => c.id === activeConvId)
    setActiveConv(conv)
    loadMessages(activeConvId)
    markAsRead(activeConvId, profile.id)

    // Realtime subscribe
    if (subscriptionRef.current) subscriptionRef.current.unsubscribe()
    subscriptionRef.current = subscribeToMessages(activeConvId, (payload) => {
      fetchNewMessage(payload.new)
    })
    return () => { if (subscriptionRef.current) subscriptionRef.current.unsubscribe() }
  }, [activeConvId])

  const loadMessages = async (convId) => {
    setLoading(true)
    try {
      const data = await getMessages(convId)
      setMessages(data)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchNewMessage = async (newMsg) => {
    const { data } = await import('../../../src/services/supabase').then(m =>
      m.supabase.from('chat_messages')
        .select(`id, conversation_id, sender_id, message_type, content, file_url, file_name, file_size, is_deleted, created_at, profiles(id, full_name, role), chat_reactions(id, emoji, user_id)`)
        .eq('id', newMsg.id)
        .single()
    )
    if (data) {
      setMessages(prev => [...prev.filter(m => m.id !== data.id), data])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      markAsRead(newMsg.conversation_id, profile.id)
    }
    loadConversations()
  }

  // ── Get conversation display name ──
  const getConvName = (conv) => {
    if (!conv) return ''
    if (conv.type === 'group' || conv.type === 'broadcast') return conv.name || 'Unnamed'
    const other = conv.participants?.find(p => p.user_id !== profile.id)
    return other?.profiles?.full_name || 'Unknown'
  }

  const getConvSubtitle = (conv) => {
    if (!conv) return ''
    if (conv.type === 'broadcast') return '📢 Broadcast'
    if (conv.type === 'group') return `👥 ${conv.participants?.length || 0} জন`
    const other = conv.participants?.find(p => p.user_id !== profile.id)
    return ROLE_LABELS[other?.profiles?.role] || ''
  }

  // ── Send text ──
  const handleSend = async () => {
    if (!text.trim() || !activeConvId) return
    setSending(true)
    const tempText = text
    setText('')
    try {
      const msg = await sendMessage({ conversationId: activeConvId, senderId: profile.id, content: tempText })
      setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      loadConversations()
    } catch (err) {
      toast.error(err.message)
      setText(tempText)
    } finally {
      setSending(false)
    }
  }

  // ── Send file ──
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('ফাইল ১০MB এর বেশি হবে না!'); return }
    setUploading(true)
    try {
      const url = await uploadChatFile(file, profile.id)
      const isImage = file.type.startsWith('image/')
      const msg = await sendMessage({
        conversationId: activeConvId,
        senderId: profile.id,
        type: isImage ? 'image' : 'file',
        content: file.name,
        fileUrl: url,
        fileName: file.name,
        fileSize: file.size,
      })
      setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      loadConversations()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        setUploading(true)
        try {
          const url = await uploadChatFile(file, profile.id)
          const msg = await sendMessage({
            conversationId: activeConvId, senderId: profile.id,
            type: 'voice', content: 'Voice message', fileUrl: url,
            fileName: file.name, fileSize: file.size,
          })
          setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          loadConversations()
        } catch (err) { toast.error(err.message) }
        finally { setUploading(false) }
      }
      mr.start()
      setMediaRecorder(mr)
      setRecording(true)
    } catch { toast.error('Microphone access দিন!') }
  }

  const stopRecording = () => {
    mediaRecorder?.stop()
    setRecording(false)
    setMediaRecorder(null)
  }

  // ── Reaction ──
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
        } else {
          reactions = [...reactions, { id: Date.now(), message_id: messageId, user_id: profile.id, emoji }]
        }
        return { ...m, chat_reactions: reactions }
      }))
    } catch (err) { toast.error(err.message) }
    setReactionTarget(null)
  }

  // ── Delete message ──
  const handleDelete = async (msgId) => {
    if (!confirm('Message মুছে ফেলবেন?')) return
    try {
      await deleteMessage(msgId)
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, content: null } : m))
    } catch (err) { toast.error(err.message) }
  }

  // ── New P2P ──
  const handleStartP2P = async (user) => {
    try {
      const convId = await getOrCreateP2P(profile.id, user.id)
      await loadConversations()
      setActiveConvId(convId)
      setShowNewChat(false)
      setNewChatText('')
      setNewChatStep('compose')
      setSearchUser('')
      // compose করা message পাঠাও
      if (newChatText.trim()) {
        const msg = await sendMessage({ conversationId: convId, senderId: profile.id, content: newChatText.trim() })
        setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        loadConversations()
      }
    } catch (err) { toast.error(err.message) }
  }

  // ── New Group ──
  const handleCreateGroup = async () => {
    if (!groupName.trim()) { toast.error('Group নাম দিন!'); return }
    if (selectedUsers.length < 1) { toast.error('কমপক্ষে ১ জন select করুন!'); return }
    try {
      const convId = await createGroupConversation(groupName, selectedUsers, profile.id)
      await loadConversations()
      setActiveConvId(convId)
      setShowNewGroup(false)
      setGroupName('')
      setSelectedUsers([])
    } catch (err) { toast.error(err.message) }
  }

  // ── New Broadcast ──
  const handleCreateBroadcast = async () => {
    if (!broadcastName.trim()) { toast.error('Broadcast নাম দিন!'); return }
    try {
      const allIds = allUsers.map(u => u.id)
      const convId = await createBroadcast(broadcastName, profile.id, allIds)
      await loadConversations()
      setActiveConvId(convId)
      setShowNewBroadcast(false)
      setBroadcastName('')
    } catch (err) { toast.error(err.message) }
  }

  const loadHierarchyData = async () => {
    try {
      const [users, divs, regs, brs] = await Promise.all([
        getAllUsers(profile.id),
        getDivisions(),
        getRegions(),
        getBranches(),
      ])
      setAllUsers(users || [])
      setDivisions(divs || [])
      setRegions(regs || [])
      setBranches(brs || [])
    } catch (err) {
      console.error('loadHierarchyData error:', err)
      toast.error('User list load হয়নি: ' + err.message)
      // fallback: শুধু users load করো
      try {
        const users = await getAllUsers(profile.id)
        setAllUsers(users || [])
      } catch (e) { console.error(e) }
    }
  }

  const openNewChat = async () => {
    setNewChatStep('compose')
    setNewChatText('')
    setSearchUser('')
    setShowNewChat(true)
  }

  const openNewGroup = async () => {
    setShowNewGroup(true)
    await loadHierarchyData()
  }

  // ── Grouped reactions ──
  const groupReactions = (reactions) => {
    const grouped = {}
    reactions?.forEach(r => {
      grouped[r.emoji] = (grouped[r.emoji] || [])
      grouped[r.emoji].push(r.user_id)
    })
    return grouped
  }

  // ── Render message bubble ──
  const MessageBubble = ({ msg }) => {
    const isMine = msg.sender_id === profile.id
    const reactions = groupReactions(msg.chat_reactions)
    const hasReactions = Object.keys(reactions).length > 0

    return (
      <div className={`flex items-end gap-2 mb-1 group ${isMine ? 'flex-row-reverse' : ''}`}>
        {!isMine && <Avatar name={msg.profiles?.full_name} size="sm" />}
        <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isMine && activeConv?.type !== 'p2p' && (
            <span className="text-xs text-gray-500 mb-1 px-1">{msg.profiles?.full_name}</span>
          )}
          <div className="relative">
            <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
              isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
            } ${msg.is_deleted ? 'opacity-60 italic' : ''}`}>
              {msg.is_deleted ? (
                <span className="text-sm">🚫 Message মুছে ফেলা হয়েছে</span>
              ) : msg.message_type === 'image' ? (
                <img src={msg.file_url} alt="img" className="max-w-xs rounded-lg cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')} />
              ) : msg.message_type === 'voice' ? (
                <div className="flex items-center gap-2">
                  <span>🎤</span>
                  <audio controls src={msg.file_url} className="h-8 max-w-[200px]" />
                </div>
              ) : msg.message_type === 'file' ? (
                <a href={msg.file_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 hover:opacity-80 ${isMine ? 'text-white' : 'text-blue-600'}`}>
                  <span className="text-2xl">📎</span>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[150px]">{msg.file_name}</p>
                    <p className={`text-xs ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>{formatFileSize(msg.file_size)}</p>
                  </div>
                </a>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              )}
              <p className={`text-xs mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'} text-right`}>{formatTime(msg.created_at)}</p>
            </div>

            {/* Reaction picker trigger */}
            {!msg.is_deleted && (
              <button
                onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                className={`absolute top-0 ${isMine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition text-lg`}
              >😊</button>
            )}

            {/* Reaction picker */}
            {reactionTarget === msg.id && (
              <div className={`absolute ${isMine ? 'right-0' : 'left-0'} -top-12 bg-white border border-gray-200 rounded-full shadow-lg px-2 py-1 flex gap-1 z-10`}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => handleReaction(msg.id, e)} className="text-xl hover:scale-125 transition-transform">{e}</button>
                ))}
              </div>
            )}
          </div>

          {/* Reactions display */}
          {hasReactions && (
            <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMine ? 'justify-end' : ''}`}>
              {Object.entries(reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(msg.id, emoji)}
                  className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition ${
                    users.includes(profile.id) ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {emoji} <span>{users.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete own message */}
        {isMine && !msg.is_deleted && (
          <button onClick={() => handleDelete(msg.id)} className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-500 text-xs mb-2">🗑</button>
        )}
      </div>
    )
  }

  // ── Hierarchy User List ──
  const HierarchyUserList = ({ onSelectUser, selectedIds = [], multiSelect = false }) => {
    const searchLower = searchUser.toLowerCase()

    if (searchLower) {
      const filtered = allUsers.filter(u =>
        u.full_name?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        ROLE_LABELS[u.role]?.toLowerCase().includes(searchLower)
      )
      return (
        <div className="space-y-1">
          {filtered.map(user => (
            <UserRow key={user.id} user={user} onSelect={onSelectUser} selected={selectedIds.includes(user.id)} multiSelect={multiSelect} />
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-4">কোনো user পাওয়া যায়নি</p>}
        </div>
      )
    }

    const topUsers = allUsers.filter(u => u.role === 'admin' || u.role === 'central_checker')

    return (
      <div className="space-y-2">
        {topUsers.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-2 py-1">Admin / Central</p>
            {topUsers.map(user => (
              <UserRow key={user.id} user={user} onSelect={onSelectUser} selected={selectedIds.includes(user.id)} multiSelect={multiSelect} />
            ))}
          </div>
        )}

        {divisions.map(div => {
          const divRegions = regions.filter(r => r.division_id === div.id)
          const divCheckers = allUsers.filter(u => u.role === 'divisional_checker' && u.division_id === div.id)
          if (divCheckers.length === 0 && divRegions.length === 0) return null

          return (
            <div key={div.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-blue-50 px-3 py-2 flex items-center gap-2">
                <span className="text-blue-600">🏛️</span>
                <span className="text-sm font-bold text-blue-700">{div.name}</span>
              </div>
              <div className="px-2 py-1">
                {divCheckers.map(user => (
                  <UserRow key={user.id} user={user} onSelect={onSelectUser} selected={selectedIds.includes(user.id)} multiSelect={multiSelect} indent={1} />
                ))}
                {divRegions.map(reg => {
                  const regBranches = branches.filter(b => b.region_id === reg.id)
                  const regCheckers = allUsers.filter(u => u.role === 'regional_checker' && u.region_id === reg.id)
                  if (regCheckers.length === 0 && regBranches.length === 0) return null

                  return (
                    <div key={reg.id} className="mt-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-green-50 rounded-lg mb-1">
                        <span className="text-green-600 text-xs">📍</span>
                        <span className="text-xs font-bold text-green-700">{reg.name}</span>
                      </div>
                      {regCheckers.map(user => (
                        <UserRow key={user.id} user={user} onSelect={onSelectUser} selected={selectedIds.includes(user.id)} multiSelect={multiSelect} indent={2} />
                      ))}
                      {regBranches.map(branch => {
                        const branchUsers = allUsers.filter(u =>
                          u.branch_code === branch.branch_code &&
                          (u.role === 'branch_manager' || u.role === 'branch_employee')
                        )
                        if (branchUsers.length === 0) return null
                        return (
                          <div key={branch.branch_code} className="ml-3 mb-1">
                            <div className="flex items-center gap-1 px-2 py-1">
                              <span className="text-gray-400 text-xs">🏢</span>
                              <span className="text-xs font-semibold text-gray-500">{branch.name} ({branch.branch_code})</span>
                            </div>
                            {branchUsers.map(user => (
                              <UserRow key={user.id} user={user} onSelect={onSelectUser} selected={selectedIds.includes(user.id)} multiSelect={multiSelect} indent={3} />
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const UserRow = ({ user, onSelect, selected, multiSelect, indent = 0 }) => (
    <button
      onClick={() => !selected && onSelect(user)}
      disabled={multiSelect && selected}
      className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition text-left ${
        selected ? 'bg-blue-50 opacity-60 cursor-default' : 'hover:bg-gray-50'
      }`}
      style={{ paddingLeft: `${(indent * 10) + 12}px`, paddingRight: '12px' }}
    >
      <Avatar name={user.full_name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-gray-800 truncate">{user.full_name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[user.role]}`}>{ROLE_LABELS[user.role]}</span>
        </div>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
      </div>
      {multiSelect && selected && <span className="text-blue-500 shrink-0">✓</span>}
    </button>
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100 rounded-xl overflow-hidden shadow-sm">

      {/* ── Sidebar ── */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 bg-white border-r border-gray-200 shrink-0`}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">💬 Chat</h2>
            <div className="flex gap-1">
              <button onClick={() => { setActiveConvId(null); setNewChatStep('compose'); setNewChatText(''); setSearchUser('') }} title="নতুন Chat" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition">✏️</button>
              <button onClick={openNewGroup} title="নতুন Group" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition">👥</button>
              {isAdmin && (
                <button onClick={() => { setShowNewBroadcast(true); openNewChat() }} title="Broadcast" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition">📢</button>
              )}
            </div>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-sm">কোনো chat নেই।<br />✏️ বাটন দিয়ে শুরু করুন!</p>
            </div>
          ) : conversations.map(conv => {
            const unread = unreadCounts[conv.id] || 0
            const isActive = activeConvId === conv.id
            return (
            <button
              key={conv.id}
              onClick={() => { setActiveConvId(conv.id); setShowSidebar(false) }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${isActive ? 'bg-blue-50 border-r-2 border-blue-600' : ''}`}
            >
              <div className="relative shrink-0">
                {conv.type === 'broadcast' ? (
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white text-lg">📢</div>
                ) : conv.type === 'group' ? (
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-lg">👥</div>
                ) : (
                  <Avatar name={getConvName(conv)} />
                )}
                {unread > 0 && !isActive && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold shadow">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className={`text-sm truncate ${unread > 0 && !isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                    {getConvName(conv)}
                  </p>
                  <span className={`text-xs shrink-0 ml-1 ${unread > 0 && !isActive ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                    {formatTime(conv.updated_at)}
                  </span>
                </div>
                <p className={`text-xs truncate ${unread > 0 && !isActive ? 'text-blue-500 font-medium' : 'text-gray-500'}`}>
                  {getConvSubtitle(conv)}
                </p>
              </div>
            </button>
            )
          })}
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0`}>
        {!activeConvId ? (
          <div className="flex flex-col flex-1 bg-gray-50">
            {/* Top area */}
            {newChatStep === 'compose' && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-300">
                  <p className="text-6xl mb-3">💬</p>
                  <p className="text-base font-medium">নিচে message লিখুন</p>
                </div>
              </div>
            )}

            {/* User select step */}
            {newChatStep === 'select_user' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b bg-white">
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setNewChatStep('compose')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">কাকে পাঠাবেন?</p>
                      <p className="text-xs text-gray-400 truncate max-w-xs">"{newChatText}"</p>
                    </div>
                  </div>
                  <input
                    type="text" placeholder="নাম, email বা role দিয়ে খুঁজুন..."
                    value={searchUser} onChange={e => setSearchUser(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto flex-1 px-4 py-3">
                  {allUsers.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">Loading...</div>
                  ) : (
                    <HierarchyUserList onSelectUser={handleStartP2P} />
                  )}
                </div>
              </div>
            )}

            {/* Bottom compose bar */}
            {newChatStep === 'compose' && (
              <div className="bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={newChatText}
                    onChange={e => setNewChatText(e.target.value)}
                    placeholder="নতুন message লিখুন..."
                    rows={1}
                    className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 overflow-y-auto"
                    style={{ minHeight: '44px' }}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (!newChatText.trim()) return
                        setNewChatStep('select_user')
                        await loadHierarchyData()
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!newChatText.trim()) { toast.error('Message লিখুন!'); return }
                      setNewChatStep('select_user')
                      await loadHierarchyData()
                    }}
                    className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shrink-0"
                  >➤</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
              <button onClick={() => setShowSidebar(true)} className="md:hidden p-1 text-gray-600">←</button>
              {activeConv?.type === 'broadcast' ? (
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white">📢</div>
              ) : activeConv?.type === 'group' ? (
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">👥</div>
              ) : (
                <Avatar name={getConvName(activeConv)} />
              )}
              <div>
                <p className="font-semibold text-gray-800">{getConvName(activeConv)}</p>
                <p className="text-xs text-gray-500">{getConvSubtitle(activeConv)}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">এখনো কোনো message নেই। প্রথম message পাঠান! 👋</div>
              ) : messages.map((msg, i) => {
                const prevMsg = messages[i - 1]
                const showDate = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                return (
                  <div key={msg.id}>
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

            {/* Input area */}
            {(activeConv?.type !== 'broadcast' || isAdmin) && (
              <div className="bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-end gap-2">
                  {/* File attach */}
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition shrink-0">
                    {uploading ? '⏳' : '📎'}
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />

                  {/* Text input */}
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Message লিখুন... (Enter = Send, Shift+Enter = নতুন লাইন)"
                    rows={1}
                    className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 overflow-y-auto"
                    style={{ minHeight: '44px' }}
                  />

                  {/* Voice */}
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`p-2 rounded-full transition shrink-0 ${recording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
                    title="Hold to record voice"
                  >
                    🎤
                  </button>

                  {/* Send */}
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 shrink-0"
                  >
                    {sending ? '⏳' : '➤'}
                  </button>
                </div>
                {recording && (
                  <p className="text-xs text-red-500 text-center mt-1 animate-pulse">🔴 Recording... ছেড়ে দিলে send হবে</p>
                )}
              </div>
            )}
            {activeConv?.type === 'broadcast' && !isAdmin && (
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-center text-sm text-gray-400">
                📢 এটি একটি Broadcast channel — শুধু Admin message পাঠাতে পারবে
              </div>
            )}
          </>
        )}
      </div>


      {showNewGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <h3 className="font-bold text-gray-800">নতুন Group তৈরি করুন</h3>
              <button onClick={() => { setShowNewGroup(false); setSelectedUsers([]); setGroupName(''); setSearchUser('') }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3 shrink-0">
              <input type="text" placeholder="Group নাম..." value={groupName} onChange={e => setGroupName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
              <input type="text" placeholder="নাম, email বা role দিয়ে Member খুঁজুন..." value={searchUser} onChange={e => setSearchUser(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedUsers.map(uid => {
                    const u = allUsers.find(u => u.id === uid)
                    return u ? (
                      <span key={uid} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {u.full_name}
                        <button onClick={() => setSelectedUsers(prev => prev.filter(id => id !== uid))}>✕</button>
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
            <div className="overflow-y-auto flex-1 px-4">
              {allUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : (
                <HierarchyUserList
                  onSelectUser={(user) => setSelectedUsers(prev => [...prev, user.id])}
                  selectedIds={selectedUsers}
                  multiSelect
                />
              )}
            </div>
            <div className="p-4 border-t shrink-0">
              <button onClick={handleCreateGroup} className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                Group তৈরি করুন ({selectedUsers.length} জন selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast Modal ── */}
      {showNewBroadcast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-gray-800">📢 Broadcast তৈরি করুন</h3>
              <button onClick={() => setShowNewBroadcast(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <input type="text" placeholder="Broadcast নাম (যেমন: সকলের জন্য ঘোষণা)" value={broadcastName}
                onChange={e => setBroadcastName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-500">সব active user automatically এই channel এ যোগ হবে।</p>
              <button onClick={handleCreateBroadcast} className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
                Broadcast তৈরি করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close reaction picker */}
      {reactionTarget && <div className="fixed inset-0 z-0" onClick={() => setReactionTarget(null)} />}
    </div>
  )
}