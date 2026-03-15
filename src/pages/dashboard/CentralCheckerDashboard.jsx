import { useState, useEffect, useRef } from 'react'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonDashboard } from '../../components/ui/Skeleton'
import { useAuth } from '../../context/AuthContext'
import MenuSummaryPanel from '../../components/dashboard/MenuSummaryPanel'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import { getMyPendingRequests, approveEditRequest, rejectEditRequest } from '../../services/editRequestService'
import { createNotification } from '../../services/notificationService'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#f59e0b', '#22c55e', '#ef4444', '#94a3b8']
const STATUS_COLORS = {
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-600',
}

export default function CentralCheckerDashboard() {
  const { profile, appSettings } = useAuth()
  const navigate = useNavigate()
  const [pageLoading, setPageLoading] = useState(true)
  const [stats, setStats] = useState({ totalBranches: 0, todaySubmissions: 0, totalSubmissions: 0, pendingSubmissions: 0 })
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [statusData, setStatusData] = useState([])

  const [editRequests, setEditRequests] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [processing, setProcessing] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const prevRequestCountRef = useRef(null)

  useEffect(() => {
    if (!profile?.id) return
    setPageLoading(true)
    Promise.all([loadStats(), loadEditRequests()]).finally(() => setPageLoading(false))
  }, [profile?.id])

  useEffect(() => {
    const interval = setInterval(async () => {
      const { count } = await supabase
        .from('edit_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (prevRequestCountRef.current === null) {
        prevRequestCountRef.current = count ?? 0
      } else if ((count ?? 0) > prevRequestCountRef.current) {
        prevRequestCountRef.current = count
        toast('📝 নতুন Edit Request এসেছে!', { duration: 6000, icon: '🔔', id: 'new-req-cen' })
        loadEditRequests()
      } else if (count !== prevRequestCountRef.current) {
        prevRequestCountRef.current = count ?? 0
        loadEditRequests()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const [branches, todaySub, totalSub, pendingSub, recent] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact' }),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('submission_date', today),
        supabase.from('form_submissions').select('id', { count: 'exact' }),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'submitted'),
        supabase.from('form_submissions').select('*, forms(title), branches(name)')
          .order('created_at', { ascending: false }).limit(8),
      ])
      setStats({
        totalBranches: branches.count || 0,
        todaySubmissions: todaySub.count || 0,
        totalSubmissions: totalSub.count || 0,
        pendingSubmissions: pendingSub.count || 0,
      })
      setRecentSubmissions(recent.data || [])

      // গত ৭ দিন
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        days.push(d.toISOString().split('T')[0])
      }
      const weeklyResults = await Promise.all(
        days.map(day => supabase.from('form_submissions').select('id', { count: 'exact' }).eq('submission_date', day))
      )
      setWeeklyData(days.map((day, i) => ({ date: day.slice(5), submissions: weeklyResults[i].count || 0 })))

      // Status breakdown
      const [approved, rejected] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'approved'),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'rejected'),
      ])
      setStatusData([
        { name: 'Pending', value: pendingSub.count || 0 },
        { name: 'Approved', value: approved.count || 0 },
        { name: 'Rejected', value: rejected.count || 0 },
      ])
    } catch (error) {
      console.error(error)
    }
  }

  const loadEditRequests = async () => {
    try {
      const data = await getMyPendingRequests(profile.id, 'central_checker')
      setEditRequests(data)
    } catch (err) { console.error(err) }
  }

  const handleApprove = async (req) => {
    setProcessing(req.id)
    try {
      await approveEditRequest(req.id, profile.id)
      await createNotification({ userId: req.requested_by, title: '✅ Edit Permission দেওয়া হয়েছে', message: `"${req.form_submissions?.forms?.title}" edit করার permission পেয়েছেন`, type: 'success', link: '/dashboard' }).catch(() => {})
      toast.success('✅ Edit permission দেওয়া হয়েছে')
      loadEditRequests()
    } catch (err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('কারণ লিখুন!'); return }
    setProcessing(rejectTarget.id)
    try {
      await rejectEditRequest(rejectTarget.id, profile.id, rejectReason)
      await createNotification({ userId: rejectTarget.requested_by, title: '❌ Edit Request বাতিল', message: 'edit request বাতিল হয়েছে', type: 'warning', link: '/dashboard' }).catch(() => {})
      toast.success('Request বাতিল করা হয়েছে')
      setShowRejectModal(false)
      loadEditRequests()
    } catch (err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  const pendingCount = editRequests.filter(r => r.status === 'pending').length

  if (pageLoading) return <SkeletonDashboard />

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}! 👋</h1>
          <p className="text-gray-500 mt-1">Central Checker Dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium transition relative ${activeTab === 'requests' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            ✏️ সব Edit Requests
            {pendingCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{pendingCount}</span>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-primary-500">
          <p className="text-sm text-gray-500">Total Branches</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalBranches}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Today's Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.todaySubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Total Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalSubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.pendingSubmissions}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">📊 গত ৭ দিনের Submissions</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="submissions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Submissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">🥧 Submission Status</h2>
          {statusData.every(d => d.value === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400"><p>কোনো data নেই</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Recent Submissions</h2>
          {appSettings?.feature_checker_all_submissions_btn !== false && (
            <button onClick={() => navigate('/submissions')} className="text-sm text-primary-600 hover:underline">সব দেখুন →</button>
          )}
        </div>
        <div className="divide-y divide-gray-200">
          {recentSubmissions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No submissions yet.</div>
          ) : (
            recentSubmissions.map(sub => (
              <div key={sub.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{sub.forms?.title}</p>
                  <p className="text-sm text-gray-500">{sub.branches?.name} | {sub.submission_date}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                  {sub.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      {activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-gray-800">✏️ সব Edit Requests ({editRequests.length}টি)</h2>
            <p className="text-xs text-gray-400">Central Checker সব request দেখতে ও approve করতে পারবেন</p>
          </div>
          <div className="divide-y divide-gray-200">
            {editRequests.length === 0
              ? <EmptyState type="request" title="কোনো request নেই" description="এই মুহূর্তে কোনো pending request নেই" />
              : editRequests.map(req => (
                <div key={req.id} className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-800">{req.form_submissions?.forms?.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{req.status}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${req.required_checker === 'central_checker' ? 'bg-purple-100 text-purple-700' : req.required_checker === 'divisional_checker' ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700'}`}>{req.required_checker?.replace('_checker', '').replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-gray-600">Branch: <strong>{req.branch_code}</strong> | {req.submission_date} | <span className="text-orange-600">{req.days_old} দিন পুরনো</span></p>
                      <p className="text-sm text-gray-500">Requested by: {req.requester?.full_name}</p>
                      {req.request_reason && <p className="text-sm text-primary-700 mt-1 bg-primary-50 px-3 py-1.5 rounded-lg">কারণ: {req.request_reason}</p>}
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleApprove(req)} disabled={processing === req.id} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">{processing === req.id ? '⏳' : '✅ Approve'}</button>
                        <button onClick={() => { setRejectTarget(req); setRejectReason(''); setShowRejectModal(true) }} className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">❌ Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-bold text-gray-800 mb-3">❌ Request Reject করুন</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="কারণ লিখুন..." rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={handleReject} disabled={processing} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">Reject করুন</button>
              <button onClick={() => setShowRejectModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">বাতিল</button>
            </div>
          </div>
        </div>
      )}
      <MenuSummaryPanel />
    </div>
  )
}