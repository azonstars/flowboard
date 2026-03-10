import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ROLES } from '../../constants/roles'
import { getAdvancedReportTemplates } from '../../services/advancedReportService'
import { getDivisions, getRegions, getBranches } from '../../services/branchService'
import { getProfiles } from '../../services/profileService'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export default function AdvancedReportViewer() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const isAdmin = profile?.role === ROLES.ADMIN
  const isCentral = profile?.role === ROLES.CENTRAL_CHECKER
  const isDivisional = profile?.role === ROLES.DIVISIONAL_CHECKER
  const isRegional = profile?.role === ROLES.REGIONAL_CHECKER
  const isBranch = [ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE].includes(profile?.role)

  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [allDivisions, setAllDivisions] = useState([])
  const [allRegions, setAllRegions] = useState([])
  const [allBranches, setAllBranches] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)
  const [filterDivision, setFilterDivision] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterBranch, setFilterBranch] = useState('')

  useEffect(() => { loadInit() }, [])

  const loadInit = async () => {
    try {
      const [tmpl, divs, regs, brs] = await Promise.all([
        getAdvancedReportTemplates(),
        getDivisions(), getRegions(), getBranches()
      ])
      setTemplates(tmpl)
      setAllDivisions(divs); setAllRegions(regs); setAllBranches(brs)

      // branch users load করো
      try {
        const { data } = await supabase.from('profiles').select('id,full_name,branch_code,role').in('role', ['branch_manager','branch_employee'])
        setAllUsers(data || [])
      } catch(e) {}
    } catch(e) { console.error(e) }
  }

  const handleSelectTemplate = (t) => {
    setSelectedTemplate(t)
    setSubmissions([])
  }

  const loadReport = async () => {
    if (!selectedTemplate) return
    setLoading(true)
    try {
      // role অনুযায়ী allowed branch codes
      let allowedCodes = allBranches.map(b => b.branch_code)
      if (isDivisional && profile.division_id)
        allowedCodes = allBranches.filter(b => b.division_id === profile.division_id).map(b => b.branch_code)
      else if (isRegional && profile.region_id)
        allowedCodes = allBranches.filter(b => b.region_id === profile.region_id).map(b => b.branch_code)
      else if (isBranch && profile.branch_code)
        allowedCodes = [profile.branch_code]

      // additional filter
      if (filterBranch) allowedCodes = [filterBranch]
      else if (filterRegion) allowedCodes = allBranches.filter(b => b.region_id === filterRegion).map(b => b.branch_code)
      else if (filterDivision) allowedCodes = allBranches.filter(b => b.division_id === filterDivision).map(b => b.branch_code)

      let query = supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', selectedTemplate.form_id)
        .in('status', ['approved', 'submitted'])
        .gte('submission_date', dateFrom)
        .lte('submission_date', dateTo)
        .in('branch_code', allowedCodes)

      const { data, error } = await query
      if (error) throw error
      setSubmissions(data || [])
    } catch(e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  // সব columns flat list
  const allCols = useMemo(() =>
    (selectedTemplate?.column_groups || []).flatMap(g => g.columns), [selectedTemplate])

  // একটি submission list থেকে column value বের করো
  const calcVal = (subs, col) => {
    if (col.calcType === 'percent') return null // পরে calculate
    const vals = subs.map(s => parseFloat(s.data?.[col.fieldId]) || 0)
    if (!vals.length) return 0
    switch(col.calcType) {
      case 'sum': return vals.reduce((a,b)=>a+b,0)
      case 'average': return parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2))
      case 'count': return vals.filter(v=>v>0).length
      case 'latest': return vals[0]||0
      default: return vals.reduce((a,b)=>a+b,0)
    }
  }

  const calcPercent = (rowData, col) => {
    const num = rowData[col.numeratorColId]
    const den = rowData[col.denominatorColId]
    if (!den) return 0
    return parseFloat(((num/den)*100).toFixed(2))
  }

  // Row data build করো
  const buildRowData = (subs, rowLabel) => {
    const rowData = { label: rowLabel }
    for (const col of allCols) {
      if (col.calcType !== 'percent') rowData[col.id] = calcVal(subs, col)
    }
    for (const col of allCols) {
      if (col.calcType === 'percent') rowData[col.id] = calcPercent(rowData, col)
    }
    return rowData
  }

  // TABLE ROWS — role + filter অনুযায়ী
  const tableRows = useMemo(() => {
    if (!selectedTemplate || !submissions.length) return []
    const rows = []

    if (selectedTemplate.type === 'branch_wise') {
      // কোন level দেখাবো?
      const showUserLevel = isBranch || filterBranch
      const showBranchLevel = isRegional || filterRegion || (isDivisional && filterBranch) || (isAdmin && filterBranch)
      const showRegionLevel = isDivisional || (isAdmin && filterRegion && !filterBranch) || (isCentral && filterRegion)
      const showDivisionLevel = (isAdmin || isCentral) && !filterRegion && !filterBranch

      if (showUserLevel) {
        // ইউজার-ভিত্তিক rows
        const branchCode = filterBranch || profile.branch_code
        const branchUsers = allUsers.filter(u => u.branch_code === branchCode)
        for (const user of branchUsers) {
          const userSubs = submissions.filter(s => s.submitted_by === user.id)
          rows.push({ ...buildRowData(userSubs, user.full_name || 'User'), type: 'data' })
        }
        // Unmatched
        const matchedIds = branchUsers.map(u => u.id)
        const unmatched = submissions.filter(s => !matchedIds.includes(s.submitted_by))
        if (unmatched.length) rows.push({ ...buildRowData(unmatched, 'অন্যান্য'), type: 'data' })

      } else if (showBranchLevel) {
        // শাখা-ভিত্তিক rows
        const regionId = filterRegion || profile.region_id
        const branches = filterRegion
          ? allBranches.filter(b => b.region_id === filterRegion)
          : filterDivision
          ? allBranches.filter(b => b.division_id === filterDivision)
          : isRegional
          ? allBranches.filter(b => b.region_id === profile.region_id)
          : allBranches

        for (const br of branches) {
          const brSubs = submissions.filter(s => s.branch_code === br.branch_code)
          rows.push({ ...buildRowData(brSubs, br.name || br.branch_code), type: 'data' })
        }

      } else if (showRegionLevel) {
        // অঞ্চল-ভিত্তিক rows
        const regions = filterDivision
          ? allRegions.filter(r => r.division_id === filterDivision)
          : isDivisional
          ? allRegions.filter(r => r.division_id === profile.division_id)
          : allRegions

        for (const reg of regions) {
          const regBrCodes = allBranches.filter(b => b.region_id === reg.id).map(b => b.branch_code)
          const regSubs = submissions.filter(s => regBrCodes.includes(s.branch_code))
          rows.push({ ...buildRowData(regSubs, reg.name || 'অঞ্চল'), type: 'data' })
        }

      } else {
        // Division-ভিত্তিক rows (admin/central default)
        for (const div of allDivisions) {
          const divBrCodes = allBranches.filter(b => b.division_id === div.id).map(b => b.branch_code)
          const divSubs = submissions.filter(s => divBrCodes.includes(s.branch_code))
          rows.push({ ...buildRowData(divSubs, div.name || 'বিভাগ'), type: 'data' })
        }
      }

      // মোট row
      if (rows.length > 0) {
        rows.push({ ...buildRowData(submissions, 'সর্বমোট'), type: 'total' })
      }

    } else {
      // Category-wise rows
      const rowsConfig = selectedTemplate.rows_config || []
      for (const rowCfg of rowsConfig) {
        if (rowCfg.isTotal) {
          // isTotal row: data rows এর sum
          const dataRows = rows.filter(r => r.type === 'data')
          const totalData = { label: rowCfg.label || 'মোট', type: 'total' }
          for (const col of allCols) {
            if (col.calcType !== 'percent') {
              totalData[col.id] = dataRows.reduce((sum, r) => sum + (r[col.id] || 0), 0)
            }
          }
          for (const col of allCols) {
            if (col.calcType === 'percent') totalData[col.id] = calcPercent(totalData, col)
          }
          rows.push(totalData)
        } else {
          // Regular category row
          const rowObj = { label: rowCfg.label, type: 'data', level: rowCfg.level || 0 }
          for (const col of allCols) {
            if (col.calcType !== 'percent') {
              const fieldId = rowCfg.fieldMappings?.[col.id] || col.fieldId
              rowObj[col.id] = calcVal(submissions, { ...col, fieldId })
            }
          }
          for (const col of allCols) {
            if (col.calcType === 'percent') rowObj[col.id] = calcPercent(rowObj, col)
          }
          rows.push(rowObj)
        }
      }
    }

    return rows
  }, [selectedTemplate, submissions, allCols, filterBranch, filterRegion, filterDivision, allBranches, allRegions, allDivisions, allUsers])

  // Role অনুযায়ী কোন filter দেখাবো
  const visibleDivisions = isAdmin || isCentral ? allDivisions
    : isDivisional ? allDivisions.filter(d => d.id === profile.division_id) : []
  const visibleRegions = filterDivision
    ? allRegions.filter(r => r.division_id === filterDivision)
    : isAdmin || isCentral ? allRegions
    : isDivisional ? allRegions.filter(r => r.division_id === profile.division_id)
    : isRegional ? allRegions.filter(r => r.id === profile.region_id) : []
  const visibleBranches = filterRegion
    ? allBranches.filter(b => b.region_id === filterRegion)
    : filterDivision ? allBranches.filter(b => b.division_id === filterDivision)
    : isDivisional ? allBranches.filter(b => b.division_id === profile.division_id)
    : isRegional ? allBranches.filter(b => b.region_id === profile.region_id)
    : isBranch ? allBranches.filter(b => b.branch_code === profile.branch_code) : allBranches

  // Excel Export
  const exportExcel = () => {
    if (!selectedTemplate || !tableRows.length) return
    const wb = XLSX.utils.book_new()
    const wsData = []

    // Title row
    wsData.push([selectedTemplate.title])
    wsData.push([`তারিখ: ${dateFrom} — ${dateTo}`])
    wsData.push([])

    // Headers row 1 (group names)
    const h1 = ['নাম']
    for (const g of selectedTemplate.column_groups) {
      h1.push(g.label)
      for (let i = 1; i < g.columns.length; i++) h1.push('')
    }
    wsData.push(h1)

    // Headers row 2 (column names)
    const h2 = ['']
    for (const g of selectedTemplate.column_groups)
      for (const c of g.columns) h2.push(c.label)
    wsData.push(h2)

    // Data rows
    for (const row of tableRows) {
      const r = [row.label]
      for (const col of allCols) r.push(row[col.id] ?? '')
      wsData.push(r)
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, `${selectedTemplate.title}_${dateFrom}.xlsx`)
    toast.success('Excel export হয়েছে!')
  }

  const fmtNum = (v) => {
    if (v === null || v === undefined || v === '') return '—'
    return parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">📊 Advanced Reports</h1>
        {isAdmin && (
          <button onClick={() => navigate('/advanced-reports/builder')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            + New Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Template List */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <h2 className="font-semibold text-gray-700 text-sm mb-3">📋 Templates</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">কোনো template নেই</p>
          ) : templates.map(t => (
            <div key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className={`p-3 rounded-lg cursor-pointer border transition text-sm ${selectedTemplate?.id === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
              <p className="font-medium text-gray-800">{t.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.type === 'branch_wise' ? '🏢 Branch-wise' : '📋 Category-wise'}</p>
              {isAdmin && (
                <button onClick={e => { e.stopPropagation(); navigate(`/advanced-reports/builder?edit=${t.id}`) }}
                  className="text-xs text-blue-500 hover:underline mt-1">Edit</button>
              )}
            </div>
          ))}
        </div>

        {/* Report View */}
        <div className="lg:col-span-3 space-y-4">
          {selectedTemplate ? (
            <>
              {/* Filters */}
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">🔍 ফিল্টার</h3>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">শুরু</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">শেষ</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>

                  {(isAdmin || isCentral || isDivisional) && visibleDivisions.length > 1 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">বিভাগ</label>
                      <select value={filterDivision} onChange={e => { setFilterDivision(e.target.value); setFilterRegion(''); setFilterBranch('') }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">সব বিভাগ</option>
                        {visibleDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}

                  {(isAdmin || isCentral || isDivisional || isRegional) && visibleRegions.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">অঞ্চল</label>
                      <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setFilterBranch('') }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">সব অঞ্চল</option>
                        {visibleRegions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  )}

                  {visibleBranches.length > 1 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">শাখা</label>
                      <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">সব শাখা</option>
                        {visibleBranches.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex items-end">
                    <button onClick={loadReport} disabled={loading}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                      {loading ? '⏳' : '🔍 দেখুন'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-gray-800">{selectedTemplate.title}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{dateFrom} — {dateTo} | {submissions.length} submissions</p>
                  </div>
                  {tableRows.length > 0 && (
                    <button onClick={exportExcel}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition">
                      📊 Excel
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-12 text-gray-400">⏳ Loading...</div>
                ) : tableRows.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm">ফিল্টার দিয়ে "দেখুন" চাপুন</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      {/* Header row 1 — group names */}
                      <thead>
                        <tr className="bg-blue-700 text-white">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold border border-blue-600 min-w-32" rowSpan={2}>
                            {isBranch ? 'ইউজারের নাম' : isRegional ? 'শাখার নাম' : isDivisional ? 'অঞ্চলের নাম' : 'নাম'}
                          </th>
                          {selectedTemplate.column_groups.map(g => (
                            <th key={g.id}
                              colSpan={g.columns.length}
                              className="px-4 py-2.5 text-center text-xs font-semibold border border-blue-600">
                              {g.label}
                            </th>
                          ))}
                        </tr>
                        {/* Header row 2 — column names */}
                        <tr className="bg-blue-600 text-white">
                          {selectedTemplate.column_groups.flatMap(g => g.columns).map(col => (
                            <th key={col.id} className="px-3 py-2 text-center text-xs font-medium border border-blue-500 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, ri) => (
                          <tr key={ri}
                            className={
                              row.type === 'total'
                                ? 'bg-blue-50 font-bold border-t-2 border-blue-300'
                                : ri % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                            }>
                            <td className="px-4 py-2.5 text-gray-800 border border-gray-200"
                              style={{ paddingLeft: `${(row.level || 0) * 16 + 16}px` }}>
                              {row.type === 'total' ? <strong>{row.label}</strong> : row.label}
                            </td>
                            {allCols.map(col => (
                              <td key={col.id} className="px-3 py-2.5 text-right border border-gray-200 tabular-nums">
                                {col.calcType === 'percent'
                                  ? <span className={`font-medium ${(row[col.id]||0) >= 100 ? 'text-green-600' : (row[col.id]||0) >= 75 ? 'text-yellow-600' : 'text-red-500'}`}>
                                      {fmtNum(row[col.id])}%
                                    </span>
                                  : fmtNum(row[col.id])
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p>বাম দিক থেকে একটি Template সিলেক্ট করুন</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}