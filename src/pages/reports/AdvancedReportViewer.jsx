import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ROLES } from '../../constants/roles'
import {
  getAdvancedReportTemplates,
  deleteAdvancedReportTemplate,
  fetchSubmissions,
  getCurrentWeekRange,
  buildRowData,
  buildTotalRow,
} from '../../services/advancedReportService'
import { getDivisions, getRegions, getBranches } from '../../services/branchService'
import { supabase } from '../../services/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export default function AdvancedReportViewer() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const tableRef = useRef(null)

  const isAdmin      = profile?.role === ROLES.ADMIN
  const isCentral    = profile?.role === ROLES.CENTRAL_CHECKER
  const isDivisional = profile?.role === ROLES.DIVISIONAL_CHECKER
  const isRegional   = profile?.role === ROLES.REGIONAL_CHECKER
  const isBranch     = [ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE].includes(profile?.role)

  const [templates, setTemplates] = useState([])
  const [selected, setSelected]   = useState(null)
  const [divisions, setDivisions] = useState([])
  const [regions, setRegions]     = useState([])
  const [branches, setBranches]   = useState([])
  const [users, setUsers]         = useState([])
  const [subs, setSubs]           = useState([])
  const [prevSubs, setPrevSubs]   = useState([])
  const [weekSubs, setWeekSubs]   = useState([])
  const [loading, setLoading]     = useState(false)

  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo]     = useState(today)
  const [fDiv, setFDiv]         = useState('')
  const [fReg, setFReg]         = useState('')
  const [fBranch, setFBranch]   = useState('')
  const [fUsers, setFUsers]     = useState([])

  useEffect(() => { loadInit() }, [])

  const loadInit = async () => {
    try {
      const [tmpl, divs, regs, brs] = await Promise.all([
        getAdvancedReportTemplates(),
        getDivisions(), getRegions(), getBranches(),
      ])
      setTemplates(tmpl); setDivisions(divs); setRegions(regs); setBranches(brs)
      const { data: u } = await supabase
        .from('profiles').select('id,full_name,branch_code,role')
        .in('role', ['branch_manager','branch_employee'])
      setUsers(u || [])
    } catch (e) { console.error(e) }
  }

  const getAllowedCodes = (extraDiv, extraReg, extraBr) => {
    let pool = branches
    if (isDivisional && profile.division_id) pool = branches.filter(b => b.division_id === profile.division_id)
    else if (isRegional && profile.region_id) pool = branches.filter(b => b.region_id === profile.region_id)
    else if (isBranch && profile.branch_code) pool = branches.filter(b => b.branch_code === profile.branch_code)
    if (extraBr)  return [extraBr]
    if (extraReg) return pool.filter(b => b.region_id === extraReg).map(b => b.branch_code)
    if (extraDiv) return pool.filter(b => b.division_id === extraDiv).map(b => b.branch_code)
    return pool.map(b => b.branch_code)
  }

  const loadReport = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const codes = getAllowedCodes(fDiv, fReg, fBranch)
      const weekRange  = getCurrentWeekRange()
      const hasWeekly   = selected.column_groups?.flatMap(g=>g.columns).some(c => c.calcType === 'weekly')
      const hasPrevYear = selected.column_groups?.flatMap(g=>g.columns).some(c => c.calcType === 'prev_year')
      const [main, prev, week] = await Promise.all([
        fetchSubmissions({ formId: selected.form_id, dateFrom, dateTo, branchCodes: codes }),
        hasPrevYear && selected.prev_year_form_id
          ? fetchSubmissions({ formId: selected.prev_year_form_id, dateFrom, dateTo, branchCodes: codes })
          : Promise.resolve([]),
        hasWeekly
          ? fetchSubmissions({ formId: selected.form_id, dateFrom: weekRange.from, dateTo: weekRange.to, branchCodes: codes })
          : Promise.resolve([]),
      ])
      setSubs(main); setPrevSubs(prev); setWeekSubs(week)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const allCols = useMemo(() =>
    (selected?.column_groups || []).flatMap(g => g.columns), [selected])

  const tableRows = useMemo(() => {
    if (!selected || !subs.length) return []
    const make = (label, s, ps=[], ws=[]) =>
      buildRowData({ label, subs: s, prevSubs: ps, weekSubs: ws, allCols })

    // SUMMARY (Image 2) — সবসময় ১ row
    if (selected.type === 'summary') {
      if (fUsers.length > 0) {
        const rows = fUsers.map(uid => {
          const u = users.find(x => x.id === uid)
          return make(u?.full_name || uid,
            subs.filter(s => s.submitted_by === uid),
            prevSubs.filter(s => s.submitted_by === uid),
            weekSubs.filter(s => s.submitted_by === uid))
        })
        rows.push(buildTotalRow({ label: 'সর্বমোট', rows, allCols }))
        return rows
      }
      return [make('সর্বমোট', subs, prevSubs, weekSubs)]
    }

    // CATEGORY-WISE (Image 3)
    if (selected.type === 'category_wise') {
      const rows = []
      for (const rc of (selected.rows_config || [])) {
        if (rc.isTotal) {
          rows.push(buildTotalRow({ label: rc.label || 'মোট', rows: rows.filter(r => !r.isTotal), allCols }))
        } else {
          const mappedCols = allCols.map(c => ({ ...c, fieldId: rc.fieldMappings?.[c.id] || c.fieldId }))
          rows.push({ ...buildRowData({ label: rc.label, subs, prevSubs, weekSubs, allCols: mappedCols }), level: rc.level || 0 })
        }
      }
      return rows
    }

    // BRANCH-WISE (Image 1)
    const rows = []
    const drillUser   = isBranch
    const drillBranch = !drillUser && !!(fBranch || isRegional || (isDivisional && fReg) || ((isAdmin || isCentral) && fReg))
    const drillRegion = !drillUser && !drillBranch && !!(isDivisional || ((isAdmin || isCentral) && fDiv))

    if (drillUser) {
      const brCode  = profile.branch_code
      const brUsers = users.filter(u => u.branch_code === brCode)
      for (const u of brUsers) {
        const uid = u.id
        rows.push(make(u.full_name || uid,
          subs.filter(s => s.submitted_by === uid),
          prevSubs.filter(s => s.submitted_by === uid),
          weekSubs.filter(s => s.submitted_by === uid)))
      }
      const matched = new Set(brUsers.map(u => u.id))
      const rest = subs.filter(s => !matched.has(s.submitted_by))
      if (rest.length) rows.push(make('অন্যান্য', rest))

    } else if (drillBranch) {
      let pool = branches
      if (fBranch)   pool = branches.filter(b => b.branch_code === fBranch)
      else if (fReg) pool = branches.filter(b => b.region_id === fReg)
      else if (fDiv) pool = branches.filter(b => b.division_id === fDiv)
      else if (isRegional)   pool = branches.filter(b => b.region_id === profile.region_id)
      else if (isDivisional) pool = branches.filter(b => b.division_id === profile.division_id)
      for (const br of pool) {
        const bc = br.branch_code
        rows.push(make(br.name || bc,
          subs.filter(s => s.branch_code === bc),
          prevSubs.filter(s => s.branch_code === bc),
          weekSubs.filter(s => s.branch_code === bc)))
      }

    } else if (drillRegion) {
      let pool = regions
      if (fDiv)             pool = regions.filter(r => r.division_id === fDiv)
      else if (isDivisional) pool = regions.filter(r => r.division_id === profile.division_id)
      for (const reg of pool) {
        const codes = branches.filter(b => b.region_id === reg.id).map(b => b.branch_code)
        rows.push(make(reg.name || 'অঞ্চল',
          subs.filter(s => codes.includes(s.branch_code)),
          prevSubs.filter(s => codes.includes(s.branch_code)),
          weekSubs.filter(s => codes.includes(s.branch_code))))
      }

    } else {
      // Admin/Central no filter → বিভাগ rows
      for (const div of divisions) {
        const codes = branches.filter(b => b.division_id === div.id).map(b => b.branch_code)
        rows.push(make(div.name || 'বিভাগ',
          subs.filter(s => codes.includes(s.branch_code)),
          prevSubs.filter(s => codes.includes(s.branch_code)),
          weekSubs.filter(s => codes.includes(s.branch_code))))
      }
    }

    if (rows.length) rows.push(buildTotalRow({ label: 'সর্বমোট', rows, allCols }))
    return rows
  }, [selected, subs, prevSubs, weekSubs, allCols, fDiv, fReg, fBranch, fUsers,
      branches, regions, divisions, users, isAdmin, isCentral, isDivisional, isRegional, isBranch, profile])

  // filter visibility
  const visDiv = isAdmin || isCentral ? divisions
    : isDivisional ? divisions.filter(d => d.id === profile.division_id) : []
  const visReg = fDiv ? regions.filter(r => r.division_id === fDiv)
    : isAdmin || isCentral ? regions
    : isDivisional ? regions.filter(r => r.division_id === profile.division_id)
    : isRegional ? regions.filter(r => r.id === profile.region_id) : []
  const visBr = fReg ? branches.filter(b => b.region_id === fReg)
    : fDiv ? branches.filter(b => b.division_id === fDiv)
    : isDivisional ? branches.filter(b => b.division_id === profile.division_id)
    : isRegional ? branches.filter(b => b.region_id === profile.region_id) : []

  const showDivFilter = selected?.type === 'branch_wise' && visDiv.length > 0 && !isRegional && !isBranch
  const showRegFilter = selected?.type === 'branch_wise' && visReg.length > 0 && !isBranch
  const showBrFilter  = selected?.type === 'branch_wise' && visBr.length > 0 && !isBranch && !isRegional

  const summaryUsers = useMemo(() => {
    if (selected?.type !== 'summary') return []
    if (isBranch) return users.filter(u => u.branch_code === profile.branch_code)
    if (isRegional) { const codes = branches.filter(b => b.region_id === profile.region_id).map(b=>b.branch_code); return users.filter(u => codes.includes(u.branch_code)) }
    if (isDivisional) { const codes = branches.filter(b => b.division_id === profile.division_id).map(b=>b.branch_code); return users.filter(u => codes.includes(u.branch_code)) }
    if (fBranch) return users.filter(u => u.branch_code === fBranch)
    return users
  }, [selected, fBranch, users, branches, profile, isRegional, isDivisional, isBranch])

  const rowHeader = () => {
    if (!selected || selected.type !== 'branch_wise') return 'বিবরণ'
    if (isBranch) return 'ইউজারের নাম'
    if (isRegional || fReg) return 'শাখার নাম'
    if (isDivisional || fDiv) return 'অঞ্চলের নাম'
    return 'নাম'
  }

  const fmtNum = v => {
    if (v === null || v === undefined) return '—'
    const n = parseFloat(v)
    return isNaN(n) ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }

  // ── EXCEL EXPORT ──────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!selected || !tableRows.length) return
    const wb = XLSX.utils.book_new()
    const ws = {}
    const merges = []
    let r = 0

    const bd = { style: 'thin', color: { rgb: 'AAAAAA' } }
    const border = { top: bd, bottom: bd, left: bd, right: bd }

    const styles = {
      title:    { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center', vertical: 'center' } },
      sub:      { font: { sz: 10 }, alignment: { horizontal: 'center' } },
      grpHdr:   { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D4ED8' } }, alignment: { horizontal: 'center', wrapText: true, vertical: 'center' }, border },
      colHdr:   { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2563EB' } }, alignment: { horizontal: 'center', wrapText: true, vertical: 'center' }, border },
      left:     { font: { sz: 9 }, alignment: { horizontal: 'left', wrapText: true }, border },
      num:      { font: { sz: 9 }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border },
      totLeft:  { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'left' }, border },
      totNum:   { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border },
      pct:      { font: { sz: 9 }, alignment: { horizontal: 'right' }, numFmt: '0.00"%"', border },
      totPct:   { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'right' }, numFmt: '0.00"%"', border },
    }

    const set = (c, row, v, s) => {
      ws[XLSX.utils.encode_cell({ c, r: row })] = { v, t: typeof v === 'number' ? 'n' : 's', s }
    }
    const totalC = 1 + allCols.length

    // Title
    set(0, r, selected.title, styles.title)
    merges.push({ s: { r, c: 0 }, e: { r, c: totalC - 1 } })
    r++

    // Date
    set(0, r, `তারিখ: ${dateFrom} থেকে ${dateTo}  |  মোট: ${subs.length} submissions`, styles.sub)
    merges.push({ s: { r, c: 0 }, e: { r, c: totalC - 1 } })
    r++
    r++ // blank row

    // Group headers
    set(0, r, rowHeader(), styles.grpHdr)
    let c = 1
    for (const g of selected.column_groups) {
      set(c, r, g.label, styles.grpHdr)
      if (g.columns.length > 1) merges.push({ s: { r, c }, e: { r, c: c + g.columns.length - 1 } })
      c += g.columns.length
    }
    r++

    // Col headers
    set(0, r, '', styles.colHdr)
    c = 1
    for (const col of allCols) { set(c, r, col.label, styles.colHdr); c++ }
    r++

    // Data
    for (const row of tableRows) {
      set(0, r, row.label, row.isTotal ? styles.totLeft : styles.left)
      c = 1
      for (const col of allCols) {
        const val = row[col.id]
        const num = (val === null || val === undefined) ? '' : parseFloat(val)
        const isP = col.calcType === 'percent'
        const st = row.isTotal ? (isP ? styles.totPct : styles.totNum) : (isP ? styles.pct : styles.num)
        set(c, r, isNaN(num) ? 0 : num, st)
        c++
      }
      r++
    }

    ws['!merges'] = merges
    ws['!cols'] = [{ wch: 24 }, ...allCols.map(() => ({ wch: 11 }))]
    ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 8 }, { hpt: 28 }, { hpt: 24 }]
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: totalC - 1 } })

    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, `${selected.title}_${dateFrom}.xlsx`)
    toast.success('✅ Excel export হয়েছে!')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete করবেন?')) return
    try {
      await deleteAdvancedReportTemplate(id)
      toast.success('Deleted!')
      setTemplates(t => t.filter(x => x.id !== id))
      if (selected?.id === id) { setSelected(null); setSubs([]) }
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">📊 Advanced Reports</h1>
        {isAdmin && (
          <button onClick={() => navigate('/advanced-reports/builder')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + New Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Template list */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2 lg:overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Templates</p>
          {templates.length === 0
            ? <p className="text-sm text-gray-400">কোনো template নেই</p>
            : templates.map(t => (
              <div key={t.id}
                onClick={() => { setSelected(t); setSubs([]); setFDiv(''); setFReg(''); setFBranch(''); setFUsers([]) }}
                className={`p-3 rounded-lg cursor-pointer border transition text-sm ${selected?.id === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                <p className="font-medium text-gray-800">{t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t.type === 'branch_wise' ? '🏢 Branch-wise' : t.type === 'summary' ? '📌 Summary' : '📋 Category-wise'}
                </p>
                {isAdmin && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={e => { e.stopPropagation(); navigate(`/advanced-reports/builder?edit=${t.id}`) }}
                      className="text-xs text-blue-500 hover:underline">Edit</button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                      className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Report view */}
        <div className="lg:col-span-3 space-y-4">
          {selected ? (
            <>
              {/* Filters */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">ফিল্টার</p>
                <div className="flex flex-wrap gap-3 items-end">
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
                  {showDivFilter && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">বিভাগ</label>
                      <select value={fDiv} onChange={e => { setFDiv(e.target.value); setFReg(''); setFBranch('') }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">সব বিভাগ</option>
                        {visDiv.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  {showRegFilter && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">অঞ্চল</label>
                      <select value={fReg} onChange={e => { setFReg(e.target.value); setFBranch('') }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">সব অঞ্চল</option>
                        {visReg.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  )}
                  {showBrFilter && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">শাখা</label>
                      <select value={fBranch} onChange={e => setFBranch(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">সব শাখা</option>
                        {visBr.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                      </select>
                    </div>
                  )}
                  {selected.type === 'summary' && summaryUsers.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">ইউজার ফিল্টার <span className="text-gray-400">(Ctrl+click)</span></label>
                      <select multiple value={fUsers}
                        onChange={e => setFUsers(Array.from(e.target.selectedOptions, o => o.value))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-44 max-h-24">
                        {summaryUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                      {fUsers.length > 0 && (
                        <button onClick={() => setFUsers([])} className="text-xs text-red-400 hover:underline mt-0.5 block">✕ clear</button>
                      )}
                    </div>
                  )}
                  <button onClick={loadReport} disabled={loading}
                    className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {loading ? '⏳' : '🔍 দেখুন'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h2 className="font-bold text-gray-800">{selected.title}</h2>
                    <p className="text-xs text-gray-400">{dateFrom} — {dateTo} · {subs.length} submissions</p>
                  </div>
                  {tableRows.length > 0 && (
                    <button onClick={exportExcel}
                      className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
                      📊 Excel Export
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-16 text-gray-400">⏳ Loading...</div>
                ) : tableRows.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-2">📭</p>
                    <p className="text-sm">ফিল্টার দিয়ে "দেখুন" চাপুন</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto" ref={tableRef}>
                    <table className="w-full text-xs border-collapse min-w-max">
                      <thead>
                        <tr>
                          <th rowSpan={2}
                            className="px-3 py-2 text-left bg-blue-700 text-white border border-blue-600 sticky left-0 z-20 min-w-36 whitespace-nowrap">
                            {rowHeader()}
                          </th>
                          {selected.column_groups.map(g => (
                            <th key={g.id} colSpan={g.columns.length}
                              className="px-3 py-2 text-center bg-blue-700 text-white border border-blue-600 whitespace-nowrap font-semibold">
                              {g.label}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {allCols.map(col => (
                            <th key={col.id}
                              className="px-2 py-1.5 text-center bg-blue-600 text-white border border-blue-500 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, ri) => (
                          <tr key={ri} className={row.isTotal ? 'bg-blue-50 border-t-2 border-blue-200' : ri%2===0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-blue-50'}>
                            <td className={`px-3 py-2 border border-gray-200 sticky left-0 z-10 whitespace-nowrap ${row.isTotal ? 'bg-blue-50 font-bold text-blue-800' : ri%2===0 ? 'bg-white' : 'bg-gray-50'}`}
                              style={{ paddingLeft: `${(row.level||0)*12+12}px` }}>
                              {row.label}
                            </td>
                            {allCols.map(col => {
                              const val = row[col.id]
                              const n = parseFloat(val)
                              const isP = col.calcType === 'percent'
                              const color = isP ? (n >= 100 ? 'text-green-600' : n >= 75 ? 'text-yellow-600' : 'text-red-500') : ''
                              return (
                                <td key={col.id}
                                  className={`px-2 py-2 text-right border border-gray-200 tabular-nums ${row.isTotal ? 'font-bold text-blue-800' : color}`}>
                                  {isP ? `${fmtNum(val)}%` : fmtNum(val)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-16 text-center text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p>বাম দিক থেকে একটি Template সিলেক্ট করুন</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}