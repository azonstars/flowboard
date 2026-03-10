import { useState, useEffect } from 'react'
import { createForm, updateForm, getFormById, getForms } from '../../services/formService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

// Preview Component — form টা exactly কেমন দেখাবে
const FormPreviewModal = ({ form, fields, onClose }) => {
  const [previewData, setPreviewData] = useState({})
  const isVisible = (field) => {
    if (!field.condition) return true
    const { dependsOn, showWhen } = field.condition
    const parentVal = String(previewData[dependsOn] || '')
    return parentVal === showWhen
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">👁 Form Preview</h2>
            <p className="text-xs text-gray-400 mt-0.5">এটি branch user দের কাছে এভাবে দেখাবে</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-800 text-lg">{form || 'Form Title'}</h3>
          </div>
          {fields.filter(f => f.label).map(field => {
            if (!isVisible(field)) return null
            return (
              <div key={field.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-800">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </h4>
                  {field.condition && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Conditional</span>
                  )}
                </div>
                {field.children?.length > 0 ? (
                  <div className="space-y-2">
                    {field.children.filter(c => c.label).map(child => (
                      <div key={child.id} className="ml-4 border-l-2 border-gray-300 pl-3">
                        <p className="text-sm text-gray-600 mb-1">{child.label}</p>
                        <div className="flex gap-2">
                          {(child.type === 'both' || child.type === 'count') && (
                            <input type="number" placeholder="সংখ্যা" disabled
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm bg-white opacity-60"/>
                          )}
                          {(child.type === 'both' || child.type === 'amount') && (
                            <input type="number" placeholder="পরিমাণ" disabled
                              className="w-32 border border-gray-300 rounded px-2 py-1 text-sm bg-white opacity-60"/>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {(field.type === 'both' || field.type === 'count') && (
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">সংখ্যা</p>
                        <input type="number"
                          value={previewData[field.id + '_count'] || ''}
                          onChange={e => setPreviewData(p => ({...p, [field.id + '_count']: e.target.value, [field.id]: e.target.value}))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                      </div>
                    )}
                    {(field.type === 'both' || field.type === 'amount') && (
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">পরিমাণ (৳)</p>
                        <input type="number"
                          value={previewData[field.id + '_amount'] || ''}
                          onChange={e => setPreviewData(p => ({...p, [field.id + '_amount']: e.target.value, [field.id]: e.target.value}))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                      </div>
                    )}
                    {field.type === 'select' && (
                      <select
                        value={previewData[field.id] || ''}
                        onChange={e => setPreviewData(p => ({...p, [field.id]: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">বেছে নিন</option>
                        {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                      </select>
                    )}
                    {field.type === 'text' && (
                      <input type="text" placeholder={field.placeholder || field.label}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    )}
                    {field.type === 'yesno' && (
                      <div className="flex gap-3">
                        {['হ্যাঁ','না'].map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name={`preview_${field.id}`}
                              value={opt} onChange={e => setPreviewData(p => ({...p, [field.id]: e.target.value}))}/>
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {fields.filter(f => f.label).length === 0 && (
            <p className="text-center text-gray-400 py-8">কোনো field যোগ করা হয়নি</p>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FormBuilderPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Template
  const [templates, setTemplates] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    if (editId) loadForm()
    loadTemplates()
  }, [editId])

  const loadForm = async () => {
    try {
      const form = await getFormById(editId)
      setFormTitle(form.title)
      setFormDescription(form.description || '')
      setExpiresAt(form.expires_at || '')
      setFields(form.fields || [])
    } catch (error) { toast.error(error.message) }
  }

  const loadTemplates = async () => {
    try {
      const all = await getForms()
      setTemplates(all.filter(f => f.is_template))
    } catch (error) { console.error(error) }
  }

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) { toast.error('Template নাম লিখুন!'); return }
    if (fields.length === 0) { toast.error('কমপক্ষে একটি field যোগ করুন!'); return }
    try {
      await createForm({ title: templateName, description: formDescription, fields, is_active: false, is_template: true, created_by: profile.id })
      toast.success(`"${templateName}" template সেভ হয়েছে!`)
      setShowSaveTemplateModal(false); setTemplateName(''); loadTemplates()
    } catch (error) { toast.error(error.message) }
  }

  const handleLoadTemplate = (template) => {
    if (fields.length > 0 && !window.confirm('বর্তমান fields মুছে template load করবেন?')) return
    setFields(template.fields?.map(f => ({
      ...f, id: Date.now().toString() + Math.random(),
      children: (f.children || []).map(c => ({ ...c, id: Date.now().toString() + Math.random() }))
    })) || [])
    if (!formTitle) setFormTitle(template.title.replace(' (Template)', ''))
    toast.success(`"${template.title}" template load হয়েছে!`)
    setShowTemplateModal(false)
  }

  const addField = () => {
    setFields([...fields, { id: Date.now().toString(), label: '', type: 'both', required: false, children: [], options: [], condition: null }])
  }

  const addSubField = (parentId) => {
    setFields(fields.map(f => f.id === parentId ? {
      ...f, children: [...f.children, { id: Date.now().toString(), label: '', type: 'both', required: false }]
    } : f))
  }

  const updateField = (id, key, value) => setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f))

  const updateSubField = (parentId, childId, key, value) => {
    setFields(fields.map(f => f.id === parentId ? {
      ...f, children: f.children.map(c => c.id === childId ? { ...c, [key]: value } : c)
    } : f))
  }

  const removeField = (id) => setFields(fields.filter(f => f.id !== id))
  const removeSubField = (parentId, childId) => {
    setFields(fields.map(f => f.id === parentId ? { ...f, children: f.children.filter(c => c.id !== childId) } : f))
  }

  const moveField = (index, direction) => {
    const newFields = [...fields]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newFields.length) return
    ;[newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]]
    setFields(newFields)
  }

  const handleSave = async () => {
    if (!formTitle.trim()) { toast.error('Form title is required!'); return }
    if (fields.length === 0) { toast.error('Add at least one field!'); return }
    setLoading(true)
    try {
      const formData = {
        title: formTitle, description: formDescription, fields,
        is_active: true, created_by: profile.id,
        expires_at: expiresAt || null,
      }
      if (editId) await updateForm(editId, formData)
      else await createForm(formData)
      toast.success(editId ? 'Form updated!' : 'Form created!')
      navigate('/forms')
    } catch (error) { toast.error(error.message) }
    finally { setLoading(false) }
  }

  const FIELD_TYPES = [
    { value: 'both', label: 'সংখ্যা + পরিমাণ' },
    { value: 'count', label: 'সংখ্যা only' },
    { value: 'amount', label: 'পরিমাণ only' },
    { value: 'text', label: 'টেক্সট' },
    { value: 'select', label: 'Dropdown' },
    { value: 'yesno', label: 'হ্যাঁ/না' },
  ]

  // Conditional এর জন্য parent candidates — select বা yesno type
  const conditionalParents = fields.filter(f => ['select', 'yesno'].includes(f.type) && f.label)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">{editId ? '✏️ Edit Form' : '🛠 Form Builder'}</h1>
        <div className="flex gap-2 flex-wrap">
          {!editId && (
            <>
              <button onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition text-sm font-medium">
                📋 Template
              </button>
              {fields.length > 0 && (
                <button onClick={() => { setTemplateName(formTitle ? `${formTitle} (Template)` : ''); setShowSaveTemplateModal(true) }}
                  className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition text-sm font-medium">
                  💾 Template Save
                </button>
              )}
            </>
          )}
          {fields.length > 0 && (
            <button onClick={() => setShowPreview(true)}
              className="px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition text-sm font-medium">
              👁 Preview
            </button>
          )}
          <button onClick={() => navigate('/forms')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium">
            {loading ? 'Saving...' : '💾 Save Form'}
          </button>
        </div>
      </div>

      {/* Form Details */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Title *</label>
            <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Form এর নাম লিখুন" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ⏰ Deadline (Expiry Date)
              <span className="ml-2 text-xs text-gray-400 font-normal">এই তারিখের পর submit করা যাবে না</span>
            </label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Form এর বিবরণ (optional)" rows={2} />
        </div>
        {expiresAt && (
          <div className={`text-sm px-3 py-2 rounded-lg ${new Date(expiresAt) < new Date() ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {new Date(expiresAt) < new Date()
              ? `⚠️ এই deadline ইতিমধ্যে পার হয়ে গেছে — form submit করা যাবে না`
              : `✅ Deadline: ${new Date(expiresAt).toLocaleDateString('bn-BD', { day: '2-digit', month: 'long', year: 'numeric' })} পর্যন্ত active`}
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="bg-white rounded-lg p-5 shadow-sm border-l-4 border-blue-500">
            <div className="flex gap-3 items-start">
              <div className="flex flex-col gap-1 pt-1">
                <button onClick={() => moveField(index, 'up')} className="text-gray-400 hover:text-gray-600 text-xs">▲</button>
                <button onClick={() => moveField(index, 'down')} className="text-gray-400 hover:text-gray-600 text-xs">▼</button>
              </div>
              <div className="flex-1 space-y-3">
                {/* Field label + type + required */}
                <div className="flex gap-3 flex-wrap">
                  <input type="text" value={field.label}
                    onChange={e => updateField(field.id, 'label', e.target.value)}
                    className="flex-1 min-w-40 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Field label" />
                  <select value={field.type} onChange={e => updateField(field.id, 'type', e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={field.required || false}
                      onChange={e => updateField(field.id, 'required', e.target.checked)}
                      className="rounded"/>
                    Required
                  </label>
                </div>

                {/* Select options */}
                {field.type === 'select' && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Dropdown options (একটি করে লিখুন)</p>
                    {(field.options || []).map((opt, oi) => (
                      <div key={oi} className="flex gap-2">
                        <input type="text" value={opt}
                          onChange={e => { const opts = [...(field.options||[])]; opts[oi]=e.target.value; updateField(field.id,'options',opts) }}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder={`Option ${oi+1}`}/>
                        <button onClick={() => { const opts=(field.options||[]).filter((_,i)=>i!==oi); updateField(field.id,'options',opts) }}
                          className="text-red-400 hover:text-red-600 text-sm">✕</button>
                      </div>
                    ))}
                    <button onClick={() => updateField(field.id,'options',[...(field.options||[]),''])}
                      className="text-xs text-blue-600 hover:underline">+ Option যোগ করুন</button>
                  </div>
                )}

                {/* Conditional logic */}
                {conditionalParents.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-700 font-medium mb-2">⚡ Conditional (কোন field এর উপর নির্ভরশীল?)</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      <select
                        value={field.condition?.dependsOn || ''}
                        onChange={e => {
                          if (!e.target.value) updateField(field.id, 'condition', null)
                          else updateField(field.id, 'condition', { dependsOn: e.target.value, showWhen: field.condition?.showWhen || '' })
                        }}
                        className="border border-yellow-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400">
                        <option value="">নির্ভরশীল নয়</option>
                        {conditionalParents.filter(p => p.id !== field.id).map(p => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                      {field.condition?.dependsOn && (
                        <>
                          <span className="text-xs text-yellow-700">এর মান হলে →</span>
                          {(() => {
                            const parent = fields.find(f => f.id === field.condition.dependsOn)
                            if (parent?.type === 'yesno') return (
                              <select value={field.condition.showWhen || ''}
                                onChange={e => updateField(field.id,'condition',{...field.condition,showWhen:e.target.value})}
                                className="border border-yellow-300 rounded px-2 py-1 text-sm bg-white focus:outline-none">
                                <option value="">বেছে নিন</option>
                                <option value="হ্যাঁ">হ্যাঁ</option>
                                <option value="না">না</option>
                              </select>
                            )
                            if (parent?.type === 'select') return (
                              <select value={field.condition.showWhen || ''}
                                onChange={e => updateField(field.id,'condition',{...field.condition,showWhen:e.target.value})}
                                className="border border-yellow-300 rounded px-2 py-1 text-sm bg-white focus:outline-none">
                                <option value="">বেছে নিন</option>
                                {(parent.options||[]).map((opt,i) => <option key={i} value={opt}>{opt}</option>)}
                              </select>
                            )
                            return null
                          })()}
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">তখন এই field দেখাবে</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub fields */}
                {['both','count','amount'].includes(field.type) && field.children?.map(child => (
                  <div key={child.id} className="ml-6 flex gap-3 items-center border-l-2 border-gray-200 pl-4">
                    <input type="text" value={child.label}
                      onChange={e => updateSubField(field.id, child.id, 'label', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Sub field label" />
                    <select value={child.type} onChange={e => updateSubField(field.id, child.id, 'type', e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="both">সংখ্যা + পরিমাণ</option>
                      <option value="count">সংখ্যা only</option>
                      <option value="amount">পরিমাণ only</option>
                    </select>
                    <button onClick={() => removeSubField(field.id, child.id)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                ))}

                {['both','count','amount'].includes(field.type) && (
                  <button onClick={() => addSubField(field.id)} className="text-sm text-blue-600 hover:underline">
                    + Sub Field যোগ করুন
                  </button>
                )}
              </div>
              <button onClick={() => removeField(field.id)} className="text-red-500 hover:text-red-700 font-bold text-lg">✕</button>
            </div>
          </div>
        ))}

        <button onClick={addField}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition font-medium">
          + Field যোগ করুন
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && <FormPreviewModal form={formTitle} fields={fields} onClose={() => setShowPreview(false)} />}

      {/* Template Load Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">📋 Template থেকে শুরু</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p>কোনো template নেই। Form তৈরি করে "Template Save" করুন।</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{t.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.fields?.length || 0}টি field</p>
                      </div>
                      <button onClick={() => handleLoadTemplate(t)}
                        className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">💾 Template হিসেবে সেভ</h2>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Template এর নাম" autoFocus />
              <div className="flex gap-3">
                <button onClick={handleSaveAsTemplate}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition text-sm font-medium">
                  💾 সেভ
                </button>
                <button onClick={() => setShowSaveTemplateModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition text-sm">
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}