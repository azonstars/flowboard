import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import { createEditRequest, getBranchEditRequests, getRequiredChecker } from '../../services/editRequestService'
import { createNotification } from '../../services/notificationService'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  edit_allowed: 'bg-blue-100 text-blue-700',
}
const STATUS_LABELS = {
  draft: '📝 Draft',
  submitted: '⏳ Pending',
  approved: '✅ Approved',
  rejected: '❌ Rejected',
  edit_allowed: '✏️ Edit Allowed',
}

export default function BranchDashboard() {
  const { profile, appSettings } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ todaySubmissions: 0, totalSubmissions: 0, pendingForms: 0, totalForms: 0 })
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [pendingForms, setPendingForms] = useState([])
  const [completedForms, setCompletedForms] = useState([])
  const [editRequests, setEditRequests] = useState([])
  const [oldSubmissions, setOldSubmissions] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)
  const [editReason, setEditReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const prevStatusMap = useRef({})

  // edit_requests এর আগের status track করার জন্য
  const prevEditRequestsRef = useRef({})

  useEffect(() => {
    loadStats(); loadEditRequests()

    // Polling: প্রতি ৫ সেকেন্ডে check করো
    const interval = setInterval(async () => {
      // edit_requests check — status পরিবর্তন হলে toast
      const { data } = await supabase.from('edit_requests')
        .select('id, status, submission_id')
        .eq('branch_code', profile?.branch_code)
        .in('status', ['approved', 'rejected'])

      if (data) {
        data.forEach(req => {
          const prev = prevEditRequestsRef.current[req.id]
          if (prev === undefined) {
            // প্রথমবার — শুধু track করো, toast না
            prevEditRequestsRef.current[req.id] = req.status
          } else if (prev !== req.status) {
            // status বদলেছে!
            prevEditRequestsRef.current[req.id] = req.status
            if (req.status === 'approved') {
              toast.success('✅ Edit Permission পেয়েছেন! এখন edit করুন।', { duration: 6000, id: `edit-approved-${req.id}` })
            } else if (req.status === 'rejected') {
              toast.error('❌ Edit Request বাতিল হয়েছে।', { duration: 5000, id: `edit-rejected-${req.id}` })
            }
            loadEditRequests()
            loadStats()
          }
        })
      }
    }, 5000)

    // Supabase realtime — চালু থাকলে extra benefit
    const channel = supabase.channel(`branch-dashboard-${profile?.branch_code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'edit_requests', filter: `branch_code=eq.${profile?.branch_code}` },
        () => { loadEditRequests(); loadStats() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'form_submissions', filter: `branch_code=eq.${profile?.branch_code}` },
        () => { loadStats() })
      .subscribe()

    return () => { clearInterval(interval); channel.unsubscribe() }
  }, [profile])

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const [todaySub, totalSub, allForms, recent, todaySubDetails, editAllowed] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('branch_code', profile?.branch_code).eq('submission_date', today),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('branch_code', profile?.branch_code),
        supabase.from('forms').select('id, title, menu_icon').eq('is_active', true),
        supabase.from('form_submissions').select('*, forms(title)').eq('branch_code', profile?.branch_code).order('created_at', { ascending: false }).limit(20),
        supabase.from('form_submissions').select('form_id, status').eq('branch_code', profile?.branch_code).eq('submission_date', today),
        // edit_allowed এবং approved (৭ দিনের মধ্যে) সব submission
        supabase.from('form_submissions').select('*, forms(title)')
          .eq('branch_code', profile?.branch_code)
          .in('status', ['edit_allowed', 'approved'])
          .neq('submission_date', today)
          .gte('submission_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('submission_date', { ascending: false }),
      ])

      const newSubs = recent.data || []
      newSubs.forEach(sub => {
        const prevStatus = prevStatusMap.current[sub.id]
        if (prevStatus && prevStatus !== sub.status) {
          if (sub.status === 'edit_allowed') toast.success(`✏️ "${sub.forms?.title}" এ edit এর permission দেওয়া হয়েছে!`, { duration: 5000 })
        }
        prevStatusMap.current[sub.id] = sub.status
      })

      const submittedFormIds = (todaySubDetails.data || []).map(s => s.form_id)
      const submittedFormMap = {}
      ;(todaySubDetails.data || []).forEach(s => { submittedFormMap[s.form_id] = s.status })
      const allFormsList = allForms.data || []
      const pending = allFormsList.filter(f => !submittedFormIds.includes(f.id))
      const completed = allFormsList.filter(f => submittedFormIds.includes(f.id)).map(f => ({ ...f, status: submittedFormMap[f.id] }))
      setPendingForms(pending)
      setCompletedForms(completed)
      setStats({ todaySubmissions: todaySub.count || 0, totalSubmissions: totalSub.count || 0, totalForms: allFormsList.length, pendingForms: pending.length })
      setRecentSubmissions(newSubs)

      // পুরনো submissions মার্জ করো (edit_allowed + approved পুরনোগুলো)
      const oldSubs = (editAllowed.data || []).filter(s =>
        !newSubs.find(n => n.id === s.id) // duplicate avoid
      )
      setOldSubmissions(oldSubs)
    } catch (error) { console.error(error) }
  }

  const loadEditRequests = async () => {
    try {
      const data = await getBranchEditRequests(profile?.branch_code)
      setEditRequests(data)
    } catch (err) { console.error(err) }
  }

  const openEditRequest = (sub) => {
    setSelectedSub(sub)
    setEditReason('')
    setShowEditModal(true)
  }

  const handleEditRequest = async () => {
    if (!editReason.trim()) { toast.error('কারণ লিখুন!'); return }
    setSubmitting(true)
    try {
      const result = await createEditRequest({
        submissionId: selectedSub.id,
        branchCode: profile.branch_code,
        requestedBy: profile.id,
        requestReason: editReason,
        submissionDate: selectedSub.submission_date,
      })

      // Checker কে notification
      if (result.assignedChecker) {
        await createNotification({
          userId: result.assignedChecker.id,
          title: '📝 Edit Request',
          message: `${profile.branch_code} থেকে "${selectedSub.forms?.title}" এ edit অনুরোধ এসেছে`,
          type: 'form',
          link: '/edit-requests',
        }).catch(() => {})
      }

      toast.success(`✅ Request পাঠানো হয়েছে → ${result.checkerInfo.label}`)
      setShowEditModal(false)
      loadEditRequests()
      loadStats()
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const pendingEditRequests = editRequests.filter(r => r.status === 'pending').length
  const approvedEditRequests = oldSubmissions.filter(s => s.status === 'edit_allowed')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}! 👋</h1>
        <p className="text-gray-500 mt-1">Branch: <strong>{profile?.branch_code}</strong> | {new Date().toLocaleDateString('bn-BD')}</p>
      </div>

      {/* Edit allowed alert */}
      {approvedEditRequests.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">✏️</span>
          <div className="flex-1">
            <p className="font-semibold text-blue-800">Edit Permission পেয়েছেন!</p>
            <p className="text-sm text-blue-600">{approvedEditRequests.length}টি submission edit করার permission আছে</p>
          </div>
          <button onClick={() => document.getElementById('recent-submissions')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
            দেখুন ↓
          </button>
        </div>
      )}

      {/* Stats */}
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
          <p className={`text-3xl font-bold mt-1 ${stats.pendingForms > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.pendingForms}</p>
        </div>
      </div>

      {/* Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">⏰ আজকে Submit বাকি
              {pendingForms.length > 0 && <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-semibold">{pendingForms.length}টি</span>}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingForms.length === 0
              ? <div className="p-6 text-center"><p className="text-3xl mb-2">🎉</p><p className="text-green-600 font-medium">আজকের সব ফর্ম submit হয়েছে!</p></div>
              : pendingForms.map(form => (
                <div key={form.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{form.menu_icon || '📋'}</span>
                    <span className="text-sm font-medium text-gray-800">{form.title}</span>
                  </div>
                  <button onClick={() => navigate(`/forms/submit/${form.id}`)} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Submit করুন →</button>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">✅ আজকে Submit হয়েছে
              {completedForms.length > 0 && <span className="ml-2 bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full font-semibold">{completedForms.length}টি</span>}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {completedForms.length === 0
              ? <div className="p-6 text-center text-gray-400"><p className="text-2xl mb-2">📭</p><p className="text-sm">এখনো কোনো ফর্ম submit হয়নি</p></div>
              : completedForms.map(form => (
                <div key={form.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{form.menu_icon || '📋'}</span>
                    <span className="text-sm font-medium text-gray-700">{form.title}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[form.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[form.status] || form.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* পুরনো Submissions — Edit Request / Edit Allowed */}
      {oldSubmissions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-800">📂 পুরনো Submissions
              <span className="ml-2 bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-semibold">{oldSubmissions.length}টি</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">৭ দিনের মধ্যে — Edit Request পাঠাতে পারবেন</p>
          </div>
          <div className="divide-y divide-gray-100">
            {oldSubmissions.map(sub => {
              const checkerInfo = getRequiredChecker(sub.submission_date)
              const todayStr = new Date().toISOString().split('T')[0]
              const isToday = sub.submission_date === todayStr
              const canDirectEdit = sub.status === 'draft' || sub.status === 'edit_allowed' || (isToday && ['approved', 'submitted'].includes(sub.status))
              const canRequest = !canDirectEdit && checkerInfo.days <= 7 && ['submitted', 'approved', 'rejected'].includes(sub.status)
              const hasRequest = editRequests.find(r => r.submission_id === sub.id && r.status === 'pending')
              return (
                <div key={sub.id} className="p-4 flex justify-between items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{sub.forms?.title}</p>
                    <p className="text-sm text-gray-500">{sub.submission_date} · {checkerInfo.days} দিন আগে</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* ✏️ সরাসরি Edit — Draft বা Edit Allowed */}
                    {canDirectEdit && (
                      <button onClick={() => navigate(`/forms/submit/${sub.form_id}?submissionId=${sub.id}&date=${sub.submission_date}`)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                          sub.status === 'draft'
                            ? 'bg-gray-600 text-white hover:bg-gray-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}>
                        ✏️ Edit
                      </button>
                    )}
                    {/* 📝 Edit Request — অনুমোদন লাগবে */}
                    {canRequest && !hasRequest && (
                      <button onClick={() => openEditRequest(sub)}
                        className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                        📝 Edit Request
                      </button>
                    )}
                    {hasRequest && <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full">⏳ Pending</span>}
                    {!canDirectEdit && !canRequest && !hasRequest && (
                      <span className="text-xs text-gray-400">Regional Manager কে বলুন</span>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[sub.status] || sub.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Submissions with Edit Request */}
      <div id="recent-submissions" className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">সাম্প্রতিক Submissions</h2>
          <div className="flex gap-2 flex-wrap">
            {pendingEditRequests > 0 && (
              <span className="bg-yellow-100 text-yellow-700 text-xs px-3 py-1.5 rounded-full font-medium">⏳ {pendingEditRequests}টি request pending</span>
            )}
            <button onClick={() => navigate('/my-submissions')}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium">
              📋 All Submissions →
            </button>
            {appSettings?.feature_branch_all_forms_btn !== false && (
              <button onClick={() => navigate('/forms')} className="text-sm text-blue-600 hover:underline">সব Forms →</button>
            )}
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentSubmissions.length === 0
            ? <div className="p-6 text-center text-gray-500">কোনো submission নেই।</div>
            : recentSubmissions.map(sub => {
              const checkerInfo = getRequiredChecker(sub.submission_date)
              const todayStr = new Date().toISOString().split('T')[0]
              const isToday = sub.submission_date === todayStr
              // সরাসরি Edit: draft, edit_allowed, অথবা আজকের approved/submitted
              const canDirectEdit = sub.status === 'draft' || sub.status === 'edit_allowed' || (isToday && ['approved', 'submitted'].includes(sub.status))
              const canRequest = !canDirectEdit && checkerInfo.days <= 7 && ['submitted', 'approved', 'rejected'].includes(sub.status)
              const hasRequest = editRequests.find(r => r.submission_id === sub.id && r.status === 'pending')

              return (
                <div key={sub.id} className="p-4 flex justify-between items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{sub.forms?.title}</p>
                    <p className="text-sm text-gray-500">{sub.submission_date} · {checkerInfo.days} দিন আগে</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* ✏️ সরাসরি Edit — Draft বা Edit Allowed */}
                    {canDirectEdit && (
                      <button onClick={() => navigate(`/forms/submit/${sub.form_id}?submissionId=${sub.id}&date=${sub.submission_date}`)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                          sub.status === 'draft'
                            ? 'bg-gray-600 text-white hover:bg-gray-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}>
                        ✏️ Edit
                      </button>
                    )}
                    {/* 📝 Edit Request — অনুমোদন লাগবে */}
                    {canRequest && !hasRequest && (
                      <button onClick={() => openEditRequest(sub)}
                        className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                        📝 Edit Request
                      </button>
                    )}
                    {hasRequest && <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full">⏳ Pending</span>}
                    {!canDirectEdit && !canRequest && !hasRequest && (
                      <span className="text-xs text-gray-400">Regional Manager কে বলুন</span>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[sub.status] || sub.status}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Edit Request Modal */}
      {showEditModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-1">✏️ Edit Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              "{selectedSub.forms?.title}" — {selectedSub.submission_date}
              <br/>
              <span className="text-blue-600 font-medium">→ Regional Manager কে পাঠানো হবে</span>
            </p>
            <textarea
              value={editReason}
              onChange={e => setEditReason(e.target.value)}
              placeholder="কেন edit করতে চান? কারণ লিখুন..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={handleEditRequest} disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {submitting ? '⏳ পাঠানো হচ্ছে...' : 'Request পাঠান'}
              </button>
              <button onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}