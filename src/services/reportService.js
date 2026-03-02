import { supabase } from './supabase'

export const getReportLayouts = async (userId) => {
  const { data, error } = await supabase
    .from('report_layouts')
    .select('*')
    .or(`created_by.eq.${userId},is_shared.eq.true`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const getReportLayoutById = async (id) => {
  const { data, error } = await supabase
    .from('report_layouts')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const createReportLayout = async (layout) => {
  const { data, error } = await supabase
    .from('report_layouts')
    .insert(layout)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateReportLayout = async (id, updates) => {
  const { data, error } = await supabase
    .from('report_layouts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteReportLayout = async (id) => {
  const { error } = await supabase
    .from('report_layouts')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export const getSubmissionsForReport = async (formId, filters = {}) => {
  let query = supabase
    .from('form_submissions')
    .select('*, branches(name, region_id, division_id)')
    .eq('form_id', formId)
    .eq('status', 'submitted')

  if (filters.branchCode) query = query.eq('branch_code', filters.branchCode)
  if (filters.startDate) query = query.gte('submission_date', filters.startDate)
  if (filters.endDate) query = query.lte('submission_date', filters.endDate)

  const { data, error } = await query
  if (error) throw error
  return data
}