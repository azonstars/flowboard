import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  getMyNotifications, markNotificationRead,
  markAllNotificationsRead, clearAllNotifications,
  subscribeToNotifications
} from '../../services/notificationService'
import toast from 'react-hot-toast'

const TYPE_ICON = {
  form: '📬', success: '✅', warning: '❌', info: 'ℹ️', chat: '💬', checker: '🔍',
}

const formatNotifTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts), now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'এইমাত্র'
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}

export default function Topbar({ onMenuClick }) {
  const { profile, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const notifRef = useRef(null)
  const dropdownRef = useRef(null)
  const subscriptionRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const loadNotifications = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const data = await getMyNotifications(profile.id)
      setNotifications(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [profile?.id])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  useEffect(() => {
    if (!profile?.id) return
    subscriptionRef.current = subscribeToNotifications(profile.id, (payload) => {
      const n = payload.new
      setNotifications(prev => [n, ...prev])
      toast(`${TYPE_ICON[n.type] || '🔔'} ${n.title}`, { duration: 5000 })
    })
    return () => subscriptionRef.current?.unsubscribe()
  }, [profile?.id])

  const handleOpenNotif = async () => {
    setNotifOpen(!notifOpen)
    if (!notifOpen && unreadCount > 0) {
      try {
        await markAllNotificationsRead(profile.id)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      } catch (err) { console.error(err) }
    }
  }

  const handleNotifClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.id)
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      }
    } catch (err) { console.error(err) }
    setNotifOpen(false)
    if (notif.link) navigate(notif.link)
  }

  const handleClearAll = async () => {
    try {
      await clearAllNotifications(profile.id)
      setNotifications([])
      setNotifOpen(false)
    } catch (err) { toast.error('মুছতে সমস্যা হয়েছে') }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully!')
      navigate('/login')
    } catch (error) { toast.error(error.message) }
  }

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button onClick={handleOpenNotif} className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800 text-sm">🔔 Notifications</p>
                  {unreadCount > 0 && (
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-semibold">{unreadCount}</span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button onClick={handleClearAll} className="text-xs text-red-500 hover:underline">সব মুছুন</button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-6 text-center text-gray-400 text-sm">⏳ Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p className="text-3xl mb-2">🔕</p>
                    <p className="text-sm">কোনো notification নেই</p>
                  </div>
                ) : notifications.map(notif => (
                  <button key={notif.id} onClick={() => handleNotifClick(notif)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 flex gap-3 ${!notif.is_read ? 'bg-blue-50' : ''}`}>
                    <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[notif.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!notif.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{notif.title}</p>
                      {notif.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.message}</p>}
                      <p className="text-xs text-gray-400 mt-1">{formatNotifTime(notif.created_at)}</p>
                    </div>
                    {!notif.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />}
                  </button>
                ))}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400">মোট {notifications.length}টি notification</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block text-sm font-medium text-gray-700">{profile?.full_name}</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700 truncate">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
              </div>
              <button onClick={() => { setDropdownOpen(false); navigate('/profile') }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">
                👤 My Profile
              </button>
              <button onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}