import { useState, useEffect } from 'react'
import { getForms, updateForm } from '../../services/formService'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Settings() {
  const { fetchMenuForms } = useAuth()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null)

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

  const handleToggleMenu = async (form) => {
    setSaving(form.id)
    try {
      await updateForm(form.id, { show_in_menu: !form.show_in_menu })
      await fetchMenuForms()
      toast.success(`${form.title} ${!form.show_in_menu ? 'added to' : 'removed from'} menu!`)
      loadForms()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(null)
    }
  }

  const handleToggleActive = async (form) => {
    setSaving(form.id)
    try {
      await updateForm(form.id, { is_active: !form.is_active })
      toast.success(`${form.title} ${!form.is_active ? 'activated' : 'deactivated'}!`)
      loadForms()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(null)
    }
  }

  const handleMenuOrder = async (form, order) => {
    try {
      await updateForm(form.id, { menu_order: parseInt(order) })
      loadForms()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500 mt-1">Manage form visibility and menu settings.</p>
      </div>

      {/* Form Menu Settings */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 text-lg">Form Menu Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Control which forms appear in the sidebar menu for branch users.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : forms.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No forms found.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {forms.map(form => (
              <div key={form.id} className="p-6 flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{form.title}</p>
                  {form.description && (
                    <p className="text-sm text-gray-500 mt-1">{form.description}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      form.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {form.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      form.show_in_menu ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {form.show_in_menu ? '📋 In Menu' : 'Not in Menu'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  {/* Menu Order */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Order:</label>
                    <input
                      type="number"
                      defaultValue={form.menu_order || 0}
                      onBlur={e => handleMenuOrder(form, e.target.value)}
                      className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Show in Menu Toggle */}
                  <button
                    onClick={() => handleToggleMenu(form)}
                    disabled={saving === form.id}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                      form.show_in_menu
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {saving === form.id ? '...' : form.show_in_menu ? '✅ In Menu' : 'Add to Menu'}
                  </button>

                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleActive(form)}
                    disabled={saving === form.id}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                      form.is_active
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {saving === form.id ? '...' : form.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}