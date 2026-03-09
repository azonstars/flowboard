import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import { createEditRequest, getBranchEditRequests, getRequiredChecker } from '../../services/editRequestService'
import { createNotification } from '../../services/notificationService'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  approved: 'bg-green-100 text-green-700',
  edit_allowed: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
}
const STATUS_LABELS = {
  approved: '✅ Approved',
  edit_allowed: '✏️ Edit Allowed',
  submitted: '⏳ Submitted',
  draft: '📝 Draft',
  rejected: '❌ Rejected',
}

export default function BranchSubmissionsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [submissions, setSubmissions] = useState([])
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(false)
  const [editRequests, setEditRequests] = useState([])

  // Filters
  const [selectedForm, setSelectedForm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [singleDate, setSingleDate] = useState('')
  const [filterMode, setFilterMode] = useState('range') // range | single

  // Edit request modal
  const [showModal, setShowModal] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)
  const [editReason, setEditReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const prevEditRequestsRef = useRef({})
  const branchCodeRef = useRef(null)

  useEffect(() => {
    if (profile?.branch_code) branchCodeRef.current = profile.branch_code
  }, [profile?.branch_code])

  useEffect(() => {
    if (!profile?.branch_code) return
    loadForms(); loadEditRequests()
  }, [profile?.branch_code])

  // Polling — stable, একবারই mount
  useEffect(() => {
    const interval = setInterval(async () => {
      const bc = branchCodeRef.current
      if (!bc) return

      const { data } = await supabase
        .from('edit_requests')
        .select('id, status')
        .eq('branch_code', bc)

      if (!data) return
      let changed = false
      data.forEach(req => {
        const prev = prevEditRequestsRef.current[req.id]
        if (prev === undefined) {
          prevEditRequestsRef.current[req.id] = req.status
        } else if (prev !== req.status) {
          prevEditRequestsRef.current[req.id] = req.status
          changed = true
          if (req.status === 'approved') {
            toast.success('✅ Edit Permission পেয়েছেন! এখন edit করুন।', { duration: 6000, id: `ea-${req.id}` })
          } else if (req.status === 'rejected') {
            toast.error('❌ Edit Request বাতিল হয়েছে।', { duration: 5000, id: `er-${req.id}` })
          }
        }
      })
      if (changed) { loadEditRequests(); loadSubmissions() }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => { loadSubmissions() }, [selectedForm, dateFrom, dateTo, singleDate, filterMode])

  const loadForms = async () => {
    const { data } = await supabase.from('forms').select('id, title').eq('is_active', true)
    setForms(data || [])
  }

  const loadEditRequests = async () => {
    const { data } = await supabase.from('edit_requests')
      .select('submission_id, status')
      .eq('branch_code', profile?.branch_code)
    setEditRequests(data || [])
  }

  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('form_submissions')
        .select('*, forms(title)')
        .eq('branch_code', profile?.branch_code)
        .order('submission_date', { ascending: false })

      if (selectedForm) query = query.eq('form_id', selectedForm)

      if (filterMode === 'single' && singleDate) {
        query = query.eq('submission_date', singleDate)
      } else if (filterMode === 'range') {
        if (dateFrom) query = query.gte('submission_date', dateFrom)
        if (dateTo) query = query.lte('submission_date', dateTo)
      }

      const { data, error } = await query
      if (error) throw error
      setSubmissions(data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedForm, dateFrom, dateTo, singleDate, filterMode, profile?.branch_code])

  const openEditRequest = (sub) => {
    setSelectedSub(sub)
    setEditReason('')
    setShowModal(true)
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
      if (result.assignedChecker) {
        await createNotification({
          userId: result.assignedChecker.id,
          title: '📝 Edit Request',
          message: `${profile.branch_code} থেকে "${selectedSub.forms?.title}" এ edit অনুরোধ`,
          type: 'form',
          link: '/dashboard',
        }).catch(() => {})
      }
      toast.success(`✅ Request পাঠানো হয়েছে → ${result.checkerInfo.label}`)
      setShowModal(false)
      loadEditRequests()
      loadSubmissions()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getRequestStatus = (subId) => {
    const reqs = editRequests.filter(r => r.submission_id === subId)
    if (reqs.find(r => r.status === 'approved')) return 'approved'
    if (reqs.find(r => r.status === 'pending')) return 'pending'
    return null
  }

  const goToChat = () => navigate('/chat')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">📋 All Submissions</h1>
        <p className="text-sm text-gray-500 mt-1">Branch: <strong>{profile?.branch_code}</strong> — সব submission দেখুন ও edit request পাঠান</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Form filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">📄 Form</label>
            <select value={selectedForm} onChange={e => setSelectedForm(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[160px]">
              <option value="">সব Form</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>

          {/* Filter mode toggle */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">🔍 Filter Mode</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setFilterMode('range')}
                className={`px-3 py-2 text-sm transition ${filterMode === 'range' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Range
              </button>
              <button onClick={() => setFilterMode('single')}
                className={`px-3 py-2 text-sm transition ${filterMode === 'single' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Single Date
              </button>
            </div>
          </div>

          {filterMode === 'single' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">📅 তারিখ</label>
              <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">📅 From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">📅 To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </>
          )}

          <button onClick={() => { setSelectedForm(''); setDateFrom(''); setDateTo(''); setSingleDate('') }}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
            ✕ Clear
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">{submissions.length}টি submission পাওয়া গেছে</p>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-2xl mb-2">⏳</p><p>Loading...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-3xl mb-2">📭</p>
            <p>কোনো submission পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">তারিখ</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Form</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">বয়স</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map(sub => {
                  const checkerInfo = getRequiredChecker(sub.submission_date)
                  const reqStatus = getRequestStatus(sub.id)
                  // সরাসরি Edit করা যাবে — draft, edit_allowed, অথবা আজকের approved/submitted
                  const todayStr = new Date().toISOString().split('T')[0]
                  const isToday = sub.submission_date === todayStr
                  const canDirectEdit = sub.status === 'draft' || sub.status === 'edit_allowed' || (isToday && ['approved', 'submitted'].includes(sub.status))
                  const canDirectRequest = checkerInfo.days <= 7 && (sub.status === 'approved' || sub.status === 'submitted') && !reqStatus
                  const needsRegional = checkerInfo.days > 7 && (sub.status === 'approved' || sub.status === 'submitted') && !reqStatus

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{sub.submission_date}</td>
                      <td className="px-4 py-3 text-gray-700">{sub.forms?.title}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[sub.status] || sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${checkerInfo.days <= 7 ? 'text-green-600' : checkerInfo.days <= 365 ? 'text-orange-500' : 'text-red-500'}`}>
                          {checkerInfo.days} দিন
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 flex-wrap">

                          {/* ✏️ সরাসরি Edit — Draft বা Edit Allowed */}
                          {canDirectEdit && (
                            <button
                              onClick={() => navigate(`/forms/submit/${sub.form_id}?submissionId=${sub.id}&date=${sub.submission_date}`)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                                sub.status === 'draft'
                                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}>
                              ✏️ Edit
                            </button>
                          )}

                          {/* 📝 Edit Request — Submitted বা Approved (৭ দিনের মধ্যে) */}
                          {canDirectRequest && (
                            <button onClick={() => openEditRequest(sub)}
                              className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                              📝 Edit Request
                            </button>
                          )}

                          {/* 💬 Regional কে জানান — ৭ দিনের বেশি */}
                          {needsRegional && (
                            <button onClick={goToChat}
                              title="Regional Manager কে chat এ জানান"
                              className="text-xs px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition">
                              💬 Regional কে জানান
                            </button>
                          )}

                          {/* ⏳ Pending badge */}
                          {reqStatus === 'pending' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full">⏳ Pending</span>
                          )}

                          {/* ✅ Approved indicator */}
                          {!canDirectEdit && !canDirectRequest && !needsRegional && reqStatus !== 'pending' && (
                            <span className={`text-xs px-2 py-1 rounded font-mono ${
                              sub.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                            }`}>
                              {sub.status === 'approved' ? '📊 Approved' : '—'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Request Modal */}
      {showModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-1">📝 Edit Request</h3>
            <p className="text-sm text-gray-500 mb-1">
              <strong>{selectedSub.forms?.title}</strong> — {selectedSub.submission_date}
            </p>
            <p className="text-sm text-blue-600 font-medium mb-4">
              → {getRequiredChecker(selectedSub.submission_date).label} কে পাঠানো হবে
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
              <button onClick={() => setShowModal(false)}
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