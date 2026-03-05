import { useState, useEffect } from 'react'
import { getForms, deleteForm, duplicateForm } from '../../services/formService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ROLES } from '../../constants/roles'
import toast from 'react-hot-toast'

export default function FormListPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadForms() }, [])

  const loadForms = async () => {
    setLoading(true)
    try {
      const data = await getForms()
      setForms(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return
    try {
      await deleteForm(id)
      toast.success('Form deleted!')
      loadForms()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleDuplicate = async (form) => {
    if (!confirm(`"${form.title}" ফর্মটি duplicate করবেন?\nনতুন ফর্মটি Inactive অবস্থায় তৈরি হবে।`)) return
    try {
      await duplicateForm(form.id, profile.id)
      toast.success(`"${form.title} (Copy)" তৈরি হয়েছে!`)
      loadForms()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const isAdmin = profile?.role === ROLES.ADMIN
  const isBranchUser = [ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE, ROLES.ADMIN].includes(profile?.role)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Forms</h1>
        {isAdmin && (
          <button
            onClick={() => navigate('/forms/builder')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            + New Form
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : forms.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No forms found.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fields</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {forms.map(form => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{form.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{form.description || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{form.fields?.length || 0} fields</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {form.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-3">
                    {isBranchUser && (
                      <button
                        onClick={() => navigate(`/forms/submit/${form.id}`)}
                        className="text-green-600 hover:underline text-sm"
                      >
                        Submit
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => navigate(`/forms/builder?edit=${form.id}`)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDuplicate(form)}
                          className="text-purple-600 hover:underline text-sm"
                        >
                          📋 Copy
                        </button>
                        <button
                          onClick={() => handleDelete(form.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}