import { useState, useEffect } from 'react'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'
import { getSubmissionsForApproval } from '../../services/formService'
import { getForms } from '../../services/formService'
import { getBranches } from '../../services/branchService'
import { ROLES } from '../../constants/roles'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

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

export default function SubmissionHistoryPage() {
  const { profile } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [forms, setForms] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  const isBranch = [ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE].includes(profile?.role)
  const isChecker = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER].includes(profile?.role)

  // গত ৩০ দিন default
  const getDefaultStart = () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  }

  const [filters, setFilters] = useState({
    startDate: getDefaultStart(),
    endDate: new Date().toISOString().split('T')[0],
    status: '',
    form_id: '',
    branch_code: isBranch ? profile?.branch_code : '',
  })

  useEffect(() => {
    loadMeta()
    loadSubmissions()
  }, [])

  const loadMeta = async () => {
    try {
      const [f, b] = await Promise.all([getForms(), getBranches()])
      setForms(f)
      setBranches(b)
    } catch (error) { console.error(error) }
  }

  const loadSubmissions = async (f = filters) => {
    setLoading(true)
    try {
      let filterPayload = { ...f }

      // Branch user শুধু নিজের branch দেখবে
      if (isBranch) filterPayload.branch_code = profile?.branch_code

      // Regional checker শুধু তার region এর branches
      if (profile?.role === ROLES.REGIONAL_CHECKER && profile?.region_id) {
        const { data: rb } = await supabase.from('branches').select('branch_code').eq('region_id', profile.region_id)
        filterPayload.branchCodes = rb?.map(b => b.branch_code) || []
      }

      // Divisional checker শুধু তার division এর branches
      if (profile?.role === ROLES.DIVISIONAL_CHECKER && profile?.division_id) {
        const { data: db } = await supabase.from('branches').select('branch_code').eq('division_id', profile.division_id)
        filterPayload.branchCodes = db?.map(b => b.branch_code) || []
      }

      const data = await getSubmissionsForApproval(filterPayload)

      // form_id দিয়ে ফিল্টার
      let filtered = data
      if (f.form_id) filtered = data.filter(s => s.form_id === f.form_id)

      setSubmissions(filtered)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getBranchName = (code) => {
    const b = branches.find(b => b.branch_code === code)
    return b ? `${b.name} (${code})` : code
  }

  // Excel Export
  const exportExcel = () => {
    try {
      const wsData = [
        ['Submission History'],
        [`তারিখ: ${filters.startDate} — ${filters.endDate}`],
        [`মোট: ${submissions.length}টি`],
        [],
        ['ফর্ম', 'Branch', 'তারিখ', 'Status', 'Submitted By', 'Rejection কারণ'],
        ...submissions.map(s => [
          s.forms?.title || '—',
          getBranchName(s.branch_code),
          s.submission_date,
          STATUS_LABELS[s.status] || s.status,
          s.profiles?.full_name || '—',
          s.rejection_reason || '—',
        ])
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'History')
      XLSX.writeFile(wb, `submission_history_${filters.startDate}.xlsx`)
      toast.success('Excel export সফল!')
    } catch (error) {
      toast.error('Export failed: ' + error.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Submission History</h1>
          <p className="text-gray-500 mt-1">সব submission এর পূর্ণ ইতিহাস</p>
        </div>
        {submissions.length > 0 && (
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium">
            📊 Excel Export
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">শুরুর তারিখ</label>
            <input type="date" value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">শেষের তারিখ</label>
            <input type="date" value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ফর্ম</label>
            <select value={filters.form_id} onChange={e => setFilters({ ...filters, form_id: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">সব ফর্ম</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">সব Status</option>
              <option value="submitted">⏳ Pending</option>
              <option value="approved">✅ Approved</option>
              <option value="rejected">❌ Rejected</option>
              <option value="draft">📝 Draft</option>
            </select>
          </div>

          {/* Checker দের জন্য Branch ফিল্টার */}
          {isChecker && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
              <select value={filters.branch_code} onChange={e => setFilters({ ...filters, branch_code: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">সব Branch</option>
                {branches.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
              </select>
            </div>
          )}

          <button onClick={() => loadSubmissions(filters)}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            🔍 Filter
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['submitted', 'approved', 'rejected', 'draft'].map(status => (
          <div key={status} className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500">{STATUS_LABELS[status]}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {submissions.filter(s => s.status === status).length}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <EmptyState type="submission" title="কোনো submission পাওয়া যায়নি" description="তারিখ বা ফিল্টার পরিবর্তন করুন" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ফর্ম</th>
                {isChecker && <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>}
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">তারিখ</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Submitted By</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">বিস্তারিত</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 text-sm font-medium text-gray-800">{sub.forms?.title || '—'}</td>
                  {isChecker && <td className="px-5 py-4 text-sm text-gray-600">{getBranchName(sub.branch_code)}</td>}
                  <td className="px-5 py-4 text-sm text-gray-600">{sub.submission_date}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status]}`}>
                      {STATUS_LABELS[sub.status]}
                    </span>
                    {sub.status === 'rejected' && sub.rejection_reason && (
                      <p className="text-xs text-red-400 mt-1 max-w-xs truncate" title={sub.rejection_reason}>
                        {sub.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{sub.profiles?.full_name || '—'}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => { setSelectedSubmission(sub); setShowDetail(true) }}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                    >
                      👁 দেখুন
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer count */}
        {submissions.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
            মোট {submissions.length}টি submission
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selectedSubmission.forms?.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {getBranchName(selectedSubmission.branch_code)} | {selectedSubmission.submission_date}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Submitted by: {selectedSubmission.profiles?.full_name}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedSubmission.status]}`}>
                {STATUS_LABELS[selectedSubmission.status]}
              </span>
            </div>

            <div className="p-6 space-y-2">
              {selectedSubmission.status === 'rejected' && selectedSubmission.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-red-700">❌ Rejection কারণ:</p>
                  <p className="text-sm text-red-600 mt-1">{selectedSubmission.rejection_reason}</p>
                </div>
              )}

              {selectedSubmission.status === 'approved' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-green-700">✅ Approved হয়েছে</p>
                  {selectedSubmission.approved_at && (
                    <p className="text-xs text-green-600 mt-1">{new Date(selectedSubmission.approved_at).toLocaleString('bn-BD')}</p>
                  )}
                </div>
              )}

              {/* Form Data */}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📋 Form Data</h3>
              {selectedSubmission.data && Object.keys(selectedSubmission.data).length > 0 ? (
                Object.entries(selectedSubmission.data).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">{key}</span>
                    <span className="text-sm font-medium text-gray-800">{value || '—'}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">কোনো data নেই</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button onClick={() => { setShowDetail(false); setSelectedSubmission(null) }}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-200 transition text-sm">
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}