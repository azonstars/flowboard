import { useState, useEffect } from 'react'
import { createForm, updateForm, getFormById } from '../../services/formService'
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

  useEffect(() => {
    if (editId) loadForm()
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

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id))
  }

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
    if (!formTitle.trim()) {
      toast.error('Form title is required!')
      return
    }
    if (fields.length === 0) {
      toast.error('Add at least one field!')
      return
    }
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
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">
          {editId ? 'Edit Form' : 'Form Builder'}
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/forms')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </div>

      {/* Form Details */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Form Title *</label>
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter form title"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter form description"
            rows={2}
          />
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
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => updateField(field.id, 'label', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Field label"
                  />
                  <select
                    value={field.type}
                    onChange={e => updateField(field.id, 'type', e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="both">সংখ্যা + পরিমাণ</option>
                    <option value="count">সংখ্যা only</option>
                    <option value="amount">পরিমাণ only</option>
                  </select>
                </div>

                {/* Sub Fields */}
                {field.children?.map(child => (
                  <div key={child.id} className="ml-6 flex gap-3 items-center border-l-2 border-gray-200 pl-4">
                    <input
                      type="text"
                      value={child.label}
                      onChange={e => updateSubField(field.id, child.id, 'label', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Sub field label"
                    />
                    <select
                      value={child.type}
                      onChange={e => updateSubField(field.id, child.id, 'type', e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="both">সংখ্যা + পরিমাণ</option>
                      <option value="count">সংখ্যা only</option>
                      <option value="amount">পরিমাণ only</option>
                    </select>
                    <button
                      onClick={() => removeSubField(field.id, child.id)}
                      className="text-red-500 hover:text-red-700"
                    >✕</button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <button
                    onClick={() => addSubField(field.id)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Add Sub Field
                  </button>
                </div>
              </div>

              <button
                onClick={() => removeField(field.id)}
                className="text-red-500 hover:text-red-700 font-bold"
              >✕</button>
            </div>
          </div>
        ))}

        <button
          onClick={addField}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition"
        >
          + Add Field
        </button>
      </div>
    </div>
  )
}