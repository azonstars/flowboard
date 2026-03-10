import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getSubmissionsForApproval, approveSubmission, rejectSubmission } from '../../services/formService'
import { getBranches } from '../../services/branchService'
import { notifyBranchOnCheckerAction } from '../../services/notificationService'
import { logActivity, AUDIT_ACTIONS } from '../../services/auditService'
import { ROLES } from '../../constants/roles'
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

export default function SubmissionsPage() {
  const { profile } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [filters, setFilters] = useState({
    status: 'submitted',
    branch_code: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  const isChecker = [ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER, ROLES.ADMIN].includes(profile?.role)

  useEffect(() => {
    loadBranches()
    loadSubmissions()
  }, [])

  const loadBranches = async () => {
    try {
      const data = await getBranches()
      setBranches(data)
    } catch (error) {
      console.error(error)
    }
  }

  const loadSubmissions = async (f = filters) => {
    setLoading(true)
    try {
      // Regional checker শুধু তার region এর branches দেখবে
      let filterPayload = { ...f }
      if (profile?.role === ROLES.REGIONAL_CHECKER && profile?.region_id) {
        const { data: regionBranches } = await import('../../services/supabase').then(m =>
          m.supabase.from('branches').select('branch_code').eq('region_id', profile.region_id)
        )
        filterPayload.branchCodes = regionBranches?.map(b => b.branch_code) || []
      }
      if (profile?.role === ROLES.DIVISIONAL_CHECKER && profile?.division_id) {
        const { supabase } = await import('../../services/supabase')
        const { data: divBranches } = await supabase
          .from('branches').select('branch_code').eq('division_id', profile.division_id)
        filterPayload.branchCodes = divBranches?.map(b => b.branch_code) || []
      }

      const data = await getSubmissionsForApproval(filterPayload)
      setSubmissions(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
  }

  const handleApplyFilter = () => {
    loadSubmissions(filters)
  }

  const handleApprove = async (sub) => {
    if (!window.confirm(`"${sub.forms?.title}" — Branch: ${sub.branch_code}\nএটি Approve করবেন?`)) return
    setProcessing(true)
    try {
      await approveSubmission(sub.id, profile.id)
      if (sub.submitted_by) await notifyBranchOnCheckerAction(sub.submitted_by, 'approved', sub.forms?.title || 'Submission').catch(() => {})
      await logActivity({ userId: profile.id, userName: profile.full_name, role: profile.role, action: AUDIT_ACTIONS.SUBMISSION_APPROVE, targetType: 'submission', targetId: sub.id, targetLabel: sub.forms?.title, meta: { branch: sub.branch_code } })
      toast.success(`✅ Approved! Branch ${sub.branch_code} কে জানানো হয়েছে।`)
      loadSubmissions()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setProcessing(false)
    }
  }

  const openRejectModal = (sub) => {
    setRejectTarget(sub)
    setRejectReason('')
    setShowRejectModal(true)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('কারণ লিখুন!'); return }
    setProcessing(true)
    try {
      await rejectSubmission(rejectTarget.id, profile.id, rejectReason)
      if (rejectTarget.submitted_by) await notifyBranchOnCheckerAction(rejectTarget.submitted_by, 'rejected', rejectTarget.forms?.title || 'Submission').catch(() => {})
      await logActivity({ userId: profile.id, userName: profile.full_name, role: profile.role, action: AUDIT_ACTIONS.SUBMISSION_REJECT, targetType: 'submission', targetId: rejectTarget.id, targetLabel: rejectTarget.forms?.title, meta: { branch: rejectTarget.branch_code, reason: rejectReason } })
      toast.success(`❌ Rejected! Branch ${rejectTarget.branch_code} কে জানানো হয়েছে।`)
      setShowRejectModal(false)
      setRejectTarget(null)
      loadSubmissions()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setProcessing(false)
    }
  }

  const openDetail = (sub) => {
    setSelectedSubmission(sub)
    setShowDetailModal(true)
  }

  const getBranchName = (code) => {
    const branch = branches.find(b => b.branch_code === code)
    return branch ? `${branch.name} (${code})` : code
  }

  const pendingCount = submissions.filter(s => s.status === 'submitted').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Submissions</h1>
          <p className="text-gray-500 mt-1">Branch submissions পর্যালোচনা ও approve/reject করুন</p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full font-semibold text-sm">
            ⏳ {pendingCount}টি Pending
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">সব</option>
              <option value="submitted">⏳ Pending</option>
              <option value="approved">✅ Approved</option>
              <option value="rejected">❌ Rejected</option>
              <option value="draft">📝 Draft</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
            <select
              value={filters.branch_code}
              onChange={e => handleFilterChange('branch_code', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">সব Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">শুরুর তারিখ</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => handleFilterChange('startDate', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">শেষের তারিখ</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => handleFilterChange('endDate', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleApplyFilter}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            🔍 Filter
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p>কোনো submission পাওয়া যায়নি</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ফর্ম</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">তারিখ</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800 text-sm">{sub.forms?.title || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub.profiles?.full_name}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{getBranchName(sub.branch_code)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{sub.submission_date}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status]}`}>
                      {STATUS_LABELS[sub.status]}
                    </span>
                    {sub.status === 'rejected' && sub.rejection_reason && (
                      <p className="text-xs text-red-400 mt-1 max-w-xs truncate" title={sub.rejection_reason}>
                        কারণ: {sub.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openDetail(sub)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
                      >
                        👁 দেখুন
                      </button>
                      {isChecker && sub.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => handleApprove(sub)}
                            disabled={processing}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition disabled:opacity-50"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(sub)}
                            disabled={processing}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50"
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selectedSubmission.forms?.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Branch: {getBranchName(selectedSubmission.branch_code)} | {selectedSubmission.submission_date}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedSubmission.status]}`}>
                {STATUS_LABELS[selectedSubmission.status]}
              </span>
            </div>

            <div className="p-6 space-y-3">
              {selectedSubmission.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-red-700">Rejection কারণ:</p>
                  <p className="text-sm text-red-600 mt-1">{selectedSubmission.rejection_reason}</p>
                </div>
              )}

              {/* Form Data */}
              <div className="space-y-2">
                {selectedSubmission.data && Object.entries(selectedSubmission.data).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">{key}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between items-center gap-3">
              {isChecker && selectedSubmission.status === 'submitted' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDetailModal(false); handleApprove(selectedSubmission) }}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition text-sm"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => { setShowDetailModal(false); openRejectModal(selectedSubmission) }}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm"
                  >
                    ❌ Reject
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="ml-auto bg-gray-100 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && rejectTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">❌ Submission Reject</h2>
              <p className="text-sm text-gray-500 mt-1">
                {rejectTarget.forms?.title} — Branch: {rejectTarget.branch_code}
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reject এর কারণ <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
                placeholder="কারণটি বিস্তারিত লিখুন..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition text-sm font-medium disabled:opacity-50"
              >
                {processing ? 'Processing...' : '❌ Reject করুন'}
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setRejectTarget(null) }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}