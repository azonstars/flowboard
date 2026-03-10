import { supabase } from './supabase'

// Templates CRUD
export const getAdvancedReportTemplates = async () => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const getAdvancedReportTemplateById = async (id) => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const createAdvancedReportTemplate = async (template) => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .insert(template)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateAdvancedReportTemplate = async (id, updates) => {
  const { data, error } = await supabase
    .from('advanced_report_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteAdvancedReportTemplate = async (id) => {
  const { error } = await supabase
    .from('advanced_report_templates')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Report data fetch — role অনুযায়ী
export const fetchReportData = async ({ formId, dateFrom, dateTo, branchCodes = null }) => {
  let query = supabase
    .from('form_submissions')
    .select('*, profiles(full_name), branches(name, region_id, division_id, regions(name), divisions(name))')
    .eq('form_id', formId)
    .in('status', ['approved', 'submitted'])
    .gte('submission_date', dateFrom)
    .lte('submission_date', dateTo)

  if (branchCodes && branchCodes.length > 0) {
    query = query.in('branch_code', branchCodes)
  }

  const { data, error } = await query.order('submission_date', { ascending: false })
  if (error) throw error
  return data
}

// Branch codes — role অনুযায়ী
export const getBranchCodesForRole = async (profile, allBranches) => {
  switch (profile.role) {
    case 'admin':
    case 'central_checker':
      return allBranches.map(b => b.branch_code)
    case 'divisional_checker':
      return allBranches.filter(b => b.division_id === profile.division_id).map(b => b.branch_code)
    case 'regional_checker':
      return allBranches.filter(b => b.region_id === profile.region_id).map(b => b.branch_code)
    case 'branch_manager':
    case 'branch_employee':
      return profile.branch_code ? [profile.branch_code] : []
    default:
      return []
  }
}

// Column value calculate করো
export const calcColumnValue = (submissions, colDef) => {
  if (!colDef.fieldId) return null
  const vals = submissions.map(s => {
    const raw = s.data?.[colDef.fieldId]
    return parseFloat(raw) || 0
  })
  if (!vals.length) return 0

  switch (colDef.calcType) {
    case 'sum': return vals.reduce((a, b) => a + b, 0)
    case 'average': return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
    case 'count': return vals.filter(v => v > 0).length
    case 'latest': return vals[0] || 0
    default: return vals.reduce((a, b) => a + b, 0)
  }
}

// % column calculate
export const calcPercentColumn = (row, col, allCols) => {
  if (col.calcType !== 'percent') return null
  const numeratorCol = allCols.find(c => c.id === col.numeratorColId)
  const denominatorCol = allCols.find(c => c.id === col.denominatorColId)
  if (!numeratorCol || !denominatorCol) return null
  const num = row[numeratorCol.id] || 0
  const den = row[denominatorCol.id] || 0
  if (!den) return 0
  return parseFloat(((num / den) * 100).toFixed(2))
}