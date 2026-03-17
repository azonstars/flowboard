import { useState, useEffect, useCallback } from 'react'
import { getFormById, submitForm, getTodaySubmission, getSubmissionById } from '../../services/formService'
import { checkEditPermission, findCheckerForBranch } from '../../services/editRequestService'
import { notifyCheckersOnSubmit } from '../../services/notificationService'
import { logActivity, AUDIT_ACTIONS } from '../../services/auditService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'

// সংখ্যাকে বাংলায় রূপান্তর করো
const toBn = (num) => {
  if (num === null || num === undefined || num === '') return '০'
  return Number(num).toLocaleString('bn-BD')
}

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
        <div className="mb-4 p-3 bg-primary-50 rounded-lg">
          <p className="text-sm text-primary-700">
            Branch: <strong>{profile?.branch_code}</strong> |
            {isEditMode
              ? <> তারিখ: <strong>{editSubmission?.submission_date}</strong></>
              : <> Date: <strong>{new Date().toLocaleDateString('bn-BD')}</strong></>
            }
          </p>
        </div>

        {/* Date Range Summary */}
        {!isEditMode && (
          <div className="mb-4 border border-primary-100 rounded-xl overflow-hidden">
            <div className="bg-primary-50 px-4 py-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-primary-700 font-medium mb-1">📅 From</label>
                <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
                  className="border border-primary-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="block text-xs text-primary-700 font-medium mb-1">📅 To</label>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
                  className="border border-primary-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <button onClick={loadRangeSummary} disabled={!dateRange.from || !dateRange.to || loadingRange}
                className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition disabled:opacity-50">
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
                      <span key={field.id} className="bg-primary-50 px-2 py-0.5 rounded">
                        <strong>{field.label}:</strong>
                        {count ? ` সংখ্যা ${toBn(count)}` : ''}
                        {amount ? ` পরিমাণ ${toBn(amount)}` : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table layout — dynamic columns */}
        {(() => {
          // form-এর সব numeric field collect করো এবং unique columns বের করো
          const numericFields = (form.fields || []).filter(f =>
            f.type === 'numeric' || ['both','count','amount','subtotal','grandtotal'].includes(f.type)
          )
          if (!numericFields.length) return null

          // সব column keys collect করো (order: প্রথম numeric field-এর columns অনুযায়ী)
          // legacy: both → count + amount, count → count, amount → amount
          const getLegacyCols = (f) => {
            if (f.type === 'both') return [{key: f.id+'_count', label:'সংখ্যা'},{key: f.id+'_amount', label:'পরিমাণ'}]
            if (f.type === 'count') return [{key: f.id+'_count', label:'সংখ্যা'}]
            if (f.type === 'amount') return [{key: f.id+'_amount', label:'পরিমাণ'}]
            return []
          }

          // Global columns: subtotal/grandtotal-এর জন্য — প্রথম numeric field থেকে নাও
          const firstNumeric = numericFields.find(f => f.type === 'numeric' || ['both','count','amount'].includes(f.type))
          const globalCols = firstNumeric
            ? (firstNumeric.columns?.length > 0 ? firstNumeric.columns : getLegacyCols(firstNumeric))
            : []

          return (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width: globalCols.length === 0 ? '100%' : globalCols.length === 1 ? '60%' : globalCols.length === 2 ? '50%' : '40%'}} />
                {globalCols.map(col => <col key={col.key} style={{width: `${50 / globalCols.length}%`}} />)}
              </colgroup>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  <th style={{padding:'8px 16px',textAlign:'left',fontSize:'12px',fontWeight:'500',color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>বিবরণ</th>
                  {globalCols.map(col => (
                    <th key={col.key} style={{padding:'8px 12px',textAlign:'left',fontSize:'12px',fontWeight:'500',color:'#64748b',borderBottom:'1px solid #e2e8f0',borderLeft:'1px solid #e2e8f0'}}>
                      {col.label || col.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(form.fields || []).map((field, idx) => {

                  // Subtotal row
                  if (field.type === 'subtotal') {
                    // subtotal: সব source field-এর সব column-এর যোগ
                    const sources = field.sourceFields || []
                    const colTotals = globalCols.map(col => {
                      let total = 0
                      sources.forEach(srcId => {
                        total += parseFloat(formData[`${srcId}_${col.key}`] || formData[`${srcId}_count`] || 0)
                      })
                      // legacy fallback
                      if (total === 0) {
                        sources.forEach(srcId => {
                          const src = form.fields?.find(f => f.id === srcId)
                          if (!src) return
                          if (col.label === 'সংখ্যা') total += parseFloat(formData[`${srcId}_count`] || 0)
                          if (col.label === 'পরিমাণ') total += parseFloat(formData[`${srcId}_amount`] || 0)
                        })
                      }
                      return total
                    })
                    return (
                      <tr key={field.id} style={{background:'var(--subtotal-bg,#f0fdf4)'}}>
                        <td style={{padding:'9px 16px',fontSize:'13px',fontWeight:'600',color:'var(--subtotal-text,#15803d)',borderTop:'1px solid var(--subtotal-border,#bbf7d0)',borderBottom:'1px solid var(--subtotal-border,#bbf7d0)',background:'var(--subtotal-bg,#f0fdf4)'}}>
                          🔹 {field.label}
                        </td>
                        {colTotals.map((total, ci) => (
                          <td key={ci} style={{padding:'9px 12px',fontSize:'13px',fontWeight:'600',color:'var(--subtotal-text,#15803d)',borderTop:'1px solid var(--subtotal-border,#bbf7d0)',borderBottom:'1px solid var(--subtotal-border,#bbf7d0)',borderLeft:'1px solid var(--subtotal-border,#bbf7d0)',background:'var(--subtotal-bg,#f0fdf4)'}}>{toBn(total)}</td>
                        ))}
                      </tr>
                    )
                  }

                  // Grand Total row
                  if (field.type === 'grandtotal') {
                    const sources = field.sourceFields || []
                    const colTotals = globalCols.map(col => {
                      let total = 0
                      sources.forEach(stId => {
                        const st = form.fields?.find(f => f.id === stId)
                        if (!st) return
                        ;(st.sourceFields || []).forEach(srcId => {
                          total += parseFloat(formData[`${srcId}_${col.key}`] || 0)
                          // legacy
                          if (col.label === 'সংখ্যা') total += parseFloat(formData[`${srcId}_count`] || 0)
                          if (col.label === 'পরিমাণ') total += parseFloat(formData[`${srcId}_amount`] || 0)
                        })
                      })
                      return total
                    })
                    return (
                      <tr key={field.id} style={{background:'var(--grandtotal-bg,#eff6ff)'}}>
                        <td style={{padding:'11px 16px',fontSize:'14px',fontWeight:'600',color:'var(--grandtotal-text,#1e40af)',borderTop:'2px solid var(--grandtotal-border,#bfdbfe)',background:'var(--grandtotal-bg,#eff6ff)'}}>
                          🔷 {field.label}
                        </td>
                        {colTotals.map((total, ci) => (
                          <td key={ci} style={{padding:'11px 12px',fontSize:'14px',fontWeight:'600',color:'var(--grandtotal-text,#1e40af)',borderTop:'2px solid var(--grandtotal-border,#bfdbfe)',borderLeft:'1px solid var(--grandtotal-border,#bfdbfe)',background:'var(--grandtotal-bg,#eff6ff)'}}>{toBn(total)}</td>
                        ))}
                      </tr>
                    )
                  }

                  // Text/Select/YesNo field — full width
                  if (['text','select','yesno'].includes(field.type)) {
                    return (
                      <tr key={field.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td colSpan={1 + globalCols.length} style={{padding:'8px 16px'}}>
                          <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-700 shrink-0 w-40">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
                            {field.type === 'text' && (
                              <input type="text" value={formData[`${field.id}_text`] || ''}
                                onChange={e => handleChange(field.id, null, 'text', e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder={field.label} />
                            )}
                            {field.type === 'select' && (
                              <select value={formData[`${field.id}_select`] || ''}
                                onChange={e => handleChange(field.id, null, 'select', e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                                <option value="">-- select করুন --</option>
                                {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            )}
                            {field.type === 'yesno' && (
                              <div className="flex gap-4">
                                {['হ্যাঁ','না'].map(opt => (
                                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                    <input type="radio" name={field.id} value={opt}
                                      checked={formData[`${field.id}_yesno`] === opt}
                                      onChange={() => handleChange(field.id, null, 'yesno', opt)} />
                                    {opt}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  // Numeric field — dynamic columns
                  const fieldCols = field.columns?.length > 0
                    ? field.columns
                    : getLegacyCols(field)

                  return (
                    <>
                    <tr key={field.id} style={{borderBottom: field.children?.length ? 'none' : '1px solid #f1f5f9'}}>
                      <td style={{padding:'8px 16px',fontSize:'13px',color:'#1e293b',fontWeight:'500'}}>
                        {field.label}{field.required && <span style={{color:'#ef4444',marginLeft:'4px'}}>*</span>}
                      </td>
                      {globalCols.map(gCol => {
                        // এই field-এর মধ্যে এই column আছে কিনা দেখো
                        const matchCol = fieldCols.find(c => c.key === gCol.key || c.label === gCol.label)
                        return (
                          <td key={gCol.key} style={{padding:'6px 8px',borderLeft:'1px solid #f1f5f9'}}>
                            {matchCol ? (
                              <input type="number" step="any"
                                value={formData[`${field.id}_${matchCol.key}`] || ''}
                                onChange={e => setFormData(prev => ({...prev, [`${field.id}_${matchCol.key}`]: e.target.value}))}
                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder={matchCol.label} />
                            ) : <span className="text-gray-300 text-xs px-2">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                    {field.children?.map((child, ci) => (
                      <tr key={child.id} style={{background:'#f8fafc', borderBottom: ci === field.children.length-1 ? '1px solid #f1f5f9' : 'none'}}>
                        <td style={{padding:'7px 16px',paddingLeft:'32px',fontSize:'12px',color:'#475569'}}>
                          ↳ {child.label}
                        </td>
                        {globalCols.map(gCol => {
                          const matchCol = fieldCols.find(c => c.key === gCol.key || c.label === gCol.label)
                          return (
                            <td key={gCol.key} style={{padding:'5px 8px',borderLeft:'1px solid #f1f5f9'}}>
                              {matchCol ? (
                                <input type="number" step="any"
                                  value={formData[`${field.id}_${child.id}_${matchCol.key}`] || ''}
                                  onChange={e => setFormData(prev => ({...prev, [`${field.id}_${child.id}_${matchCol.key}`]: e.target.value}))}
                                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                  placeholder={matchCol.label} />
                              ) : <span className="text-gray-300 text-xs px-2">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
          )
        })()}

        <div className="flex gap-3 mt-6">
          <button onClick={() => handleSubmit('submitted')} disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
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