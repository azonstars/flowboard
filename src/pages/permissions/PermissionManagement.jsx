import { useState, useEffect } from 'react'
import { getPermissions, createPermission, revokePermission } from '../../services/permissionService'
import { getBranches } from '../../services/branchService'
import { getForms } from '../../services/formService'
import { getUsersByRole } from '../../services/userService'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function PermissionManagement() {
  const { profile } = useAuth()
  const [permissions, setPermissions] = useState([])
  const [branches, setBranches] = useState([])
  const [forms, setForms] = useState([])
  const [managers, setManagers] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    branch_code: '',
    form_id: '',
    manager_id: '',
    employee_id: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [p, b, f, m, e] = await Promise.all([
        getPermissions(profile.id),
        getBranches(),
        getForms(),
        getUsersByRole('branch_manager'),
        getUsersByRole('branch_employee'),
      ])
      setPermissions(p)
      setBranches(b)
      setForms(f)
      setManagers(m)
      setEmployees(e)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.branch_code) { toast.error('Select a branch!'); return }
    if (!formData.manager_id && !formData.employee_id) { toast.error('Select manager or employee!'); return }
    try {
      await createPermission({
        ...formData,
        granted_by: profile.id,
        is_active: true,
        is_edited: false,
      })
      toast.success('Permission granted!')
      setModalOpen(false)
      setFormData({
        branch_code: '',
        form_id: '',
        manager_id: '',
        employee_id: '',
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: '',
      })
      loadData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this permission?')) return
    try {
      await revokePermission(id)
      toast.success('Permission revoked!')
      loadData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Permission Management</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Grant Permission
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No permissions found.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Until</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Edited</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {permissions.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">{p.branch_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.valid_from}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.valid_until || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${p.is_edited ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {p.is_edited ? '✅ Done' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {p.is_active && (
                      <button
                        onClick={() => handleRevoke(p.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Grant Edit Permission</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select
                  value={formData.branch_code}
                  onChange={e => setFormData({ ...formData, branch_code: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Form (Optional)</label>
                <select
                  value={formData.form_id}
                  onChange={e => setFormData({ ...formData, form_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Forms</option>
                  {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Manager</label>
                <select
                  value={formData.manager_id}
                  onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Manager</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Employee</label>
                <select
                  value={formData.employee_id}
                  onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Grant Permission
              </button>
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}