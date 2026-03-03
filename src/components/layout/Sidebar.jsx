import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Sidebar({ isOpen, onClose }) {
  const { profile, allMenuItems } = useAuth()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState({})

  const filteredItems = allMenuItems.filter(item =>
    item.roles && item.roles.includes(profile?.role)
  )

  const isActive = (path) => location.pathname.startsWith(path)

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const hasChildren = (item) => item.children && item.children.length > 0

  const filteredChildren = (children) =>
    (children || []).filter(child =>
      child.roles && child.roles.includes(profile?.role)
    )

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={onClose} />
      )}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-blue-900 text-white z-30
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="p-6 border-b border-blue-700">
          <h1 className="text-2xl font-bold">FlowBoard</h1>
          <p className="text-blue-300 text-sm mt-1">
            {profile?.role?.replace(/_/g, ' ').toUpperCase()}
          </p>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100%-160px)]">
          {filteredItems.map((item) => {
            const children = filteredChildren(item.children)
            const isExpanded = expandedItems[item.id]
            const isParentActive = isActive(item.path) ||
              children.some(c => isActive(c.path))

            return (
              <div key={item.id}>
                {/* Parent Item */}
                <div className={`flex items-center rounded-lg transition ${
                  isParentActive
                    ? 'bg-white text-blue-900'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`}>
                  <Link
                    to={item.path}
                    onClick={() => { if (!hasChildren(item)) onClose() }}
                    className="flex items-center gap-3 px-4 py-3 flex-1"
                  >
                    <span className="text-xl">{item.icon || '📋'}</span>
                    <span className={`font-medium ${isParentActive ? 'text-blue-900 font-semibold' : ''}`}>
                      {item.label}
                    </span>
                  </Link>

                  {hasChildren(item) && (
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className={`pr-4 py-3 transition ${
                        isParentActive ? 'text-blue-900' : 'text-blue-300 hover:text-white'
                      }`}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Sub Items */}
                {hasChildren(item) && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-blue-700 pl-3">
                    {children.map(child => (
                      <Link
                        key={child.id}
                        to={child.path}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm ${
                          isActive(child.path)
                            ? 'bg-white text-blue-900 font-semibold'
                            : 'text-blue-300 hover:bg-blue-800 hover:text-white'
                        }`}
                      >
                        <span className="text-lg">{child.icon || '📌'}</span>
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-700">
          <p className="text-blue-200 text-sm truncate">{profile?.full_name}</p>
          <p className="text-blue-400 text-xs truncate">{profile?.email}</p>
        </div>
      </div>
    </>
  )
}