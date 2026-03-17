import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { getYearRangeToToday } from '../../services/appSettingsService'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  const { profile, appSettings } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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

  // Quick edit panel
  const [showEdit, setShowEdit]   = useState(false)
  const [editDraft, setEditDraft] = useState(null) // local draft of selected template
  const [saving, setSaving]       = useState(false)

  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'
  const [fiscalMode, setFiscalMode] = useState(appSettings?.fiscal_year_mode !== false)
  const initRange    = getYearRangeToToday(appSettings?.fiscal_year_mode !== false)
  const [dateFrom, setDateFrom] = useState(initRange.from)
  const [dateTo, setDateTo]     = useState(initRange.to)
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

      // URL ?t=id অথবা localStorage এর last used template auto select
      const urlId   = new URLSearchParams(window.location.search).get('t')
      const lastId  = localStorage.getItem('arv_last_template')
      const targetId = urlId || lastId
      if (targetId && tmpl.length) {
        const t = tmpl.find(x => x.id === targetId) || tmpl[0]
        if (t) setSelected(t)
      } else if (tmpl.length === 1) {
        setSelected(tmpl[0])
      }
    } catch (e) { console.error(e) }
  }

  // Template select হলে URL update + localStorage save + auto load
  const handleSelectTemplate = useCallback((t) => {
    setSelected(t)
    setSubs([]); setFDiv(''); setFReg(''); setFBranch(''); setFUsers([])
    setSearchParams({ t: t.id }, { replace: true })
    localStorage.setItem('arv_last_template', t.id)
  }, [setSearchParams])

  // Template select হলে auto load (current month)
  useEffect(() => {
    if (selected && profile) {
      loadReport()
    }
  }, [selected])

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

  const loadReport = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    try {
      const codes = getAllowedCodes(fDiv, fReg, fBranch)
      const weekRange  = getCurrentWeekRange()
      const hasWeekly   = selected.column_groups?.flatMap(g=>g.columns).some(c => c.calcType === 'weekly')
      const hasPrevYear = selected.column_groups?.flatMap(g=>g.columns).some(c => c.calcType === 'prev_year')
      const isLatest = selected.report_mode === 'latest'

      let mainSubs = await fetchSubmissions({ formId: selected.form_id, dateFrom, dateTo, branchCodes: codes })

      // Latest mode: প্রতি branch-এর জন্য সর্বশেষ submission রাখো
      if (isLatest) {
        const latestMap = {}
        mainSubs.forEach(s => {
          const key = s.branch_code
          if (!latestMap[key] || s.submission_date > latestMap[key].submission_date) {
            latestMap[key] = s
          }
        })
        mainSubs = Object.values(latestMap)
      }

      const [prev, week] = await Promise.all([
        hasPrevYear && selected.prev_year_form_id
          ? fetchSubmissions({ formId: selected.prev_year_form_id, dateFrom, dateTo, branchCodes: codes })
          : Promise.resolve([]),
        hasWeekly
          ? fetchSubmissions({ formId: selected.form_id, dateFrom: weekRange.from, dateTo: weekRange.to, branchCodes: codes })
          : Promise.resolve([]),
      ])
      setSubs(mainSubs); setPrevSubs(prev); setWeekSubs(week)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [selected, dateFrom, dateTo, fDiv, fReg, fBranch, branches, isDivisional, isRegional, isBranch, profile])

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
    // user filter থাকলে সেই user(s)-এর combined data — সবসময় একটাই consolidated row
    const filteredSubs     = fUsers.length > 0 ? subs.filter(s => fUsers.includes(s.submitted_by))     : subs
    const filteredPrevSubs = fUsers.length > 0 ? prevSubs.filter(s => fUsers.includes(s.submitted_by)) : prevSubs
    const filteredWeekSubs = fUsers.length > 0 ? weekSubs.filter(s => fUsers.includes(s.submitted_by)) : weekSubs

    // সব role-এ সবসময় consolidated — filter শুধু scope বদলায়

    // ── Branch Manager: সবসময় নিজের branch-এর consolidated, user filter সহ ──
    if (isBranch) {
      const label = fUsers.length === 1
        ? (users.find(u => u.id === fUsers[0])?.full_name || 'নির্বাচিত ইউজার')
        : fUsers.length > 1
          ? `${fUsers.length} জন ইউজার (মোট)`
          : 'শাখার মোট'
      rows.push(make(label, filteredSubs, filteredPrevSubs, filteredWeekSubs))

    // ── Divisional Checker: consolidated, অঞ্চল filter সহ ──────────────────
    } else if (isDivisional) {
      // fReg select থাকলে সেই অঞ্চলের consolidated, নইলে পুরো বিভাগের consolidated
      const divCodes = fReg
        ? branches.filter(b => b.region_id === fReg).map(b => b.branch_code)
        : branches.filter(b => b.division_id === profile.division_id).map(b => b.branch_code)
      const label = fReg
        ? (regions.find(r => r.id === fReg)?.name || 'নির্বাচিত অঞ্চল')
        : 'বিভাগের মোট'
      rows.push(make(label,
        filteredSubs.filter(s => divCodes.includes(s.branch_code)),
        filteredPrevSubs.filter(s => divCodes.includes(s.branch_code)),
        filteredWeekSubs.filter(s => divCodes.includes(s.branch_code))))

    } else {
      // Regional / Admin / Central — সবসময় consolidated একটি row
      // filter অনুযায়ী scope নির্ধারণ
      let codes
      let label

      if (fBranch && fUsers.length > 0) {
        // শাখা + user filter → user-এর data
        codes = null // filteredSubs already filtered by user
        label = fUsers.length === 1
          ? (users.find(u => u.id === fUsers[0])?.full_name || 'নির্বাচিত ইউজার')
          : `${fUsers.length} জন ইউজার (মোট)`
        rows.push(make(label, filteredSubs, filteredPrevSubs, filteredWeekSubs))
      } else if (fBranch) {
        // শুধু শাখা filter
        codes = [fBranch]
        label = branches.find(b => b.branch_code === fBranch)?.name || fBranch
        rows.push(make(label,
          filteredSubs.filter(s => codes.includes(s.branch_code)),
          filteredPrevSubs.filter(s => codes.includes(s.branch_code)),
          filteredWeekSubs.filter(s => codes.includes(s.branch_code))))
      } else if (fReg) {
        // অঞ্চল filter
        codes = branches.filter(b => b.region_id === fReg).map(b => b.branch_code)
        label = regions.find(r => r.id === fReg)?.name || 'নির্বাচিত অঞ্চল'
        rows.push(make(label,
          filteredSubs.filter(s => codes.includes(s.branch_code)),
          filteredPrevSubs.filter(s => codes.includes(s.branch_code)),
          filteredWeekSubs.filter(s => codes.includes(s.branch_code))))
      } else if (fDiv) {
        // বিভাগ filter
        codes = branches.filter(b => b.division_id === fDiv).map(b => b.branch_code)
        label = divisions.find(d => d.id === fDiv)?.name || 'নির্বাচিত বিভাগ'
        rows.push(make(label,
          filteredSubs.filter(s => codes.includes(s.branch_code)),
          filteredPrevSubs.filter(s => codes.includes(s.branch_code)),
          filteredWeekSubs.filter(s => codes.includes(s.branch_code))))
      } else if (isRegional) {
        // Regional default — নিজের অঞ্চলের সব শাখার combined
        codes = branches.filter(b => b.region_id === profile.region_id).map(b => b.branch_code)
        rows.push(make('অঞ্চলের মোট',
          filteredSubs.filter(s => codes.includes(s.branch_code)),
          filteredPrevSubs.filter(s => codes.includes(s.branch_code)),
          filteredWeekSubs.filter(s => codes.includes(s.branch_code))))
      } else {
        // Admin / Central — সব শাখার combined
        rows.push(make('সর্বমোট', filteredSubs, filteredPrevSubs, filteredWeekSubs))
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
  const showBrFilter  = selected?.type === 'branch_wise' && visBr.length > 0 && !isBranch && !isDivisional

  const summaryUsers = useMemo(() => {
    if (!selected) return []
    // শাখা select করলে সেই শাখার users — সব role-এর জন্য
    if (fBranch) return users.filter(u => u.branch_code === fBranch)
    // Branch Manager — সবসময় নিজের শাখার users
    if (isBranch) return users.filter(u => u.branch_code === profile.branch_code)
    // Summary type — role অনুযায়ী
    if (selected?.type === 'summary') {
      if (isRegional) { const codes = branches.filter(b => b.region_id === profile.region_id).map(b=>b.branch_code); return users.filter(u => codes.includes(u.branch_code)) }
      if (isDivisional) { const codes = branches.filter(b => b.division_id === profile.division_id).map(b=>b.branch_code); return users.filter(u => codes.includes(u.branch_code)) }
      return users
    }
    return []
  }, [selected, fBranch, users, branches, profile, isRegional, isDivisional, isBranch])

  const rowHeader = () => {
    if (!selected || selected.type !== 'branch_wise') return 'বিবরণ'
    if (isBranch) return 'বিবরণ'
    if (fBranch && fUsers.length > 0) return 'বিবরণ'
    if (fBranch) return 'শাখা / বিবরণ'
    if (isRegional || fReg) return 'শাখার নাম'
    if (isDivisional || fDiv) return 'অঞ্চলের নাম'
    return 'নাম'
  }

  const fmtNum = v => {
    if (v === null || v === undefined) return '—'
    const n = parseFloat(v)
    return isNaN(n) ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }

  // সপ্তাহ নম্বর বের করো (অর্থবছর শুরু জুলাই ১)
  const getWeekNumber = (dateStr) => {
    const d = new Date(dateStr)
    const fyStart = new Date(d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1, 6, 1)
    return Math.ceil((d - fyStart) / (7 * 86400000))
  }

  const exportExcel = () => {
    if (!selected || !tableRows.length) return
    const wb = XLSX.utils.book_new()
    const ws = {}
    const merges = []
    let r = 0

    const bd  = { style: 'thin',   color: { rgb: '999999' } }
    const bdM = { style: 'medium', color: { rgb: '555555' } }
    const border    = { top: bd,  bottom: bd,  left: bd,  right: bd  }
    const borderMed = { top: bdM, bottom: bdM, left: bdM, right: bdM }

    const styles = {
      orgName:  { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } },
      office:   { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } },
      weekRight:{ font: { bold: true, sz: 10 }, alignment: { horizontal: 'right',  vertical: 'center' } },
      appNum:   { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right',  vertical: 'center' } },
      subTitle: { font: { sz: 9, italic: true }, alignment: { horizontal: 'center', wrapText: true } },
      dateRight:{ font: { sz: 9 }, alignment: { horizontal: 'right' } },
      unit:     { font: { sz: 9, italic: true }, alignment: { horizontal: 'right' } },
      grpHdr:   { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D4ED8' } }, alignment: { horizontal: 'center', wrapText: true, vertical: 'center' }, border: borderMed },
      colHdr:   { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2563EB' } }, alignment: { horizontal: 'center', wrapText: true, vertical: 'center' }, border },
      left:     { font: { sz: 9 }, alignment: { horizontal: 'left', wrapText: true }, border },
      num:      { font: { sz: 9 }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border },
      totLeft:  { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'left' }, border: borderMed },
      totNum:   { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'right' }, numFmt: '#,##0.00', border: borderMed },
      pct:      { font: { sz: 9 }, alignment: { horizontal: 'right' }, numFmt: '0.00"%"', border },
      totPct:   { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'right' }, numFmt: '0.00"%"', border: borderMed },
      serial:   { font: { sz: 9 }, alignment: { horizontal: 'center' }, border },
      serialH:  { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D4ED8' } }, alignment: { horizontal: 'center' }, border },
    }

    const set = (c, row, v, s) => {
      ws[XLSX.utils.encode_cell({ c, r: row })] = { v, t: typeof v === 'number' ? 'n' : 's', s }
    }
    const totalC = 2 + allCols.length
    const half   = Math.floor(totalC / 2)
    const hc     = selected.header_config || {}
    const orgName   = hc.orgName   || 'বাংলাদেশ কৃষি ব্যাংক'
    const appNumber = hc.appNumber || 'ছক-"ক"'
    const unitLabel = hc.unitLabel || '(কোটি টাকা)'

    // ── Row 0: সংগঠনের নাম ──
    set(0, r, orgName, styles.orgName)
    merges.push({ s: { r, c: 0 }, e: { r, c: half - 1 } })
    if (hc.showWeekNumber) {
      const wk = getWeekNumber(dateTo)
      set(half, r, `${wk} তম সপ্তাহ`, styles.weekRight)
      merges.push({ s: { r, c: half }, e: { r, c: totalC - 3 } })
    }
    set(totalC - 2, r, appNumber, styles.appNum)
    merges.push({ s: { r, c: totalC - 2 }, e: { r, c: totalC - 1 } })
    r++

    // ── Row 1: কার্যালয়ের নাম ──
    if (hc.officeName) {
      set(0, r, hc.officeName, styles.office)
      merges.push({ s: { r, c: 0 }, e: { r, c: totalC - 1 } })
      r++
    }

    // ── Row 2: রিপোর্ট শিরোনাম + subtitle ──
    if (hc.subTitle) {
      set(0, r, hc.subTitle, styles.subTitle)
      merges.push({ s: { r, c: 0 }, e: { r, c: totalC - 3 } })
      set(totalC - 2, r, `${dateTo} তারিখ পর্যন্ত`, styles.dateRight)
      merges.push({ s: { r, c: totalC - 2 }, e: { r, c: totalC - 1 } })
      r++
    }
    set(0, r, selected.title, styles.subTitle)
    merges.push({ s: { r, c: 0 }, e: { r, c: totalC - 3 } })
    if (!hc.subTitle) {
      set(totalC - 2, r, `${dateTo} তারিখ পর্যন্ত`, styles.dateRight)
      merges.push({ s: { r, c: totalC - 2 }, e: { r, c: totalC - 1 } })
    }
    r++

    // ── Row 3: একক ──
    set(totalC - 1, r, unitLabel, styles.unit)
    r++

    // ── Row 4: Group headers ──
    set(0, r, 'ক্রমিক', styles.serialH)
    set(1, r, rowHeader(), styles.grpHdr)
    let c = 2
    for (const g of selected.column_groups) {
      set(c, r, g.label, styles.grpHdr)
      if (g.columns.length > 1) merges.push({ s: { r, c }, e: { r, c: c + g.columns.length - 1 } })
      c += g.columns.length
    }
    r++

    // ── Row 5: Col headers ──
    set(0, r, '০', styles.serialH)
    set(1, r, '১', styles.colHdr)
    c = 2
    let ci = 2
    for (const col of allCols) { set(c, r, col.label, styles.colHdr); set(c, r, `${ci}`, styles.colHdr); ci++; c++ }
    r++

    // ── Data rows ──
    let serial = 1
    for (const row of tableRows) {
      const tot = row.isTotal
      set(0, r, tot ? '' : serial++, tot ? styles.totLeft : styles.serial)
      set(1, r, row.label, tot ? styles.totLeft : styles.left)
      c = 2
      for (const col of allCols) {
        const val = row[col.id]
        const num = (val === null || val === undefined) ? 0 : parseFloat(val)
        const isP = col.calcType === 'percent'
        const st  = tot ? (isP ? styles.totPct : styles.totNum) : (isP ? styles.pct : styles.num)
        set(c, r, isNaN(num) ? 0 : num, st)
        c++
      }
      r++
    }

    ws['!merges'] = merges
    ws['!cols']   = [{ wch: 6 }, { wch: 24 }, ...allCols.map(() => ({ wch: 10 }))]
    ws['!rows']   = [{ hpt: 24 }, { hpt: 20 }, { hpt: 36 }, { hpt: 14 }, { hpt: 28 }, { hpt: 22 }]
    ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: totalC - 1 } })

    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, `${selected.title}_${dateFrom}.xlsx`)
    toast.success('✅ Excel export হয়েছে!')
  }

  // ── PRINT VIEW ──────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!tableRows.length) { toast.error('আগে Report লোড করুন'); return }
    const hc      = selected.header_config || {}
    const orgName   = hc.orgName   || 'বাংলাদেশ কৃষি ব্যাংক'
    const appNumber = hc.appNumber || 'ছক-"ক"'
    const unitLabel = hc.unitLabel || '(কোটি টাকা)'
    const pageSize  = hc.pageSize  || 'legal'
    const pageCss   = pageSize === 'a3' ? 'size: A3 landscape' : pageSize === 'a4' ? 'size: A4 landscape' : 'size: 14in 8.5in landscape'
    const wk = hc.showWeekNumber ? getWeekNumber(dateTo) : null

    const colsHtml = selected.column_groups.map(g =>
      `<th colspan="${g.columns.length}" style="background:#1d4ed8;color:#fff;padding:5px 3px;border:1px solid #93c5fd;text-align:center;font-size:8pt">${g.label}</th>`
    ).join('')
    const subColsHtml = allCols.map(c =>
      `<th style="background:#2563eb;color:#fff;padding:3px 2px;border:1px solid #93c5fd;text-align:center;font-size:7.5pt;white-space:nowrap">${c.label}</th>`
    ).join('')
    const dataHtml = tableRows.map((row, ri) => {
      const bg = row.isTotal ? '#dbeafe' : ri % 2 === 0 ? '#fff' : '#f8fafc'
      const fw = row.isTotal ? 'bold' : 'normal'
      const cells = allCols.map(col => {
        const val = row[col.id]
        const n = parseFloat(val)
        const disp = isNaN(n) ? '—' : col.calcType === 'percent' ? `${n.toFixed(2)}%` : n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
        const color = col.calcType === 'percent' ? (n >= 100 ? '#16a34a' : n >= 75 ? '#ca8a04' : '#dc2626') : 'inherit'
        return `<td style="text-align:right;padding:2px 3px;border:1px solid #e2e8f0;font-size:7.5pt;font-weight:${fw};color:${color}">${disp}</td>`
      }).join('')
      const serial = row.isTotal ? '' : ri + 1
      return `<tr style="background:${bg}">
        <td style="text-align:center;padding:2px;border:1px solid #e2e8f0;font-size:7.5pt;color:#9ca3af">${serial}</td>
        <td style="padding:2px 4px;border:1px solid #e2e8f0;font-size:8pt;font-weight:${fw};padding-left:${(row.level||0)*10+4}px">${row.label}</td>
        ${cells}
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${selected.title}</title>
    <style>
      @page { ${pageCss}; margin: 8mm 10mm; }
      body { font-family: 'SolaimanLipi', 'Kalpurush', Arial, sans-serif; font-size: 9pt; margin: 0; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; }
      th, td { word-break: break-word; }
      .header-wrap { margin-bottom: 5px; }
      @media print { button { display: none !important; } }
    </style></head><body>
    <div class="header-wrap">
      <table style="width:100%;border:none;margin-bottom:3px">
        <tr>
          <td style="width:15%;border:none;font-size:9pt;font-weight:bold;vertical-align:top">
            ${wk ? `${wk} তম সপ্তাহ` : ''}
          </td>
          <td style="text-align:center;border:none;vertical-align:top">
            <div style="font-size:13pt;font-weight:bold">${orgName}</div>
            ${hc.officeName ? `<div style="font-size:11pt;font-weight:bold">${hc.officeName}</div>` : ''}
          </td>
          <td style="width:15%;text-align:right;border:none;font-size:10pt;font-weight:bold;vertical-align:top">
            ${appNumber}
          </td>
        </tr>
      </table>
      <table style="width:100%;border:none;margin-bottom:2px">
        <tr>
          <td style="border:none;font-size:8.5pt;font-style:italic">
            ${hc.subTitle || selected.title}
          </td>
          <td style="text-align:right;border:none;font-size:8.5pt;white-space:nowrap">
            ${dateTo} তারিখ পর্যন্ত
          </td>
        </tr>
      </table>
      <div style="text-align:right;font-size:7.5pt;font-style:italic;margin-bottom:3px">${unitLabel}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="background:#1d4ed8;color:#fff;padding:5px 3px;border:1px solid #93c5fd;text-align:center;font-size:8pt;width:3%">ক্রমিক</th>
          <th rowspan="2" style="background:#1d4ed8;color:#fff;padding:5px 6px;border:1px solid #93c5fd;text-align:center;font-size:9pt;width:15%">${rowHeader()}</th>
          ${colsHtml}
        </tr>
        <tr>${subColsHtml}</tr>
      </thead>
      <tbody>${dataHtml}</tbody>
    </table>
    <script>setTimeout(()=>window.print(),500)</script>
    </body></html>`

    const w = window.open('', '_blank', 'width=1400,height=900')
    w.document.write(html)
    w.document.close()
  }

  // ── QUICK EDIT ───────────────────────────────────────────────────────────────
  const openEdit = () => {
    setEditDraft({
      title:         selected.title,
      header_config: { ...(selected.header_config || {}) },
      column_groups: selected.column_groups.map(g => ({
        ...g,
        columns: g.columns.map(c => ({ ...c }))
      })),
    })
    setShowEdit(true)
  }

  const updDraft = (k, v) => setEditDraft(d => ({ ...d, [k]: v }))
  const updDraftHdr = (k, v) => setEditDraft(d => ({ ...d, header_config: { ...d.header_config, [k]: v } }))
  const updDraftCol = (gId, cId, k, v) => setEditDraft(d => ({
    ...d,
    column_groups: d.column_groups.map(g => g.id === gId
      ? { ...g, columns: g.columns.map(c => c.id === cId ? { ...c, [k]: v } : c) }
      : g)
  }))
  const updDraftGrp = (gId, k, v) => setEditDraft(d => ({
    ...d,
    column_groups: d.column_groups.map(g => g.id === gId ? { ...g, [k]: v } : g)
  }))

  const saveEdit = async () => {
    if (!editDraft.title.trim()) return toast.error('Title দিন')
    setSaving(true)
    try {
      const { updateAdvancedReportTemplate } = await import('../../services/advancedReportService')
      const updated = await updateAdvancedReportTemplate(selected.id, {
        title:         editDraft.title,
        header_config: editDraft.header_config,
        office_name:   editDraft.header_config.officeName || null,
        show_week_number: editDraft.header_config.showWeekNumber || false,
        column_groups: editDraft.column_groups,
      })
      const merged = { ...selected, ...updated }
      setSelected(merged)
      setTemplates(ts => ts.map(t => t.id === merged.id ? merged : t))
      setShowEdit(false)
      toast.success('✅ সংরক্ষিত হয়েছে!')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
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
        {(isAdmin || isCentral) && (
          <button onClick={() => navigate('/advanced-reports/builder')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
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
                onClick={() => handleSelectTemplate(t)}
                className={`p-3 rounded-lg cursor-pointer border transition text-sm ${selected?.id === t.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}>
                <p className="font-medium text-gray-800">{t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t.type === 'branch_wise' ? '🏢 Branch-wise' : t.type === 'summary' ? '📌 Summary' : '📋 Category-wise'}
                </p>
                {(isAdmin || isCentral) && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={e => { e.stopPropagation(); navigate(`/advanced-reports/builder?edit=${t.id}`) }}
                      className="text-xs text-primary-500 hover:underline">Edit</button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                      className="text-xs text-red-400 hover:underline">Delete</button>
                    <button onClick={e => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(`${window.location.origin}/advanced-reports?t=${t.id}`)
                      toast.success('Link copied!')
                    }} className="text-xs text-gray-400 hover:underline">🔗 Link</button>
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
                  {/* Fiscal Year Toggle */}
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-500">ক্যালেন্ডার</span>
                    <button
                      onClick={() => {
                        const next = !fiscalMode
                        setFiscalMode(next)
                        const range = getYearRangeToToday(next)
                        setDateFrom(range.from)
                        setDateTo(range.to)
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${fiscalMode ? 'bg-primary-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${fiscalMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-gray-500">অর্থবছর</span>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">শুরু</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">শেষ</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                  </div>
                  {showDivFilter && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">বিভাগ</label>
                      <select value={fDiv} onChange={e => { setFDiv(e.target.value); setFReg(''); setFBranch('') }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                        <option value="">সব বিভাগ</option>
                        {visDiv.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  {showRegFilter && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">অঞ্চল</label>
                      <select value={fReg} onChange={e => { setFReg(e.target.value); setFBranch('') }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                        <option value="">সব অঞ্চল</option>
                        {visReg.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  )}
                  {showBrFilter && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">শাখা</label>
                      <select value={fBranch} onChange={e => setFBranch(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                        <option value="">সব শাখা</option>
                        {visBr.map(b => <option key={b.id} value={b.branch_code}>{b.name} ({b.branch_code})</option>)}
                      </select>
                    </div>
                  )}
                  {summaryUsers.length > 0 && (selected.type === 'summary' || fBranch || isBranch) && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">
                        ইউজার ফিল্টার
                        <span className="ml-1 text-gray-400 font-normal">(একাধিক: Ctrl+click)</span>
                      </label>
                      <select multiple value={fUsers}
                        onChange={e => setFUsers(Array.from(e.target.selectedOptions, o => o.value))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 min-w-44 max-h-28">
                        {summaryUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.branch_code})</option>
                        ))}
                      </select>
                      {fUsers.length > 0 && (
                        <button onClick={() => setFUsers([])} className="text-xs text-red-400 hover:underline mt-0.5 block">
                          ✕ clear ({fUsers.length} selected)
                        </button>
                      )}
                    </div>
                  )}
                  <button onClick={loadReport} disabled={loading}
                    className="px-5 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                    {loading ? '⏳' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h2 className="font-bold text-gray-800">{selected.title}</h2>
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                  <span>{dateFrom} — {dateTo} · {subs.length} submissions</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selected?.report_mode === 'latest' ? 'bg-orange-100 text-orange-700' : 'bg-primary-100 text-primary-700'}`}>
                    {selected?.report_mode === 'latest' ? '🟠 সর্বশেষ' : '🔵 সর্বমোট'}
                  </span>
                </p>
                  </div>
                  <div className="flex gap-2">
                    {(isAdmin || isCentral) && (
                      <button onClick={openEdit}
                        className="px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-sm rounded-lg hover:bg-yellow-100 font-medium">
                        ✏️ Quick Edit
                      </button>
                    )}
                    {tableRows.length > 0 && (
                      <>
                        <button onClick={exportExcel}
                          className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
                          📊 Excel
                        </button>
                        <button onClick={handlePrint}
                          className="px-4 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 font-medium">
                          🖨️ Print
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {loading ? (
                  <SkeletonTable rows={8} cols={6} />
                ) : tableRows.length === 0 ? (
                  <EmptyState type="search" title='ফিল্টার দিয়ে "দেখুন" চাপুন' description="তারিখ ও শাখা নির্বাচন করুন" />
                ) : (
                  <div className="overflow-x-auto" ref={tableRef}>
                    <table className="w-full text-xs border-collapse min-w-max">
                      <thead>
                        <tr>
                          <th rowSpan={2}
                            className="px-2 py-2 text-center bg-primary-700 text-white border border-primary-600 sticky left-0 z-20 w-8">
                            #
                          </th>
                          <th rowSpan={2}
                            className="px-3 py-2 text-left bg-primary-700 text-white border border-primary-600 sticky left-8 z-20 min-w-36 whitespace-nowrap">
                            {rowHeader()}
                          </th>
                          {selected.column_groups.map(g => (
                            <th key={g.id} colSpan={g.columns.length}
                              className="px-3 py-2 text-center bg-primary-700 text-white border border-primary-600 whitespace-nowrap font-semibold">
                              {g.label}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {allCols.map(col => (
                            <th key={col.id}
                              className="px-2 py-1.5 text-center bg-primary-600 text-white border border-primary-500 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, ri) => (
                          <tr key={ri} className={row.isTotal ? 'bg-primary-50 border-t-2 border-primary-200 dark:bg-primary-900/20' : ri%2===0 ? 'bg-white hover:bg-gray-50 dark:bg-transparent dark:hover:bg-white/5' : 'bg-gray-50 hover:bg-primary-50 dark:bg-white/5 dark:hover:bg-white/10'}>
                            <td className={`px-2 py-2 text-center border border-gray-200 sticky left-0 z-10 text-xs text-gray-400 ${row.isTotal ? 'bg-primary-50 dark:bg-primary-900/20' : ri%2===0 ? 'bg-white dark:bg-transparent' : 'bg-gray-50 dark:bg-white/5'}`}>
                              {row.isTotal ? '' : ri + 1}
                            </td>
                            <td className={`px-3 py-2 border border-gray-200 sticky left-8 z-10 whitespace-nowrap ${row.isTotal ? 'bg-primary-50 font-bold text-primary-800 dark:bg-primary-900/20 dark:text-primary-300' : ri%2===0 ? 'bg-white dark:bg-transparent' : 'bg-gray-50 dark:bg-white/5'}`}
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
                                  className={`px-2 py-2 text-right border border-gray-200 tabular-nums ${row.isTotal ? 'font-bold text-primary-800' : color}`}>
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

      {/* ── Quick Edit Slide-over ── */}
      {showEdit && editDraft && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/30" onClick={() => setShowEdit(false)}/>
          {/* Panel */}
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-yellow-50">
              <h2 className="font-bold text-gray-800">✏️ Quick Edit</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Report Title</label>
                <input value={editDraft.title} onChange={e => updDraft('title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"/>
              </div>

              {/* Header config */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">🖨️ Header / Print</label>
                {[
                  { key: 'orgName',    label: 'সংগঠনের নাম',      placeholder: 'বাংলাদেশ কৃষি ব্যাংক' },
                  { key: 'officeName', label: 'কার্যালয়ের নাম',   placeholder: 'আঞ্চলিক কার্যালয়...' },
                  { key: 'appNumber',  label: 'ছক/পরিশিষ্ট নম্বর', placeholder: 'ছক-"ক"' },
                  { key: 'unitLabel',  label: 'একক',               placeholder: '(কোটি টাকা)' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
                    <input value={editDraft.header_config[key] || ''} onChange={e => updDraftHdr(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-yellow-400 focus:outline-none"/>
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">বিবরণ / Subtitle</label>
                  <textarea value={editDraft.header_config.subTitle || ''} onChange={e => updDraftHdr('subTitle', e.target.value)}
                    rows={2} placeholder="রিপোর্টের বিস্তারিত বিবরণ..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-yellow-400 focus:outline-none"/>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-0.5">Page Size</label>
                    <select value={editDraft.header_config.pageSize || 'legal'} onChange={e => updDraftHdr('pageSize', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                      <option value="legal">Legal</option>
                      <option value="a3">A3</option>
                      <option value="a4">A4</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 mt-4">
                    <input type="checkbox" checked={editDraft.header_config.showWeekNumber || false}
                      onChange={e => updDraftHdr('showWeekNumber', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"/>
                    সপ্তাহ নম্বর
                  </label>
                </div>
              </div>

              {/* Column labels */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">📊 Column Labels</label>
                {editDraft.column_groups.map(g => (
                  <div key={g.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2">
                      <input value={g.label} onChange={e => updDraftGrp(g.id, 'label', e.target.value)}
                        className="w-full bg-transparent font-semibold text-sm focus:outline-none border-b border-gray-300 pb-0.5"/>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {g.columns.map((col, ci) => (
                        <div key={col.id} className="px-3 py-2 flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{ci+1}.</span>
                          <input value={col.label} onChange={e => updDraftCol(g.id, col.id, 'label', e.target.value)}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-yellow-400 focus:outline-none"/>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{col.calcType}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                বাতিল
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">
                {saving ? 'Saving...' : '💾 সংরক্ষণ করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}