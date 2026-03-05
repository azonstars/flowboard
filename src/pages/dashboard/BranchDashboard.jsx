import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function BranchDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    todaySubmissions: 0,
    totalSubmissions: 0,
    pendingForms: 0,
    totalForms: 0,
  })
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const prevStatusMap = useRef({})

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const [todaySub, totalSub, totalForms, recent] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' })
          .eq('branch_code', profile?.branch_code)
          .eq('submission_date', today),
        supabase.from('form_submissions').select('id', { count: 'exact' })
          .eq('branch_code', profile?.branch_code),
        supabase.from('forms').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('form_submissions').select('*, forms(title)')
          .eq('branch_code', profile?.branch_code)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      // Status পরিবর্তন হলে toast দেখাও
      const newSubs = recent.data || []
      newSubs.forEach(sub => {
        const prevStatus = prevStatusMap.current[sub.id]
        if (prevStatus && prevStatus !== sub.status) {
          if (sub.status === 'approved') {
            toast.success(`✅ "${sub.forms?.title}" Approved হয়েছে!`, { duration: 5000 })
          } else if (sub.status === 'rejected') {
            toast.error(`❌ "${sub.forms?.title}" Rejected হয়েছে!`, { duration: 5000 })
          }
        }
        prevStatusMap.current[sub.id] = sub.status
      })

      setStats({
        todaySubmissions: todaySub.count || 0,
        totalSubmissions: totalSub.count || 0,
        totalForms: totalForms.count || 0,
        pendingForms: (totalForms.count || 0) - (todaySub.count || 0),
      })
      setRecentSubmissions(newSubs)
    } catch (error) {
      console.error(error)
    }
  }

  // প্রতি ৩০ সেকেন্ডে auto-refresh
  useEffect(() => {
    const interval = setInterval(() => { loadStats() }, 30000)
    return () => clearInterval(interval)
  }, [profile])

  const STATUS_COLORS = {
    draft: 'bg-gray-100 text-gray-600',
    submitted: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  const STATUS_LABELS = {
    draft: '📝 Draft',
    submitted: '⏳ Pending',
    approved: '✅ Approved',
    rejected: '❌ Rejected',
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, {profile?.full_name}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Branch: <strong>{profile?.branch_code}</strong></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Today's Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.todaySubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Total Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalSubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Total Forms</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalForms}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Pending Today</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.pendingForms}</p>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Recent Submissions</h2>
          <button
            onClick={() => navigate('/forms')}
            className="text-sm text-blue-600 hover:underline"
          >
            View All Forms →
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {recentSubmissions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No submissions yet.</div>
          ) : (
            recentSubmissions.map(sub => (
              <div key={sub.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{sub.forms?.title}</p>
                  <p className="text-sm text-gray-500">{sub.submission_date}</p>
                  {sub.status === 'rejected' && sub.rejection_reason && (
                    <p className="text-xs text-red-500 mt-1">কারণ: {sub.rejection_reason}</p>
                  )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[sub.status] || sub.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}