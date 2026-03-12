import { useState, useEffect } from 'react'
import { SkeletonTable } from '../../components/ui/Skeleton'
import {
  getDivisions, createDivision, updateDivision, deleteDivision,
  getRegions, createRegion, updateRegion, deleteRegion,
  getBranches, createBranch, updateBranch, deleteBranch
} from '../../services/branchService'
import toast from 'react-hot-toast'

export default function BranchManagement() {
  const [activeTab, setActiveTab] = useState('divisions')
  const [divisions, setDivisions] = useState([])
  const [regions, setRegions] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [formData, setFormData] = useState({})

  useEffect(() => { loadData() }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'divisions') setDivisions(await getDivisions())
      if (activeTab === 'regions') setRegions(await getRegions())
      if (activeTab === 'branches') setBranches(await getBranches())
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (item = null) => {
    setEditItem(item)
    setFormData(item || {})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditItem(null)
    setFormData({})
  }

  const handleSubmit = async () => {
    try {
      if (activeTab === 'divisions') {
        if (editItem) await updateDivision(editItem.id, formData)
        else await createDivision(formData)
      }
      if (activeTab === 'regions') {
        if (editItem) await updateRegion(editItem.id, formData)
        else await createRegion(formData)
      }
      if (activeTab === 'branches') {
        if (editItem) await updateBranch(editItem.id, formData)
        else await createBranch(formData)
      }
      toast.success(editItem ? 'Updated successfully!' : 'Created successfully!')
      closeModal()
      loadData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return
    try {
      if (activeTab === 'divisions') await deleteDivision(id)
      if (activeTab === 'regions') await deleteRegion(id)
      if (activeTab === 'branches') await deleteBranch(id)
      toast.success('Deleted successfully!')
      loadData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const tabs = ['divisions', 'regions', 'branches']

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Branch Management</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Add New
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <SkeletonTable rows={5} cols={4} />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-3 text-sm font-medium text-gray-500">Name</th>
                      <th className="pb-3 text-sm font-medium text-gray-500">Code</th>
                      {activeTab === 'regions' && <th className="pb-3 text-sm font-medium text-gray-500">Division</th>}
                      {activeTab === 'branches' && <th className="pb-3 text-sm font-medium text-gray-500">Region</th>}
                      {activeTab === 'branches' && <th className="pb-3 text-sm font-medium text-gray-500">Status</th>}
                      <th className="pb-3 text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(activeTab === 'divisions' ? divisions : activeTab === 'regions' ? regions : branches).map(item => (
                      <tr key={item.id}>
                        <td className="py-3 text-sm text-gray-800">{item.name}</td>
                        <td className="py-3 text-sm text-gray-600">{item.code || item.branch_code}</td>
                        {activeTab === 'regions' && <td className="py-3 text-sm text-gray-600">{item.divisions?.name}</td>}
                        {activeTab === 'branches' && <td className="py-3 text-sm text-gray-600">{item.regions?.name}</td>}
                        {activeTab === 'branches' && (
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        )}
                        <td className="py-3">
                          <button onClick={() => openModal(item)} className="text-blue-600 hover:underline text-sm mr-3">Edit</button>
                          <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline text-sm">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {(activeTab === 'divisions' ? divisions : activeTab === 'regions' ? regions : branches).map(item => (
                  <div key={item.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.code || item.branch_code}</p>
                      </div>
                      {activeTab === 'branches' && (
                        <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    {activeTab === 'regions' && item.divisions?.name && (
                      <p className="text-xs text-gray-500">Division: {item.divisions.name}</p>
                    )}
                    {activeTab === 'branches' && item.regions?.name && (
                      <p className="text-xs text-gray-500">Region: {item.regions.name}</p>
                    )}
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      <button onClick={() => openModal(item)}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition text-center">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(item.id)}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition text-center">
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editItem ? 'Edit' : 'Add'} {activeTab.slice(0, -1)}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'branches' ? 'Branch Code' : 'Code'}
                </label>
                <input
                  type="text"
                  value={formData.code || formData.branch_code || ''}
                  onChange={e => setFormData({
                    ...formData,
                    [activeTab === 'branches' ? 'branch_code' : 'code']: e.target.value
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {activeTab === 'regions' && (
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

              {activeTab === 'branches' && (
                <>
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
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                {editItem ? 'Update' : 'Create'}
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