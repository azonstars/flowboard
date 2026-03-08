import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

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

export default function BranchDashboard() {
  const { profile, appSettings } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    todaySubmissions: 0,
    totalSubmissions: 0,
    pendingForms: 0,
    totalForms: 0,
  })
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [pendingForms, setPendingForms] = useState([])
  const [completedForms, setCompletedForms] = useState([])
  const prevStatusMap = useRef({})

  useEffect(() => { loadStats() }, [])

  // প্রতি ৩০ সেকেন্ডে auto-refresh
  useEffect(() => {
    const interval = setInterval(() => { loadStats() }, 30000)
    return () => clearInterval(interval)
  }, [profile])

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [todaySub, totalSub, allForms, recent, todaySubDetails] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' })
          .eq('branch_code', profile?.branch_code)
          .eq('submission_date', today),
        supabase.from('form_submissions').select('id', { count: 'exact' })
          .eq('branch_code', profile?.branch_code),
        supabase.from('forms').select('id, title, menu_icon').eq('is_active', true),
        supabase.from('form_submissions').select('*, forms(title)')
          .eq('branch_code', profile?.branch_code)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('form_submissions').select('form_id, status')
          .eq('branch_code', profile?.branch_code)
          .eq('submission_date', today),
      ])

      // Status পরিবর্তন হলে toast
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

      // আজকে কোন ফর্ম submit হয়েছে এবং হয়নি বের করো
      const submittedFormIds = (todaySubDetails.data || []).map(s => s.form_id)
      const submittedFormMap = {}
      ;(todaySubDetails.data || []).forEach(s => { submittedFormMap[s.form_id] = s.status })

      const allFormsList = allForms.data || []
      const pending = allFormsList.filter(f => !submittedFormIds.includes(f.id))
      const completed = allFormsList.filter(f => submittedFormIds.includes(f.id))
        .map(f => ({ ...f, status: submittedFormMap[f.id] }))

      setPendingForms(pending)
      setCompletedForms(completed)

      setStats({
        todaySubmissions: todaySub.count || 0,
        totalSubmissions: totalSub.count || 0,
        totalForms: allFormsList.length,
        pendingForms: pending.length,
      })
      setRecentSubmissions(newSubs)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, {profile?.full_name}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Branch: <strong>{profile?.branch_code}</strong> | {new Date().toLocaleDateString('bn-BD')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">আজকের Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.todaySubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500">মোট Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalSubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">মোট Forms</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalForms}</p>
        </div>
        <div className={`bg-white rounded-lg p-6 shadow-sm border-l-4 ${stats.pendingForms > 0 ? 'border-red-500' : 'border-green-500'}`}>
          <p className="text-sm text-gray-500">আজকে বাকি</p>
          <p className={`text-3xl font-bold mt-1 ${stats.pendingForms > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.pendingForms}
          </p>
        </div>
      </div>

      {/* আজকের Form Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pending Forms */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">
              ⏰ আজকে Submit বাকি
              {pendingForms.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {pendingForms.length}টি
                </span>
              )}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingForms.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-green-600 font-medium">আজকের সব ফর্ম submit হয়েছে!</p>
              </div>
            ) : (
              pendingForms.map(form => (
                <div key={form.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{form.menu_icon || '📋'}</span>
                    <span className="text-sm font-medium text-gray-800">{form.title}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/forms/submit/${form.id}`)}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Submit করুন →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Completed Forms */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">
              ✅ আজকে Submit হয়েছে
              {completedForms.length > 0 && (
                <span className="ml-2 bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {completedForms.length}টি
                </span>
              )}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {completedForms.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-sm">এখনো কোনো ফর্ম submit হয়নি</p>
              </div>
            ) : (
              completedForms.map(form => (
                <div key={form.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{form.menu_icon || '📋'}</span>
                    <span className="text-sm font-medium text-gray-700">{form.title}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[form.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[form.status] || form.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">সাম্প্রতিক Submissions</h2>
          {appSettings?.feature_branch_all_forms_btn !== false && (
            <button onClick={() => navigate('/forms')} className="text-sm text-blue-600 hover:underline">
              সব Forms →
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-200">
          {recentSubmissions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">কোনো submission নেই।</div>
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