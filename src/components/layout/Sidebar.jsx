import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MENU_ITEMS } from '../../constants/menuConfig'
import { ROLES } from '../../constants/roles'

export default function Sidebar({ isOpen, onClose }) {
  const { profile, menuForms } = useAuth()
  const location = useLocation()

  const filteredMenu = MENU_ITEMS.filter(item =>
    item.roles.includes(profile?.role)
  )

  const isBranchOrAdmin = [
    ROLES.ADMIN,
    ROLES.BRANCH_MANAGER,
    ROLES.BRANCH_EMPLOYEE,
  ].includes(profile?.role)

  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed top-0 left-0 h-full w-64 bg-blue-900 text-white z-30
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-blue-700">
          <h1 className="text-2xl font-bold">FlowBoard</h1>
          <p className="text-blue-300 text-sm mt-1">
            {profile?.role?.replace(/_/g, ' ').toUpperCase()}
          </p>
        </div>

        {/* Menu */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100%-160px)]">
          {filteredMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive(item.path)
                  ? 'bg-white text-blue-900 font-semibold'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Dynamic Form Menu Items */}
          {isBranchOrAdmin && menuForms.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-4">
                <p className="text-blue-400 text-xs uppercase font-semibold tracking-wider">
                  Forms
                </p>
              </div>
              {menuForms.map((form) => (
                <Link
                  key={form.id}
                  to={`/forms/submit/${form.id}`}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive(`/forms/submit/${form.id}`)
                      ? 'bg-white text-blue-900 font-semibold'
                      : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  <span className="text-blue-400">📋</span>
                  <span>{form.title}</span>
                </Link>
              ))}
            </>
          )}
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