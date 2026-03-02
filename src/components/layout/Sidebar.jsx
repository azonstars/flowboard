import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MENU_ITEMS } from '../../constants/menuConfig'

export default function Sidebar({ isOpen, onClose }) {
  const { profile } = useAuth()
  const location = useLocation()

  const filteredMenu = MENU_ITEMS.filter(item =>
    item.roles.includes(profile?.role)
  )

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-blue-900 text-white z-30
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-blue-700">
          <h1 className="text-2xl font-bold">FlowBoard</h1>
          <p className="text-blue-300 text-sm mt-1">{profile?.role?.replace('_', ' ').toUpperCase()}</p>
        </div>

        {/* Menu */}
        <nav className="p-4 space-y-1">
          {filteredMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition
                ${location.pathname === item.path
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }
              `}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-700">
          <p className="text-blue-200 text-sm truncate">{profile?.full_name}</p>
          <p className="text-blue-400 text-xs truncate">{profile?.email}</p>
        </div>
      </div>
    </>
  )
}