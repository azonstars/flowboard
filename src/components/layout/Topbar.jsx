import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { ROLES } from '../../constants/roles'
import toast from 'react-hot-toast'

export default function Topbar({ onMenuClick }) {
  const { profile, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const navigate = useNavigate()
  const notifRef = useRef(null)
  const dropdownRef = useRef(null)

  const isChecker = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER].includes(profile?.role)
  const isBranch = [ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE].includes(profile?.role)

  const unreadCount = notifications.filter(n => !n.read).length

  // Outside click বন্ধ করা
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Supabase Realtime subscription
  useEffect(() => {
    if (!profile) return

    let channel

    if (isChecker) {
      // Checker: নতুন submitted submission আসলে notify করো
      channel = supabase
        .channel('checker-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'form_submissions',
          filter: 'status=eq.submitted',
        }, (payload) => {
          const newSub = payload.new
          addNotification({
            id: Date.now(),
            type: 'new_submission',
            message: `নতুন submission — Branch: ${newSub.branch_code}`,
            time: new Date().toLocaleTimeString('bn-BD'),
            link: '/submissions',
            read: false,
          })
          toast('📬 নতুন submission এসেছে!', { icon: '🔔', duration: 4000 })
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'form_submissions',
          filter: 'status=eq.submitted',
        }, (payload) => {
          const updated = payload.new
          if (updated.status === 'submitted') {
            addNotification({
              id: Date.now(),
              type: 'new_submission',
              message: `Submission updated — Branch: ${updated.branch_code}`,
              time: new Date().toLocaleTimeString('bn-BD'),
              link: '/submissions',
              read: false,
            })
          }
        })
        .subscribe()
    }

    if (isBranch) {
      // Branch: নিজের submission approve/reject হলে notify করো
      channel = supabase
        .channel(`branch-notifications-${profile.branch_code}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'form_submissions',
          filter: `branch_code=eq.${profile.branch_code}`,
        }, (payload) => {
          const updated = payload.new
          if (updated.status === 'approved') {
            addNotification({
              id: Date.now(),
              type: 'approved',
              message: `✅ আপনার submission Approved হয়েছে! (${updated.submission_date})`,
              time: new Date().toLocaleTimeString('bn-BD'),
              link: '/dashboard',
              read: false,
            })
            toast.success('✅ আপনার submission Approved হয়েছে!', { duration: 5000 })
          } else if (updated.status === 'rejected') {
            addNotification({
              id: Date.now(),
              type: 'rejected',
              message: `❌ আপনার submission Rejected হয়েছে! (${updated.submission_date})`,
              time: new Date().toLocaleTimeString('bn-BD'),
              link: '/dashboard',
              read: false,
            })
            toast.error('❌ আপনার submission Rejected হয়েছে!', { duration: 5000 })
          }
        })
        .subscribe()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [profile])

  const addNotification = (notif) => {
    setNotifications(prev => [notif, ...prev].slice(0, 20)) // সর্বোচ্চ ২০টা
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const clearAll = () => {
    setNotifications([])
    setNotifOpen(false)
  }

  const handleNotifClick = (notif) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    setNotifOpen(false)
    navigate(notif.link)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully!')
      navigate('/login')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-2">

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markAllRead() }}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                <p className="font-semibold text-gray-800 text-sm">🔔 Notifications</p>
                {notifications.length > 0 && (
                  <button onClick={clearAll} className="text-xs text-red-500 hover:underline">সব মুছুন</button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    <p className="text-2xl mb-2">🔕</p>
                    <p>কোনো notification নেই</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 ${!notif.read ? 'bg-blue-50' : ''}`}
                    >
                      <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{notif.time}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block text-sm font-medium text-gray-700">
              {profile?.full_name}
            </span>
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
              <button
                onClick={() => { setDropdownOpen(false); navigate('/profile') }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                👤 My Profile
              </button>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}