import { useState, useEffect } from 'react'
import { getUsers, updateUser, toggleUserStatus } from '../../services/userService'
import { getDivisions, getRegions, getBranches } from '../../services/branchService'
import { ROLE_LABELS } from '../../constants/roles'
import toast from 'react-hot-toast'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [divisions, setDivisions] = useState([])
  const [regions, setRegions] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [formData, setFormData] = useState({})
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [u, d, r, b] = await Promise.all([
        getUsers(), getDivisions(), getRegions(), getBranches()
      ])
      setUsers(u)
      setDivisions(d)
      setRegions(r)
      setBranches(b)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (user) => {
    setEditUser(user)
    setFormData({
      full_name: user.full_name,
      role: user.role,
      branch_code: user.branch_code || '',
      division_id: user.division_id || '',
      region_id: user.region_id || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditUser(null)
    setFormData({})
  }

  const handleSubmit = async () => {
    try {
      await updateUser(editUser.id, formData)
      toast.success('User updated successfully!')
      closeModal()
      loadData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleToggleStatus = async (user) => {
    try {
      await toggleUserStatus(user.id, !user.is_active)
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}!`)
      loadData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const isBranchUser = ['branch_manager', 'branch_employee'].includes(formData.role)
  const isDivisionalChecker = formData.role === 'divisional_checker'
  const isRegionalChecker = formData.role === 'regional_checker'

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{user.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.branch_code || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-3">
                    <button onClick={() => openModal(user)} className="text-blue-600 hover:underline text-sm">Edit</button>
                    <button onClick={() => handleToggleStatus(user)} className={`text-sm hover:underline ${user.is_active ? 'text-red-600' : 'text-green-600'}`}>
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
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
            <h2 className="text-lg font-bold text-gray-800 mb-4">Edit User</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role || ''}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {isBranchUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code</label>
                  <select
                    value={formData.branch_code || ''}
                    onChange={e => setFormData({ ...formData, branch_code: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                  </select>
                </div>
              )}

              {isDivisionalChecker && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    value={formData.division_id || ''}
                    onChange={e => setFormData({ ...formData, division_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Division</option>
                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              {isRegionalChecker && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                  <select
                    value={formData.region_id || ''}
                    onChange={e => setFormData({ ...formData, region_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Region</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Update
              </button>
              <button
                onClick={closeModal}
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