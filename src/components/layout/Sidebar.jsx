import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'

export default function Sidebar({ isOpen, onClose }) {
  const { profile, allMenuItems } = useAuth()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState({})
  const [chatUnread, setChatUnread] = useState(0)

  const filteredItems = allMenuItems.filter(item => {
    if (!item.roles || item.roles.length === 0) return true
    return item.roles.includes(profile?.role)
  })

  const isActive = (path) => path && path !== '#' && location.pathname.startsWith(path)
  const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))

  const filteredChildren = (children) => {
    if (!children || children.length === 0) return []
    return children.filter(child => {
      if (!child.roles || child.roles.length === 0) return true
      return child.roles.includes(profile?.role)
    })
  }

  const hasChildren = (item) => filteredChildren(item.children).length > 0

  // Chat unread count
  useEffect(() => {
    if (!profile?.id) return
    const load = async () => {
      try {
        const { data: parts } = await supabase
          .from('chat_participants')
          .select('conversation_id, last_read_at')
          .eq('user_id', profile.id)
        if (!parts?.length) return
        let total = 0
        for (const p of parts) {
          let q = supabase.from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', p.conversation_id)
            .neq('sender_id', profile.id)
            .eq('is_deleted', false)
          if (p.last_read_at) q = q.gt('created_at', p.last_read_at)
          const { count } = await q
          total += count || 0
        }
        setChatUnread(total)
      } catch (e) {}
    }
    load()
    // /chat page-এ গেলে reset
    if (location.pathname === '/chat') setChatUnread(0)

    const sub = supabase.channel('sidebar_chat_unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => { if (location.pathname !== '/chat') load() }
      ).subscribe()
    return () => sub.unsubscribe()
  }, [profile?.id, location.pathname])

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={onClose} />
      )}

      <div className={`
        fixed top-0 left-0 h-full w-64 bg-blue-900 text-white z-30
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:shrink-0
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-blue-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">FlowBoard</h1>
            <p className="text-blue-300 text-xs mt-0.5">
              {profile?.role?.replace(/_/g, ' ').toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="lg:hidden text-blue-300 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 overflow-y-auto" style={{ height: 'calc(100% - 130px)' }}>
          {filteredItems.map((item) => {
            const children = filteredChildren(item.children)
            const isExpanded = expandedItems[item.id]
            const isParentActive = isActive(item.path) || children.some(c => isActive(c.path))
            const isChatItem = item.path === '/chat'

            return (
              <div key={item.id}>
                <div className={`flex items-center rounded-lg transition ${
                  isParentActive ? 'bg-white text-blue-900' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`}>
                  {hasChildren(item) || item.path === '#' ? (
                    <button onClick={() => toggleExpand(item.id)}
                      className="flex items-center gap-3 px-3 py-2.5 flex-1 text-left w-full">
                      <span className="text-lg shrink-0">{item.icon || '📋'}</span>
                      <span className={`font-medium flex-1 text-sm ${isParentActive ? 'font-semibold' : ''}`}>{item.label}</span>
                      {hasChildren(item) && (
                        <svg className={`w-4 h-4 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <Link to={item.path} onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 flex-1">
                      <span className="text-lg shrink-0">{item.icon || '📋'}</span>
                      <span className={`font-medium text-sm flex-1 ${isParentActive ? 'font-semibold' : ''}`}>{item.label}</span>
                      {isChatItem && chatUnread > 0 && (
                        <span className="ml-auto min-w-[20px] h-5 bg-blue-400 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}
                    </Link>
                  )}
                </div>

                {hasChildren(item) && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-blue-700 pl-3">
                    {children.map(child => (
                      <Link key={child.id} to={child.path || '#'} onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm ${
                          isActive(child.path)
                            ? 'bg-white text-blue-900 font-semibold'
                            : 'text-blue-300 hover:bg-blue-800 hover:text-white'
                        }`}>
                        <span className="text-base shrink-0">{child.icon || '📌'}</span>
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-700 bg-blue-900">
          <p className="text-blue-200 text-sm font-medium truncate">{profile?.full_name}</p>
          <p className="text-blue-400 text-xs truncate">{profile?.branch_code || profile?.email}</p>
        </div>
      </div>
    </>
  )
}