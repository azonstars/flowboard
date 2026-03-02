import { useState, useEffect } from 'react'
import { getFormById, submitForm, getTodaySubmission } from '../../services/formService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function FormSubmitPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { formId } = useParams()
  const [form, setForm] = useState(null)
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState(null)

  useEffect(() => { loadForm() }, [formId])

  const loadForm = async () => {
    try {
      const [f, existing] = await Promise.all([
        getFormById(formId),
        getTodaySubmission(formId, profile?.branch_code)
      ])
      setForm(f)
      setExisting(existing)
      if (existing) setFormData(existing.data || {})
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleChange = (fieldId, subFieldId, type, value) => {
    const key = subFieldId ? `${fieldId}_${subFieldId}_${type}` : `${fieldId}_${type}`
    setFormData({ ...formData, [key]: value })
  }

  const handleSubmit = async (status) => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await submitForm({
        form_id: formId,
        branch_code: profile?.branch_code,
        submitted_by: profile?.id,
        submission_date: today,
        data: formData,
        status: status,
      })
      toast.success(status === 'submitted' ? 'Form submitted!' : 'Draft saved!')
      navigate('/forms')
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
        {existing && (
          <span className={`px-3 py-1 rounded-full text-sm ${
            existing.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {existing.status === 'submitted' ? 'Submitted' : 'Draft'}
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Branch: <strong>{profile?.branch_code}</strong> |
            Date: <strong>{new Date().toLocaleDateString('bn-BD')}</strong>
          </p>
        </div>

        <div className="space-y-6">
          {form.fields?.map(field => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-3">{field.label}</h3>

              <div className="grid grid-cols-2 gap-4 mb-3">
                {(field.type === 'both' || field.type === 'count') && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">সংখ্যা</label>
                    <input
                      type="number"
                      value={formData[`${field.id}_count`] || ''}
                      onChange={e => handleChange(field.id, null, 'count', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                )}
                {(field.type === 'both' || field.type === 'amount') && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">পরিমাণ</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData[`${field.id}_amount`] || ''}
                      onChange={e => handleChange(field.id, null, 'amount', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              {field.children?.map(child => (
                <div key={child.id} className="ml-4 border-l-2 border-gray-200 pl-4 mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{child.label}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(child.type === 'both' || child.type === 'count') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">সংখ্যা</label>
                        <input
                          type="number"
                          value={formData[`${field.id}_${child.id}_count`] || ''}
                          onChange={e => handleChange(field.id, child.id, 'count', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="0"
                        />
                      </div>
                    )}
                    {(child.type === 'both' || child.type === 'amount') && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">পরিমাণ</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData[`${field.id}_${child.id}_amount`] || ''}
                          onChange={e => handleChange(field.id, child.id, 'amount', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => handleSubmit('draft')}
            disabled={loading}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit('submitted')}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
          <button
            onClick={() => navigate('/forms')}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}