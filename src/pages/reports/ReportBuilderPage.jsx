import { useState, useEffect } from 'react'
import { createReportLayout, updateReportLayout, getReportLayoutById } from '../../services/reportService'
import { getForms } from '../../services/formService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

const CALC_TYPES = ['sum', 'average', 'percentage', 'subtotal']

export default function ReportBuilderPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [title, setTitle] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState('')
  const [formFields, setFormFields] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadForms()
    if (editId) loadLayout()
  }, [editId])

  const loadForms = async () => {
    try {
      const data = await getForms()
      setForms(data)
    } catch (error) {
      toast.error(error.message)
    }
  }

  const loadLayout = async () => {
    try {
      const layout = await getReportLayoutById(editId)
      setTitle(layout.title)
      setIsShared(layout.is_shared)
      setSelectedForm(layout.layout?.formId || '')
      setRows(layout.layout?.rows || [])
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleFormSelect = (formId) => {
    setSelectedForm(formId)
    const form = forms.find(f => f.id === formId)
    if (!form) return
    const allFields = []
    form.fields?.forEach(field => {
      if (field.type === 'both' || field.type === 'count') {
        allFields.push({ id: `${field.id}_count`, label: `${field.label} (সংখ্যা)` })
      }
      if (field.type === 'both' || field.type === 'amount') {
        allFields.push({ id: `${field.id}_amount`, label: `${field.label} (পরিমাণ)` })
      }
      field.children?.forEach(child => {
        if (child.type === 'both' || child.type === 'count') {
          allFields.push({ id: `${field.id}_${child.id}_count`, label: `${field.label} > ${child.label} (সংখ্যা)` })
        }
        if (child.type === 'both' || child.type === 'amount') {
          allFields.push({ id: `${field.id}_${child.id}_amount`, label: `${field.label} > ${child.label} (পরিমাণ)` })
        }
      })
    })
    setFormFields(allFields)
  }

  const addRow = (type = 'field') => {
    setRows([...rows, {
      id: Date.now().toString(),
      type,
      label: '',
      fieldId: '',
      calcType: 'sum',
      selectedFields: [],
    }])
  }

  const updateRow = (id, key, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [key]: value } : r))
  }

  const removeRow = (id) => {
    setRows(rows.filter(r => r.id !== id))
  }

  const moveRow = (index, direction) => {
    const newRows = [...rows]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newRows.length) return
    ;[newRows[index], newRows[swapIndex]] = [newRows[swapIndex], newRows[index]]
    setRows(newRows)
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required!'); return }
    if (!selectedForm) { toast.error('Select a form!'); return }
    if (rows.length === 0) { toast.error('Add at least one row!'); return }
    setLoading(true)
    try {
      const layoutData = {
        title,
        is_shared: isShared,
        created_by: profile.id,
        layout: { formId: selectedForm, rows },
        calculation_config: {},
      }
      if (editId) await updateReportLayout(editId, layoutData)
      else await createReportLayout(layoutData)
      toast.success(editId ? 'Report updated!' : 'Report created!')
      navigate('/reports')
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
          {editId ? 'Edit Report' : 'Report Builder'}
        </h1>
        <div className="flex gap-3">
          <button onClick={() => navigate('/reports')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Report'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter report title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Form *</label>
            <select
              value={selectedForm}
              onChange={e => handleFormSelect(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a form</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isShared"
            checked={isShared}
            onChange={e => setIsShared(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="isShared" className="text-sm text-gray-700">Share with all users</label>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${row.type === 'subtotal' ? 'border-yellow-500' : 'border-primary-500'}`}>
            <div className="flex gap-3 items-center">
              <div className="flex flex-col gap-1">
                <button onClick={() => moveRow(index, 'up')} className="text-gray-400 hover:text-gray-600 text-xs">▲</button>
                <button onClick={() => moveRow(index, 'down')} className="text-gray-400 hover:text-gray-600 text-xs">▼</button>
              </div>

              <div className="flex-1 grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Row Type</label>
                  <select
                    value={row.type}
                    onChange={e => updateRow(row.id, 'type', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="field">Field</option>
                    <option value="subtotal">Subtotal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Label</label>
                  <input
                    type="text"
                    value={row.label}
                    onChange={e => updateRow(row.id, 'label', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Row label"
                  />
                </div>

                {row.type === 'field' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Field</label>
                    <select
                      value={row.fieldId}
                      onChange={e => updateRow(row.id, 'fieldId', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select field</option>
                      {formFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Calculation</label>
                  <select
                    value={row.calcType}
                    onChange={e => updateRow(row.id, 'calcType', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {CALC_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <button
            onClick={() => addRow('field')}
            className="flex-1 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 transition"
          >
            + Add Field Row
          </button>
          <button
            onClick={() => addRow('subtotal')}
            className="flex-1 py-3 border-2 border-dashed border-yellow-300 rounded-lg text-yellow-500 hover:border-yellow-500 hover:text-yellow-600 transition"
          >
            + Add Subtotal Row
          </button>
        </div>
      </div>
    </div>
  )
}