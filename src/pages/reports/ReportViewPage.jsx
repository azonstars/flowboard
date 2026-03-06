import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getReportLayouts, deleteReportLayout, getSubmissionsForReport } from '../../services/reportService'
import { getDivisions, getRegions, getBranches } from '../../services/branchService'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ROLES } from '../../constants/roles'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ReportViewPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [layouts, setLayouts] = useState([])
  const [selectedLayout, setSelectedLayout] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [divisions, setDivisions] = useState([])
  const [regions, setRegions] = useState([])
  const [allBranches, setAllBranches] = useState([])
  const [filteredRegions, setFilteredRegions] = useState([])
  const [filteredBranches, setFilteredBranches] = useState([])

  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    division_id: '',
    region_id: '',
    branch_code: '',
  })

  const isAdmin = profile?.role === ROLES.ADMIN
  const isCentral = profile?.role === ROLES.CENTRAL_CHECKER
  const isDivisional = profile?.role === ROLES.DIVISIONAL_CHECKER
  const isRegional = profile?.role === ROLES.REGIONAL_CHECKER

  const [searchParams] = useSearchParams()
  const reportIdFromUrl = searchParams.get('report_id')

  useEffect(() => { loadLayouts(); loadHierarchy() }, [])

  // URL থেকে report_id আসলে auto-select করো
  useEffect(() => {
    if (reportIdFromUrl && layouts.length > 0) {
      const found = layouts.find(l => l.id === reportIdFromUrl)
      if (found) handleSelectLayout(found)
    }
  }, [reportIdFromUrl, layouts])

  const loadHierarchy = async () => {
    try {
      const [d, r, b] = await Promise.all([getDivisions(), getRegions(), getBranches()])
      setDivisions(d); setRegions(r); setAllBranches(b)
      if (isDivisional && profile?.division_id) {
        setFilteredRegions(r.filter(reg => reg.division_id === profile.division_id))
        setFilteredBranches(b.filter(br => br.division_id === profile.division_id))
        setFilters(prev => ({ ...prev, division_id: profile.division_id }))
      } else if (isRegional && profile?.region_id) {
        setFilteredBranches(b.filter(br => br.region_id === profile.region_id))
        setFilters(prev => ({ ...prev, region_id: profile.region_id }))
      } else {
        setFilteredRegions(r); setFilteredBranches(b)
      }
    } catch (error) { console.error(error) }
  }

  const loadLayouts = async () => {
    try {
      const data = await getReportLayouts(profile.id)
      setLayouts(data)
    } catch (error) { toast.error(error.message) }
  }

  const handleDivisionChange = (divisionId) => {
    setFilters({ ...filters, division_id: divisionId, region_id: '', branch_code: '' })
    if (divisionId) {
      setFilteredRegions(regions.filter(r => r.division_id === divisionId))
      setFilteredBranches(allBranches.filter(b => b.division_id === divisionId))
    } else { setFilteredRegions(regions); setFilteredBranches(allBranches) }
  }

  const handleRegionChange = (regionId) => {
    setFilters({ ...filters, region_id: regionId, branch_code: '' })
    if (regionId) setFilteredBranches(allBranches.filter(b => b.region_id === regionId))
    else if (filters.division_id) setFilteredBranches(allBranches.filter(b => b.division_id === filters.division_id))
    else setFilteredBranches(allBranches)
  }

  const handleSelectLayout = (layout) => { setSelectedLayout(layout); loadReport(layout, filters) }

  const loadReport = async (layout, f) => {
    setLoading(true)
    try {
      const data = await getSubmissionsForReport(layout.layout?.formId, { startDate: f.startDate, endDate: f.endDate })
      let filtered = data
      if (f.branch_code) filtered = data.filter(s => s.branch_code === f.branch_code)
      else if (f.region_id) {
        const codes = allBranches.filter(b => b.region_id === f.region_id).map(b => b.branch_code)
        filtered = data.filter(s => codes.includes(s.branch_code))
      } else if (f.division_id) {
        const codes = allBranches.filter(b => b.division_id === f.division_id).map(b => b.branch_code)
        filtered = data.filter(s => codes.includes(s.branch_code))
      }
      setSubmissions(filtered)
    } catch (error) { toast.error(error.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return
    try {
      await deleteReportLayout(id)
      toast.success('Report deleted!')
      loadLayouts(); setSelectedLayout(null)
    } catch (error) { toast.error(error.message) }
  }

  const calculateValue = (row) => {
    if (!submissions.length) return 0
    const values = submissions.map(s => parseFloat(s.data?.[row.fieldId] || 0))
    if (row.calcType === 'sum') return values.reduce((a, b) => a + b, 0)
    if (row.calcType === 'average') return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
    if (row.calcType === 'percentage') return parseFloat(((values.filter(v => v > 0).length / values.length) * 100).toFixed(2))
    return values.reduce((a, b) => a + b, 0)
  }

  const getTableRows = () => {
    return selectedLayout?.layout?.rows?.map(row => ({
      field: row.label,
      calculation: row.calcType,
      value: calculateValue(row),
    })) || []
  }

  const getFilterSummary = () => {
    const parts = []
    if (filters.division_id) { const d = divisions.find(d => d.id === filters.division_id); if (d) parts.push(d.name) }
    if (filters.region_id) { const r = regions.find(r => r.id === filters.region_id); if (r) parts.push(r.name) }
    if (filters.branch_code) { const b = allBranches.find(b => b.branch_code === filters.branch_code); if (b) parts.push(`${b.name} (${filters.branch_code})`) }
    return parts.length ? parts.join(' › ') : 'সব Branch'
  }

  // Excel Export
  const exportExcel = () => {
    setExporting(true)
    try {
      const rows = getTableRows()
      const wsData = [
        [selectedLayout.title],
        [`তারিখ: ${filters.startDate} — ${filters.endDate}`],
        [`Branch: ${getFilterSummary()}`],
        [`মোট Submissions: ${submissions.length}`],
        [],
        ['Field', 'Calculation', 'Value'],
        ...rows.map(r => [r.field, r.calculation, r.value]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Report')
      XLSX.writeFile(wb, `${selectedLayout.title}_${filters.startDate}.xlsx`)
      toast.success('Excel export সফল হয়েছে!')
    } catch (error) {
      toast.error('Export failed: ' + error.message)
    } finally { setExporting(false) }
  }

  // PDF Export
  const exportPDF = () => {
    setExporting(true)
    try {
      const doc = new jsPDF()
      const rows = getTableRows()

      // Header
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(selectedLayout.title, 14, 20)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${filters.startDate} to ${filters.endDate}`, 14, 30)
      doc.text(`Branch: ${getFilterSummary()}`, 14, 36)
      doc.text(`Total Submissions: ${submissions.length}`, 14, 42)

      // Table
      autoTable(doc, {
        startY: 50,
        head: [['Field', 'Calculation', 'Value']],
        body: rows.map(r => [r.field, r.calculation, r.value.toLocaleString()]),
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 10, cellPadding: 4 },
      })

      doc.save(`${selectedLayout.title}_${filters.startDate}.pdf`)
      toast.success('PDF export সফল হয়েছে!')
    } catch (error) {
      toast.error('Export failed: ' + error.message)
    } finally { setExporting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        {isAdmin && (
          <button onClick={() => navigate('/reports/builder')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
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
            ) : layouts.map(layout => (
              <div key={layout.id}
                className={`p-3 rounded-lg cursor-pointer border transition ${selectedLayout?.id === layout.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => handleSelectLayout(layout)}
              >
                <p className="font-medium text-sm text-gray-800">{layout.title}</p>
                <p className="text-xs text-gray-500 mt-1">{layout.is_shared ? '🌐 Shared' : '🔒 Private'}</p>
                {isAdmin && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={e => { e.stopPropagation(); navigate(`/reports/builder?edit=${layout.id}`) }} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(layout.id) }} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Report View */}
        <div className="lg:col-span-2">
          {selectedLayout ? (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-white rounded-lg p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">🔍 ফিল্টার করুন</h3>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">শুরুর তারিখ</label>
                    <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">শেষের তারিখ</label>
                    <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {(isAdmin || isCentral) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Division</label>
                      <select value={filters.division_id} onChange={e => handleDivisionChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">সব Division</option>
                        {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
                      <select value={filters.region_id} onChange={e => handleRegionChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">সব Region</option>
                        {filteredRegions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
                      <select value={filters.branch_code} onChange={e => setFilters({ ...filters, branch_code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">সব Branch</option>
                        {filteredBranches.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {isDivisional && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
                      <select value={filters.region_id} onChange={e => handleRegionChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">সব Region</option>
                        {filteredRegions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
                      <select value={filters.branch_code} onChange={e => setFilters({ ...filters, branch_code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">সব Branch</option>
                        {filteredBranches.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {isRegional && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
                    <select value={filters.branch_code} onChange={e => setFilters({ ...filters, branch_code: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">সব Branch</option>
                      {filteredBranches.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                    </select>
                  </div>
                )}

                <button onClick={() => loadReport(selectedLayout, filters)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                  🔍 Apply Filter
                </button>
              </div>

              {/* Report Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <h2 className="font-bold text-gray-800">{selectedLayout.title}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      📅 {filters.startDate} — {filters.endDate} &nbsp;|&nbsp;
                      🏢 {getFilterSummary()} &nbsp;|&nbsp;
                      📊 {submissions.length} submissions
                    </p>
                  </div>

                  {/* Export Buttons */}
                  {!loading && submissions.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={exportExcel}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        📊 Excel
                      </button>
                      <button
                        onClick={exportPDF}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                      >
                        📄 PDF
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">📭</p>
                    <p>এই ফিল্টারে কোনো data পাওয়া যায়নি</p>
                  </div>
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
                          <td className="px-6 py-3 text-sm text-gray-800 text-right font-medium">
                            {calculateValue(row).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              <p className="text-4xl mb-3">📊</p>
              <p>বাম দিক থেকে একটি Report Layout সিলেক্ট করুন</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}