import { useState, useEffect } from 'react'
import { createForm, updateForm, getFormById, getForms } from '../../services/formService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function FormBuilderPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(false)

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
      setFields(form.fields || [])
    } catch (error) {
      toast.error(error.message)
    }
  }

  const loadTemplates = async () => {
    try {
      const all = await getForms()
      // is_template: true যেগুলো
      setTemplates(all.filter(f => f.is_template))
    } catch (error) {
      console.error(error)
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) { toast.error('Template নাম লিখুন!'); return }
    if (fields.length === 0) { toast.error('কমপক্ষে একটি field যোগ করুন!'); return }
    try {
      await createForm({
        title: templateName,
        description: formDescription,
        fields: fields,
        is_active: false,
        is_template: true,
        created_by: profile.id,
      })
      toast.success(`"${templateName}" template সেভ হয়েছে!`)
      setShowSaveTemplateModal(false)
      setTemplateName('')
      loadTemplates()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleLoadTemplate = (template) => {
    if (fields.length > 0) {
      if (!window.confirm('বর্তমান fields মুছে template load করবেন?')) return
    }
    setFields(template.fields?.map(f => ({
      ...f,
      id: Date.now().toString() + Math.random(),
      children: (f.children || []).map(c => ({ ...c, id: Date.now().toString() + Math.random() }))
    })) || [])
    if (!formTitle) setFormTitle(template.title.replace(' (Template)', ''))
    toast.success(`"${template.title}" template load হয়েছে!`)
    setShowTemplateModal(false)
  }

  const addField = () => {
    setFields([...fields, {
      id: Date.now().toString(),
      label: '',
      type: 'both',
      required: false,
      children: []
    }])
  }

  const addSubField = (parentId) => {
    setFields(fields.map(f => f.id === parentId ? {
      ...f,
      children: [...f.children, {
        id: Date.now().toString(),
        label: '',
        type: 'both',
        required: false,
      }]
    } : f))
  }

  const updateField = (id, key, value) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f))
  }

  const updateSubField = (parentId, childId, key, value) => {
    setFields(fields.map(f => f.id === parentId ? {
      ...f,
      children: f.children.map(c => c.id === childId ? { ...c, [key]: value } : c)
    } : f))
  }

  const removeField = (id) => setFields(fields.filter(f => f.id !== id))

  const removeSubField = (parentId, childId) => {
    setFields(fields.map(f => f.id === parentId ? {
      ...f,
      children: f.children.filter(c => c.id !== childId)
    } : f))
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
        title: formTitle,
        description: formDescription,
        fields: fields,
        is_active: true,
        created_by: profile.id,
      }
      if (editId) await updateForm(editId, formData)
      else await createForm(formData)
      toast.success(editId ? 'Form updated!' : 'Form created!')
      navigate('/forms')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">
          {editId ? 'Edit Form' : 'Form Builder'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          {/* Template buttons */}
          {!editId && (
            <>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition text-sm font-medium"
              >
                📋 Template থেকে শুরু
              </button>
              {fields.length > 0 && (
                <button
                  onClick={() => { setTemplateName(formTitle ? `${formTitle} (Template)` : ''); setShowSaveTemplateModal(true) }}
                  className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                >
                  💾 Template হিসেবে সেভ
                </button>
              )}
            </>
          )}
          <button onClick={() => navigate('/forms')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </div>

      {/* Form Details */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Form Title *</label>
          <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter form title" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter form description" rows={2} />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
            <div className="flex gap-3 items-start">
              <div className="flex flex-col gap-1">
                <button onClick={() => moveField(index, 'up')} className="text-gray-400 hover:text-gray-600 text-xs">▲</button>
                <button onClick={() => moveField(index, 'down')} className="text-gray-400 hover:text-gray-600 text-xs">▼</button>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <input type="text" value={field.label}
                    onChange={e => updateField(field.id, 'label', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Field label" />
                  <select value={field.type} onChange={e => updateField(field.id, 'type', e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="both">সংখ্যা + পরিমাণ</option>
                    <option value="count">সংখ্যা only</option>
                    <option value="amount">পরিমাণ only</option>
                  </select>
                </div>

                {field.children?.map(child => (
                  <div key={child.id} className="ml-6 flex gap-3 items-center border-l-2 border-gray-200 pl-4">
                    <input type="text" value={child.label}
                      onChange={e => updateSubField(field.id, child.id, 'label', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Sub field label" />
                    <select value={child.type}
                      onChange={e => updateSubField(field.id, child.id, 'type', e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="both">সংখ্যা + পরিমাণ</option>
                      <option value="count">সংখ্যা only</option>
                      <option value="amount">পরিমাণ only</option>
                    </select>
                    <button onClick={() => removeSubField(field.id, child.id)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                ))}

                <button onClick={() => addSubField(field.id)} className="text-sm text-blue-600 hover:underline">
                  + Add Sub Field
                </button>
              </div>
              <button onClick={() => removeField(field.id)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
            </div>
          </div>
        ))}

        <button onClick={addField}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition">
          + Add Field
        </button>
      </div>

      {/* Template Load Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">📋 Template থেকে শুরু করুন</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p>কোনো template সেভ নেই।</p>
                  <p className="text-sm mt-1">প্রথমে একটি form তৈরি করে "Template হিসেবে সেভ" করুন।</p>
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
                        Load করুন
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
              <h2 className="text-lg font-bold text-gray-800">💾 Template হিসেবে সেভ করুন</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template নাম *</label>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Template এর নাম লিখুন" autoFocus />
              </div>
              <p className="text-xs text-gray-500">
                এই template পরবর্তীতে নতুন form তৈরিতে ব্যবহার করা যাবে। Template টি form list এ inactive অবস্থায় সেভ হবে।
              </p>
              <div className="flex gap-3">
                <button onClick={handleSaveAsTemplate}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition text-sm font-medium">
                  💾 সেভ করুন
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