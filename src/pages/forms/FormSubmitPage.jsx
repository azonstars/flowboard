import { useState, useEffect, useCallback } from 'react'
import { getFormById, submitForm, getTodaySubmission, getSubmissionById } from '../../services/formService'
import { checkEditPermission, findCheckerForBranch } from '../../services/editRequestService'
import { notifyCheckersOnSubmit } from '../../services/notificationService'
import { logActivity, AUDIT_ACTIONS } from '../../services/auditService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'

export default function FormSubmitPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { formId } = useParams()
  const [searchParams] = useSearchParams()
  const submissionId = searchParams.get('submissionId') // edit mode
  const editDate = searchParams.get('date') // পুরনো তারিখ

  const [form, setForm] = useState(null)
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editSubmission, setEditSubmission] = useState(null)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [rangeSummary, setRangeSummary] = useState(null)
  const [loadingRange, setLoadingRange] = useState(false)

  useEffect(() => { loadForm() }, [formId, submissionId])

  const loadForm = async () => {
    try {
      if (submissionId) {
        // Edit mode — পুরনো submission load করো
        const sub = await getSubmissionById(submissionId)

        // Draft বা আজকের approved/submitted হলে permission check লাগবে না
        const subDate = sub.submission_date
        const today = new Date().toISOString().split('T')[0]
        const isToday = subDate === today
        const skipPermissionCheck = sub.status === 'draft' || sub.status === 'edit_allowed' || (isToday && ['approved', 'submitted'].includes(sub.status))

        if (!skipPermissionCheck) {
          const hasPermission = await checkEditPermission(submissionId, profile?.branch_code)
          if (!hasPermission) {
            toast.error('এই submission edit করার permission নেই!')
            navigate('/my-submissions')
            return
          }
        }

        setForm(sub.forms)
        setEditSubmission(sub)
        setExisting(sub)
        setFormData(sub.data || {})
        setIsEditMode(true)
      } else {
        // Normal mode — আজকের submission
        const [f, todaySub] = await Promise.all([
          getFormById(formId),
          getTodaySubmission(formId, profile?.branch_code)
        ])
        // Deadline check
        if (f.expires_at) {
          const today = new Date().toISOString().split('T')[0]
          if (f.expires_at < today) {
            toast.error(`⏰ এই form এর deadline শেষ হয়ে গেছে (${f.expires_at})`)
            navigate('/forms')
            return
          }
        }
        setForm(f)
        setExisting(todaySub)
        // Normal mode এ সবসময় blank — data load করব না
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const loadRangeSummary = useCallback(async () => {
    if (!dateRange.from || !dateRange.to || !formId || !profile?.branch_code) return
    setLoadingRange(true)
    try {
      const { data } = await supabase.from('form_submissions')
        .select('data').eq('form_id', formId)
        .eq('branch_code', profile?.branch_code)
        .gte('submission_date', dateRange.from)
        .lte('submission_date', dateRange.to)
        .eq('status', 'approved')
      
      if (!data || data.length === 0) { setRangeSummary({}); setLoadingRange(false); return }
      
      // সব submission এর data যোগ করো
      const totals = {}
      data.forEach(sub => {
        Object.entries(sub.data || {}).forEach(([key, val]) => {
          const num = parseFloat(val) || 0
          totals[key] = (totals[key] || 0) + num
        })
      })
      setRangeSummary(totals)
    } catch (err) { console.error(err) }
    finally { setLoadingRange(false) }
  }, [dateRange.from, dateRange.to, formId, profile?.branch_code])

  // Subtotal calculate করো
  const calcSubtotal = (field, data) => {
    const sources = field.sourceFields || []
    let count = 0, amount = 0
    sources.forEach(srcId => {
      count  += parseFloat(data[`${srcId}_count`]  || 0)
      amount += parseFloat(data[`${srcId}_amount`] || 0)
    })
    return { count, amount }
  }

  // Grand Total calculate করো
  const calcGrandTotal = (field, allFields, data) => {
    const sources = field.sourceFields || []
    let count = 0, amount = 0
    sources.forEach(srcId => {
      const src = allFields.find(f => f.id === srcId)
      if (!src) return
      const sub = calcSubtotal(src, data)
      count  += sub.count
      amount += sub.amount
    })
    return { count, amount }
  }

  const handleChange = (fieldId, subFieldId, type, value) => {
    const key = subFieldId ? `${fieldId}_${subFieldId}_${type}` : `${fieldId}_${type}`
    setFormData({ ...formData, [key]: value })
  }

  const handleSubmit = async (status) => {
    setLoading(true)
    try {
      if (isEditMode && editSubmission) {
        // পুরনো submission update করো
        // Draft হলে submitted করো, বাকি সব ক্ষেত্রে approved রাখো
        const newStatus = editSubmission.status === 'draft' ? status : 'approved'
        const { error } = await supabase.from('form_submissions')
          .update({
            data: formData,
            status: newStatus,
            approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
            submitted_by: profile?.id,
          })
          .eq('id', editSubmission.id)
        if (error) throw error

        // Draft না হলে edit request mark করো
        if (editSubmission.status !== 'draft') {
          await supabase.from('edit_requests')
            .update({ status: 'used' })
            .eq('submission_id', editSubmission.id)
            .eq('status', 'approved')
        }

        toast.success(editSubmission.status === 'draft' && status === 'draft' ? '📝 Draft সংরক্ষিত!' : '✅ Data আপডেট হয়েছে!')
        navigate('/my-submissions')
      } else {
        // নতুন submission
        const today = new Date().toISOString().split('T')[0]
        await submitForm({
          form_id: formId,
          branch_code: profile?.branch_code,
          submitted_by: profile?.id,
          submission_date: today,
          data: formData,
          status: status,
        })

        // Draft না হলে checker-দের notify করো
        if (status !== 'draft') {
          try {
            // Regional checker খুঁজো
            const checkers = await findCheckerForBranch(profile?.branch_code, 'regional_checker')
            if (checkers?.length > 0) {
              await notifyCheckersOnSubmit(
                profile?.branch_code,
                form?.title,
                checkers.map(c => c.id)
              )
            }
          } catch (e) { /* notification fail হলেও submission যাবে */ }
        }

        toast.success(status === 'submitted' ? '✅ Form submitted!' : '📝 Draft saved!')
        // Audit log
        await logActivity({ userId: profile.id, userName: profile.full_name, role: profile.role, action: status === 'submitted' ? AUDIT_ACTIONS.FORM_SUBMIT : AUDIT_ACTIONS.FORM_DRAFT, targetType: 'form', targetLabel: form?.title, meta: { branch: profile.branch_code } })
        navigate('/forms')
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!form) return <div className="text-center py-8 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{form.title}</h1>
          {form.description && <p className="text-gray-500 mt-1">{form.description}</p>}
        </div>
        {isEditMode && (
          <span className="px-3 py-1.5 rounded-full text-sm bg-orange-100 text-orange-700 font-medium">
            ✏️ Edit Mode — {editSubmission?.submission_date}
          </span>
        )}
        {!isEditMode && existing && (
          <span className={`px-3 py-1 rounded-full text-sm ${
            existing.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {existing.status === 'approved' ? '✅ Approved' : 'Draft'}
          </span>
        )}
      </div>

      {/* Edit mode warning */}
      {isEditMode && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-orange-800">পুরনো Data Edit করছেন</p>
            <p className="text-sm text-orange-600">
              তারিখ: <strong>{editSubmission?.submission_date}</strong> — 
              Permission দিয়েছেন: এই data সাবধানে update করুন
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Branch: <strong>{profile?.branch_code}</strong> |
            {isEditMode
              ? <> তারিখ: <strong>{editSubmission?.submission_date}</strong></>
              : <> Date: <strong>{new Date().toLocaleDateString('bn-BD')}</strong></>
            }
          </p>
        </div>

        {/* Date Range Summary */}
        {!isEditMode && (
          <div className="mb-4 border border-blue-100 rounded-xl overflow-hidden">
            <div className="bg-blue-50 px-4 py-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-blue-700 font-medium mb-1">📅 From</label>
                <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
                  className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-blue-700 font-medium mb-1">📅 To</label>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
                  className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <button onClick={loadRangeSummary} disabled={!dateRange.from || !dateRange.to || loadingRange}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50">
                {loadingRange ? '⏳' : '🔍 দেখুন'}
              </button>
              {rangeSummary && (
                <button onClick={() => setRangeSummary(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Clear</button>
              )}
            </div>
            {rangeSummary && Object.keys(rangeSummary).length === 0 && (
              <p className="text-sm text-gray-500 px-4 py-2">এই range এ কোনো data নেই</p>
            )}
            {rangeSummary && Object.keys(rangeSummary).length > 0 && (
              <div className="px-4 py-2 bg-white text-xs text-gray-600">
                <p className="font-semibold text-gray-700 mb-1">📊 {dateRange.from} থেকে {dateRange.to} পর্যন্ত মোট:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {form.fields?.map(field => {
                    const count = rangeSummary[`${field.id}_count`]
                    const amount = rangeSummary[`${field.id}_amount`]
                    if (!count && !amount) return null
                    return (
                      <span key={field.id} className="bg-blue-50 px-2 py-0.5 rounded">
                        <strong>{field.label}:</strong>
                        {count ? ` সংখ্যা ${count}` : ''}
                        {amount ? ` পরিমাণ ${amount.toFixed(2)}` : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {form.fields?.map(field => {
            // Subtotal row
            if (field.type === 'subtotal') {
              const { count, amount } = calcSubtotal(field, formData)
              const srcFields = (field.sourceFields || []).map(id => form.fields.find(f => f.id === id)).filter(Boolean)
              const hasCount  = srcFields.some(f => ['both','count'].includes(f.type))
              const hasAmount = srcFields.some(f => ['both','amount'].includes(f.type))
              return (
                <div key={field.id} className="border-2 border-green-400 bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-green-800 w-40 shrink-0">🔹 {field.label}</h3>
                    {hasCount && (
                      <div className="flex-1 text-center">
                        <p className="text-xs text-gray-500 mb-1">সংখ্যা</p>
                        <p className="text-lg font-bold text-green-700">{count || 0}</p>
                      </div>
                    )}
                    {hasAmount && (
                      <div className="flex-1 text-center">
                        <p className="text-xs text-gray-500 mb-1">পরিমাণ</p>
                        <p className="text-lg font-bold text-green-700">{amount?.toLocaleString('bn-BD') || 0}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            // Grand Total row
            if (field.type === 'grandtotal') {
              const { count, amount } = calcGrandTotal(field, form.fields, formData)
              const srcSubtotals = (field.sourceFields || []).map(id => form.fields.find(f => f.id === id)).filter(Boolean)
              const allSrcFields = srcSubtotals.flatMap(s => (s.sourceFields||[]).map(id => form.fields.find(f=>f.id===id)).filter(Boolean))
              const hasCount  = allSrcFields.some(f => ['both','count'].includes(f.type))
              const hasAmount = allSrcFields.some(f => ['both','amount'].includes(f.type))
              return (
                <div key={field.id} className="border-2 border-blue-500 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-blue-800 w-40 shrink-0">🔷 {field.label}</h3>
                    {hasCount && (
                      <div className="flex-1 text-center">
                        <p className="text-xs text-gray-500 mb-1">সংখ্যা</p>
                        <p className="text-xl font-bold text-blue-700">{count || 0}</p>
                      </div>
                    )}
                    {hasAmount && (
                      <div className="flex-1 text-center">
                        <p className="text-xs text-gray-500 mb-1">পরিমাণ</p>
                        <p className="text-xl font-bold text-blue-700">{amount?.toLocaleString('bn-BD') || 0}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            // Normal field
            return (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-medium text-gray-800 w-40 shrink-0">{field.label}</h3>
                {(field.type === 'both' || field.type === 'count') && (
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">সংখ্যা</label>
                    <input type="number"
                      value={formData[`${field.id}_count`] || ''}
                      onChange={e => handleChange(field.id, null, 'count', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0" />
                  </div>
                )}
                {(field.type === 'both' || field.type === 'amount') && (
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">পরিমাণ</label>
                    <input type="number" step="0.01"
                      value={formData[`${field.id}_amount`] || ''}
                      onChange={e => handleChange(field.id, null, 'amount', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00" />
                  </div>
                )}
              </div>

              {field.children?.map(child => (
                <div key={child.id} className="flex items-center gap-3 ml-6 border-l-2 border-gray-200 pl-4 mb-2">
                  <h4 className="text-sm text-gray-700 w-36 shrink-0">{child.label}</h4>
                  {(child.type === 'both' || child.type === 'count') && (
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">সংখ্যা</label>
                      <input type="number"
                        value={formData[`${field.id}_${child.id}_count`] || ''}
                        onChange={e => handleChange(field.id, child.id, 'count', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="0" />
                    </div>
                  )}
                  {(child.type === 'both' || child.type === 'amount') && (
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">পরিমাণ</label>
                      <input type="number" step="0.01"
                        value={formData[`${field.id}_${child.id}_amount`] || ''}
                        onChange={e => handleChange(field.id, child.id, 'amount', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="0.00" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            ) // end normal field return
          })} 
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => handleSubmit('submitted')} disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Saving...' : isEditMode ? '✅ Update করুন' : 'Submit'}
          </button>
          {/* Draft edit mode তে Draft Save বাটন */}
          {isEditMode && editSubmission?.status === 'draft' && (
            <button onClick={() => handleSubmit('draft')} disabled={loading}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50">
              📝 Draft রাখুন
            </button>
          )}
          <button onClick={() => navigate(isEditMode ? '/my-submissions' : '/forms')}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}