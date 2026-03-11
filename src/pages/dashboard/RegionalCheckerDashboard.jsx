import { useState, useEffect, useRef } from 'react'
import { SkeletonDashboard } from '../../components/ui/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import { getMyPendingRequests, approveEditRequest, rejectEditRequest, escalateEditRequest } from '../../services/editRequestService'
import { createNotification } from '../../services/notificationService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-600',
  edit_allowed: 'bg-blue-100 text-blue-700',
}

export default function RegionalCheckerDashboard() {
  const { profile, appSettings } = useAuth()
  const navigate = useNavigate()
  const [pageLoading, setPageLoading] = useState(true)
  const [stats, setStats] = useState({ totalBranches: 0, todaySubmissions: 0, totalSubmissions: 0, pendingRequests: 0 })
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [branchData, setBranchData] = useState([])
  const [editRequests, setEditRequests] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [processing, setProcessing] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [escalateTarget, setEscalateTarget] = useState(null)
  const [escalateReason, setEscalateReason] = useState('')

  const prevRequestCountRef = useRef(null)

  useEffect(() => {
    if (!profile?.id) return
    setPageLoading(true)
    Promise.all([loadStats(), loadEditRequests()]).finally(() => setPageLoading(false))
  }, [profile?.id])

  // Polling — stable, একবারই mount
  useEffect(() => {
    const interval = setInterval(async () => {
      const { count } = await supabase
        .from('edit_requests')
        .select('id', { count: 'exact', head: true })
        .eq('required_checker', 'regional_checker')
        .eq('status', 'pending')

      if (prevRequestCountRef.current === null) {
        prevRequestCountRef.current = count ?? 0
      } else if ((count ?? 0) > prevRequestCountRef.current) {
        prevRequestCountRef.current = count
        toast('📝 নতুন Edit Request এসেছে!', { duration: 6000, icon: '🔔', id: 'new-req-reg' })
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

      // region_id না থাকলে সব branches দেখাও
      let branchQuery = supabase.from('branches').select('branch_code, name')
      if (profile?.region_id) branchQuery = branchQuery.eq('region_id', profile.region_id)
      const { data: branches } = await branchQuery
      const branchCodes = branches?.map(b => b.branch_code) || []
      if (branchCodes.length === 0) return

      const [todaySub, totalSub, recent] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' }).in('branch_code', branchCodes).eq('submission_date', today),
        supabase.from('form_submissions').select('id', { count: 'exact' }).in('branch_code', branchCodes),
        supabase.from('form_submissions').select('*, forms(title), branches(name)').in('branch_code', branchCodes).order('created_at', { ascending: false }).limit(8),
      ])

      setStats(prev => ({ ...prev, totalBranches: branchCodes.length, todaySubmissions: todaySub.count || 0, totalSubmissions: totalSub.count || 0 }))
      setRecentSubmissions(recent.data || [])

      const days = []
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().split('T')[0]) }
      const weeklyResults = await Promise.all(days.map(day => supabase.from('form_submissions').select('id', { count: 'exact' }).in('branch_code', branchCodes).eq('submission_date', day)))
      setWeeklyData(days.map((day, i) => ({ date: day.slice(5), submissions: weeklyResults[i].count || 0 })))

      const branchResults = await Promise.all((branches || []).map(b =>
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('branch_code', b.branch_code).eq('submission_date', today)
          .then(res => ({ name: b.name || b.branch_code, submissions: res.count || 0 }))
      ))
      setBranchData(branchResults)
    } catch (error) { console.error(error) }
  }

  const loadEditRequests = async () => {
    try {
      const data = await getMyPendingRequests(profile.id, 'regional_checker')
      setEditRequests(data)
      setStats(prev => ({ ...prev, pendingRequests: data.filter(r => r.status === 'pending').length }))
    } catch (err) { console.error(err) }
  }

  const handleApprove = async (req) => {
    setProcessing(req.id)
    try {
      await approveEditRequest(req.id, profile.id)
      // Branch কে notification
      await createNotification({
        userId: req.requested_by,
        title: '✅ Edit Permission দেওয়া হয়েছে',
        message: `"${req.form_submissions?.forms?.title}" edit করার permission পেয়েছেন`,
        type: 'success',
        link: '/dashboard',
      }).catch(() => {})
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
      await createNotification({
        userId: rejectTarget.requested_by,
        title: '❌ Edit Request বাতিল',
        message: `"${rejectTarget.form_submissions?.forms?.title}" edit request বাতিল হয়েছে`,
        type: 'warning',
        link: '/dashboard',
      }).catch(() => {})
      toast.success('Request বাতিল করা হয়েছে')
      setShowRejectModal(false)
      loadEditRequests()
    } catch (err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  const handleEscalate = async () => {
    if (!escalateReason.trim()) { toast.error('কারণ লিখুন!'); return }
    setProcessing(escalateTarget.id)
    try {
      // এই request টা reject করো
      await rejectEditRequest(escalateTarget.id, profile.id, `Escalated: ${escalateReason}`)
      // Divisional Checker এ নতুন request পাঠাও
      const result = await escalateEditRequest({
        submissionId: escalateTarget.submission_id,
        branchCode: escalateTarget.branch_code,
        requestedBy: profile.id,
        requestReason: escalateReason,
        submissionDate: escalateTarget.submission_date,
        targetRole: 'divisional_checker',
      })
      if (result.assignedChecker) {
        await createNotification({
          userId: result.assignedChecker.id,
          title: '📝 Edit Request (Escalated)',
          message: `Regional Manager থেকে ${escalateTarget.branch_code} এর edit request`,
          type: 'form',
          link: '/edit-requests',
        }).catch(() => {})
      }
      toast.success('✅ Divisional Manager কে পাঠানো হয়েছে')
      setShowEscalateModal(false)
      loadEditRequests()
    } catch (err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  if (pageLoading) return <SkeletonDashboard />

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}! 👋</h1>
          <p className="text-gray-500 mt-1">Regional Manager Dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium transition relative ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            ✏️ Edit Requests
            {stats.pendingRequests > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{stats.pendingRequests}</span>}
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && (<>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Region Branches', value: stats.totalBranches, color: 'border-blue-500' },
            { label: "Today's Submissions", value: stats.todaySubmissions, color: 'border-green-500' },
            { label: 'Total Submissions', value: stats.totalSubmissions, color: 'border-yellow-500' },
            { label: 'Pending Edit Requests', value: stats.pendingRequests, color: 'border-red-500' },
          ].map((s, i) => (
            <div key={i} className={`bg-white rounded-lg p-6 shadow-sm border-l-4 ${s.color}`}>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">📊 গত ৭ দিনের Submissions</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} allowDecimals={false} /><Tooltip /><Bar dataKey="submissions" fill="#3b82f6" radius={[4,4,0,0]} /></BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">🏢 আজকের Branch-wise</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={branchData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} /><Tooltip /><Bar dataKey="submissions" radius={[0,4,4,0]}>{branchData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#3b82f6' : '#8b5cf6'} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-gray-800">Recent Submissions</h2>
            {appSettings?.feature_checker_all_submissions_btn !== false && (
              <button onClick={() => navigate('/submissions')} className="text-sm text-blue-600 hover:underline">সব দেখুন →</button>
            )}
          </div>
          <div className="divide-y divide-gray-200">
            {recentSubmissions.length === 0 ? <div className="p-6 text-center text-gray-500">No submissions yet.</div>
              : recentSubmissions.map(sub => (
                <div key={sub.id} className="p-4 flex justify-between items-center">
                  <div><p className="font-medium text-gray-800">{sub.forms?.title}</p><p className="text-sm text-gray-500">{sub.branches?.name} | {sub.submission_date}</p></div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>{sub.status}</span>
                </div>
              ))}
          </div>
        </div>
      </>)}

      {activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">✏️ Edit Requests ({editRequests.length}টি)</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {editRequests.length === 0
              ? <div className="p-8 text-center text-gray-400"><p className="text-3xl mb-2">📭</p><p>কোনো pending request নেই</p></div>
              : editRequests.map(req => {
                const daysOld = req.days_old || 0
                const canApprove = daysOld <= 7
                const needsEscalate = daysOld > 7

                return (
                  <div key={req.id} className="p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-800">{req.form_submissions?.forms?.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{req.status}</span>
                          {needsEscalate && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠️ {daysOld} দিন পুরনো</span>}
                        </div>
                        <p className="text-sm text-gray-600">Branch: <strong>{req.branch_code}</strong> | Submission: {req.submission_date}</p>
                        <p className="text-sm text-gray-500">Requested by: {req.requester?.full_name}</p>
                        {req.request_reason && <p className="text-sm text-blue-700 mt-1 bg-blue-50 px-3 py-1.5 rounded-lg">কারণ: {req.request_reason}</p>}
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-2 shrink-0">
                          {canApprove && (
                            <button onClick={() => handleApprove(req)} disabled={processing === req.id}
                              className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                              {processing === req.id ? '⏳' : '✅ Approve'}
                            </button>
                          )}
                          {needsEscalate && (
                            <button onClick={() => { setEscalateTarget(req); setEscalateReason(''); setShowEscalateModal(true) }}
                              className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                              ↑ Escalate
                            </button>
                          )}
                          <button onClick={() => { setRejectTarget(req); setRejectReason(''); setShowRejectModal(true) }}
                            className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                            ❌ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-bold text-gray-800 mb-3">❌ Request Reject করুন</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="কারণ লিখুন..." rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={handleReject} disabled={processing} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-50">Reject করুন</button>
              <button onClick={() => setShowRejectModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">বাতিল</button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="font-bold text-gray-800 mb-1">↑ Divisional Manager কে পাঠান</h3>
            <p className="text-sm text-gray-500 mb-3">{escalateTarget?.days_old} দিন পুরনো — আপনার permission দেওয়ার সীমার বাইরে</p>
            <textarea value={escalateReason} onChange={e => setEscalateReason(e.target.value)} placeholder="কারণ লিখুন..." rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={handleEscalate} disabled={processing} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50">Escalate করুন</button>
              <button onClick={() => setShowEscalateModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">বাতিল</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}