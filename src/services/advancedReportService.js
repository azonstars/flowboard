import { supabase } from './supabase'

// ─── Templates CRUD ───────────────────────────────────────────────────────────
export const getAdvancedReportTemplates = async () => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .select('*, forms!form_id(report_mode)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  // form-এর report_mode template-এ merge করো
  return (data || []).map(t => ({
    ...t,
    report_mode: t.forms?.report_mode || 'cumulative',
  }))
}

export const getAdvancedReportTemplateById = async (id) => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export const createAdvancedReportTemplate = async (template) => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .insert(template).select().single()
  if (error) throw error
  return data
}

export const updateAdvancedReportTemplate = async (id, updates) => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteAdvancedReportTemplate = async (id) => {
  const { error } = await supabase
    .from('advanced_report_templates').delete().eq('id', id)
  if (error) throw error
}

// ─── Data Fetch ───────────────────────────────────────────────────────────────
export const fetchSubmissions = async ({ formId, dateFrom, dateTo, branchCodes, latestOnly = false }) => {
  if (!formId) return []
  let q = supabase
    .from('form_submissions')
    .select('id, branch_code, submitted_by, submission_date, data')
    .eq('form_id', formId)
    .in('status', ['approved', 'submitted'])
    .gte('submission_date', dateFrom)
    .lte('submission_date', dateTo)
  if (branchCodes?.length) q = q.in('branch_code', branchCodes)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// সাপ্তাহিক range — বৃহস্পতিবার থেকে পরের বৃহস্পতিবার
export const getCurrentWeekRange = () => {
  const now = new Date()
  const day = now.getDay()
  const diffToLastThu = (day + 3) % 7
  const lastThu = new Date(now)
  lastThu.setDate(now.getDate() - diffToLastThu)
  const nextThu = new Date(lastThu)
  nextThu.setDate(lastThu.getDate() + 7)
  return {
    from: lastThu.toISOString().split('T')[0],
    to: nextThu.toISOString().split('T')[0],
  }
}

// ─── Calculation Helpers ──────────────────────────────────────────────────────
export const calcVal = (subs, col) => {
  if (!col.fieldId) return 0
  if (['percent', 'weekly', 'prev_year'].includes(col.calcType)) return null
  const vals = subs.map(s => parseFloat(s.data?.[col.fieldId]) || 0)
  if (!vals.length) return 0
  switch (col.calcType) {
    case 'sum':     return vals.reduce((a, b) => a + b, 0)
    case 'average': return parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2))
    case 'count':   return vals.filter(v => v > 0).length
    case 'latest':  return vals[0] || 0
    default:        return vals.reduce((a, b) => a + b, 0)
  }
}

export const calcPercent = (rowData, col) => {
  const num = rowData[col.numeratorColId] || 0
  const den = rowData[col.denominatorColId] || 0
  if (!den) return 0
  return parseFloat(((num / den) * 100).toFixed(2))
}

export const buildRowData = ({ label, subs, prevSubs = [], weekSubs = [], allCols, isTotal = false }) => {
  const row = { label, isTotal }
  // Step 1: normal columns
  for (const col of allCols) {
    if (['percent','weekly','prev_year'].includes(col.calcType)) continue
    row[col.id] = calcVal(subs, col) || 0
  }
  // Step 2: prev_year
  for (const col of allCols) {
    if (col.calcType !== 'prev_year') continue
    row[col.id] = calcVal(prevSubs, { ...col, calcType: 'sum' }) || 0
  }
  // Step 3: weekly
  for (const col of allCols) {
    if (col.calcType !== 'weekly') continue
    row[col.id] = calcVal(weekSubs, { ...col, calcType: 'sum' }) || 0
  }
  // Step 4: percent (depends on above)
  for (const col of allCols) {
    if (col.calcType !== 'percent') continue
    row[col.id] = calcPercent(row, col)
  }
  return row
}

// Total row — data rows এর sum
export const buildTotalRow = ({ label = 'সর্বমোট', rows, allCols }) => {
  const total = { label, isTotal: true }
  for (const col of allCols) {
    if (col.calcType === 'percent') continue
    total[col.id] = rows.reduce((sum, r) => sum + (parseFloat(r[col.id]) || 0), 0)
  }
  // percent recalculate from totals
  for (const col of allCols) {
    if (col.calcType !== 'percent') continue
    total[col.id] = calcPercent(total, col)
  }
  return total
}