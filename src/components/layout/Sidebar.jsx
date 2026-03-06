import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Sidebar({ isOpen, onClose }) {
  const { profile, allMenuItems, signOut } = useAuth()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState({})

  const filteredItems = allMenuItems.filter(item => {
    // roles না থাকলে বা empty হলে সবাই দেখবে
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

  // children আছে কিনা — role filter এর পরে
  const hasChildren = (item) => {
    const visible = filteredChildren(item.children)
    return visible.length > 0
  }

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
          {/* Mobile close button */}
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
                      <span className={`font-medium text-sm ${isParentActive ? 'font-semibold' : ''}`}>{item.label}</span>
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