import { useState, useEffect } from 'react'
import { getReportLayouts, getReportLayoutById, deleteReportLayout } from '../../services/reportService'
import { getSubmissionsForReport } from '../../services/reportService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ROLES } from '../../constants/roles'
import toast from 'react-hot-toast'

export default function ReportViewPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [layouts, setLayouts] = useState([])
  const [selectedLayout, setSelectedLayout] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => { loadLayouts() }, [])

  const loadLayouts = async () => {
    try {
      const data = await getReportLayouts(profile.id)
      setLayouts(data)
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleSelectLayout = async (layout) => {
    setSelectedLayout(layout)
    loadReport(layout, filters)
  }

  const loadReport = async (layout, f) => {
    setLoading(true)
    try {
      const data = await getSubmissionsForReport(layout.layout?.formId, f)
      setSubmissions(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return
    try {
      await deleteReportLayout(id)
      toast.success('Report deleted!')
      loadLayouts()
      setSelectedLayout(null)
    } catch (error) {
      toast.error(error.message)
    }
  }

  const calculateValue = (row) => {
    if (!submissions.length) return 0
    const values = submissions.map(s => parseFloat(s.data?.[row.fieldId] || 0))
    if (row.calcType === 'sum') return values.reduce((a, b) => a + b, 0)
    if (row.calcType === 'average') return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
    if (row.calcType === 'percentage') return ((values.filter(v => v > 0).length / values.length) * 100).toFixed(2) + '%'
    return values.reduce((a, b) => a + b, 0)
  }

  const isAdmin = profile?.role === ROLES.ADMIN

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        {isAdmin && (
          <button
            onClick={() => navigate('/reports/builder')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            + New Report
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report List */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Report Layouts</h2>
          <div className="space-y-2">
            {layouts.length === 0 ? (
              <p className="text-sm text-gray-500">No reports found.</p>
            ) : (
              layouts.map(layout => (
                <div
                  key={layout.id}
                  className={`p-3 rounded-lg cursor-pointer border transition ${
                    selectedLayout?.id === layout.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => handleSelectLayout(layout)}
                >
                  <p className="font-medium text-sm text-gray-800">{layout.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {layout.is_shared ? '🌐 Shared' : '🔒 Private'}
                  </p>
                  {isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/reports/builder?edit=${layout.id}`) }}
                        className="text-xs text-blue-600 hover:underline"
                      >Edit</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(layout.id) }}
                        className="text-xs text-red-600 hover:underline"
                      >Delete</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Report View */}
        <div className="lg:col-span-2">
          {selectedLayout ? (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-white rounded-lg p-4 shadow-sm flex gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => loadReport(selectedLayout, filters)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Apply
                </button>
              </div>

              {/* Report Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800">{selectedLayout.title}</h2>
                  <p className="text-sm text-gray-500">
                    {filters.startDate} to {filters.endDate} | {submissions.length} submissions
                  </p>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calculation</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedLayout.layout?.rows?.map(row => (
                        <tr key={row.id} className={row.type === 'subtotal' ? 'bg-yellow-50 font-semibold' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-3 text-sm text-gray-800">{row.label}</td>
                          <td className="px-6 py-3 text-sm text-gray-500 capitalize">{row.calcType}</td>
                          <td className="px-6 py-3 text-sm text-gray-800 text-right">{calculateValue(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              Select a report layout from the left to view data.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}