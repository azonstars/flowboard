import { supabase } from './supabase'

// ── Conversations ──────────────────────────────────────────

export const getMyConversations = async (userId) => {
  const { data, error } = await supabase
    .from('chat_participants')
    .select(`
      conversation_id,
      last_read_at,
      chat_conversations (
        id, type, name, avatar, created_by, updated_at,
        chat_participants (
          user_id,
          profiles ( id, full_name, role, branch_code )
        )
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (error) throw error
  return data
}

export const getBroadcastConversations = async () => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, type, name, avatar, created_by, updated_at')
    .eq('type', 'broadcast')
  if (error) throw error
  return data
}

export const getOrCreateP2P = async (myId, otherId) => {
  // existing P2P খুঁজে বের করো
  const { data: mine } = await supabase
    .from('chat_participants')
    .select('conversation_id')
    .eq('user_id', myId)

  const myConvIds = mine?.map(r => r.conversation_id) || []

  if (myConvIds.length > 0) {
    const { data: p2p } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('type', 'p2p')
      .in('id', myConvIds)

    for (const conv of p2p || []) {
      const { data: parts } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('conversation_id', conv.id)

      const ids = parts.map(p => p.user_id).sort()
      if (ids.includes(myId) && ids.includes(otherId) && ids.length === 2) {
        return conv.id
      }
    }
  }

  // নতুন P2P তৈরি করো
  const { data: newConv, error } = await supabase
    .from('chat_conversations')
    .insert({ type: 'p2p', created_by: myId })
    .select('id')
    .single()
  if (error) throw error

  await supabase.from('chat_participants').insert([
    { conversation_id: newConv.id, user_id: myId },
    { conversation_id: newConv.id, user_id: otherId },
  ])

  return newConv.id
}

export const createGroupConversation = async (name, memberIds, createdBy) => {
  const { data: conv, error } = await supabase
    .from('chat_conversations')
    .insert({ type: 'group', name, created_by: createdBy })
    .select('id')
    .single()
  if (error) throw error

  const participants = [...new Set([createdBy, ...memberIds])].map(uid => ({
    conversation_id: conv.id,
    user_id: uid,
  }))
  await supabase.from('chat_participants').insert(participants)
  return conv.id
}

export const createBroadcast = async (name, createdBy, allUserIds) => {
  const { data: conv, error } = await supabase
    .from('chat_conversations')
    .insert({ type: 'broadcast', name, created_by: createdBy })
    .select('id')
    .single()
  if (error) throw error

  const participants = allUserIds.map(uid => ({
    conversation_id: conv.id,
    user_id: uid,
  }))
  await supabase.from('chat_participants').insert(participants)
  return conv.id
}

// ── Messages ───────────────────────────────────────────────

export const getMessages = async (conversationId, limit = 50, before = null) => {
  let query = supabase
    .from('chat_messages')
    .select(`
      id, conversation_id, sender_id, message_type, content,
      file_url, file_name, file_size, is_deleted, created_at,
      profiles ( id, full_name, role ),
      chat_reactions ( id, emoji, user_id )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw error
  return data.reverse()
}

export const sendMessage = async ({ conversationId, senderId, type = 'text', content, fileUrl, fileName, fileSize, replyToId = null, forwardedFrom = null }) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: type,
      content,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_size: fileSize || null,
      reply_to: replyToId || null,
      forwarded_from: forwardedFrom || null,
      seen_by: [senderId],
      starred_by: [],
    })
    .select(`
      id, conversation_id, sender_id, message_type, content,
      file_url, file_name, file_size, is_deleted, created_at,
      profiles ( id, full_name, role ),
      chat_reactions ( id, emoji, user_id )
    `)
    .single()
  if (error) throw error

  // updated_at refresh
  await supabase
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data
}

export const deleteMessage = async (messageId) => {
  const { error } = await supabase
    .from('chat_messages')
    .update({ is_deleted: true, content: null, file_url: null })
    .eq('id', messageId)
  if (error) throw error
}

// ── File Upload ────────────────────────────────────────────

export const uploadChatFile = async (file, senderId) => {
  const ext = file.name.split('.').pop()
  const path = `${senderId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('chat-files')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error

  const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path)
  return urlData.publicUrl
}

// ── Reactions ──────────────────────────────────────────────

export const toggleReaction = async (messageId, userId, emoji) => {
  const { data: existing } = await supabase
    .from('chat_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .single()

  if (existing) {
    if (existing.emoji === emoji) {
      await supabase.from('chat_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('chat_reactions').update({ emoji }).eq('id', existing.id)
    }
  } else {
    await supabase.from('chat_reactions').insert({ message_id: messageId, user_id: userId, emoji })
  }
}

// ── Read Status ────────────────────────────────────────────

export const markAsRead = async (conversationId, userId) => {
  await supabase
    .from('chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export const getUnreadCount = async (conversationId, userId, lastReadAt) => {
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact' })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .gt('created_at', lastReadAt)
  return count || 0
}

// ── All Users (for new chat) ───────────────────────────────

export const getAllUsers = async (excludeId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, email, branch_code, division_id, region_id')
    .eq('is_active', true)
    .neq('id', excludeId)
    .order('full_name')
  if (error) throw error
  return data || []
}

// ── Realtime subscription ──────────────────────────────────

export const subscribeToMessages = (conversationId, callback) => {
  return supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, callback)
    .subscribe()
}

export const subscribeToConversations = (userId, callback) => {
  return supabase
    .channel(`conv_updates`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'chat_conversations',
    }, callback)
    .subscribe()
}