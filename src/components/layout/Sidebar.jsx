import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { ROLES } from '../../constants/roles'
import { useTheme } from '../../context/ThemeContext'

const CONTROL_PANEL = {
  id: '__control_panel__',
  label: 'Control Panel',
  icon: '⚙️',
  path: '#',
  roles: [ROLES.ADMIN],
  children: [
    { id: '__cp_settings__',     label: 'App Settings',   icon: '🔧', path: '/settings',      roles: [ROLES.ADMIN] },
    { id: '__cp_users__',        label: 'Users',          icon: '👥', path: '/users',          roles: [ROLES.ADMIN] },
    { id: '__cp_branches__',     label: 'Branches',       icon: '🏢', path: '/branches',       roles: [ROLES.ADMIN] },
    { id: '__cp_permissions__',  label: 'Permissions',    icon: '🔒', path: '/permissions',    roles: [ROLES.ADMIN, ROLES.REGIONAL_CHECKER] },
    { id: '__cp_excel__',        label: 'Excel Import',   icon: '📥', path: '/excel-import',   roles: [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER] },
  ],
}

export default function Sidebar({ isOpen, onClose }) {
  const { profile, allMenuItems } = useAuth()
  const { globalTheme } = useTheme()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState({})
  const [chatUnread, setChatUnread] = useState(0)

  const CONTROL_PANEL_PATHS = ['/users', '/branches', '/permissions', '/settings']
  const filteredItems = allMenuItems.filter(item => {
    if (CONTROL_PANEL_PATHS.includes(item.path)) return false
    if (!item.roles || item.roles.length === 0) return true
    return item.roles.includes(profile?.role)
  })

  const showControlPanel = [ROLES.ADMIN, ROLES.REGIONAL_CHECKER].includes(profile?.role)
  const controlPanelChildren = CONTROL_PANEL.children.filter(c => c.roles.includes(profile?.role))

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
    if (location.pathname === '/chat') setChatUnread(0)
    const sub = supabase.channel('sidebar_chat_unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => { if (location.pathname !== '/chat') load() }
      ).subscribe()
    return () => sub.unsubscribe()
  }, [profile?.id, location.pathname])

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={onClose} />
      )}
      <div className={`
        fixed top-0 left-0 h-full w-64 z-30 sidebar-dynamic
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:shrink-0
      `}>
        {/* Logo */}
        <div className="p-5 flex items-center justify-between" style={{borderBottom: '1px solid var(--sidebar-border-color, rgba(0,0,0,0.08))'}}>
          <div>
            {globalTheme.app_logo_url ? (
              <img src={globalTheme.app_logo_url} alt="logo" className="h-8 object-contain" />
            ) : (
              <h1 className="text-xl font-bold" style={{color: "var(--sidebar-text, rgba(26,26,26,0.75))"}}>{globalTheme.app_name || 'FlowBoard'}</h1>
            )}
            <p className="text-xs mt-0.5" style={{color: "var(--sidebar-text, rgba(26,26,26,0.75))"}}>
              {profile?.role?.replace(/_/g, ' ').toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1" style={{color: "var(--sidebar-text, rgba(26,26,26,0.75))"}}>
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
                <div className={`flex items-center rounded-lg transition ${isParentActive ? 'sidebar-active-item' : 'sidebar-normal-item'}`}>
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
                        <span className="ml-auto min-w-[20px] h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
                {hasChildren(item) && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 pl-3" style={{borderColor: 'var(--sidebar-border-color)'}}>
                    {children.map(child => (
                      <Link key={child.id} to={child.path || '#'} onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm ${
                          isActive(child.path) ? 'sidebar-active-item font-semibold' : 'sidebar-normal-item'
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

          {/* Control Panel */}
          {showControlPanel && (
            <div>
              <div className={`flex items-center rounded-lg transition ${
                controlPanelChildren.some(c => isActive(c.path)) ? 'sidebar-active-item' : 'sidebar-normal-item'
              }`}>
                <button onClick={() => toggleExpand(CONTROL_PANEL.id)}
                  className="flex items-center gap-3 px-3 py-2.5 flex-1 text-left w-full">
                  <span className="text-lg shrink-0">{CONTROL_PANEL.icon}</span>
                  <span className="font-medium flex-1 text-sm">Control Panel</span>
                  <svg className={`w-4 h-4 transition-transform duration-200 shrink-0 ${expandedItems[CONTROL_PANEL.id] ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedItems[CONTROL_PANEL.id] && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 pl-3" style={{borderColor: 'var(--sidebar-border-color)'}}>
                  {controlPanelChildren.map(child => (
                    <Link key={child.id} to={child.path} onClick={onClose}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm ${
                        isActive(child.path) ? 'sidebar-active-item font-semibold' : 'sidebar-normal-item'
                      }`}>
                      <span className="text-base shrink-0">{child.icon}</span>
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Bottom User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sidebar-dynamic" style={{borderTop: '1px solid var(--sidebar-border-color, rgba(0,0,0,0.08))'}}>
          <p className="text-sm font-medium truncate" style={{color: "var(--sidebar-text, rgba(26,26,26,0.75))"}}>{profile?.full_name}</p>
          <p className="text-xs truncate" style={{color: "var(--sidebar-text, rgba(26,26,26,0.75))"}}>{profile?.branch_code || profile?.email}</p>
        </div>
      </div>
    </>
  )
}
