import { supabase } from './supabase'

export const getForms = async () => {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .order('menu_order', { ascending: true })
  if (error) throw error
  return data
}

export const getMenuForms = async () => {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('is_active', true)
    .eq('show_in_menu', true)
    .order('menu_order', { ascending: true })
  if (error) throw error
  return data
}

export const getFormById = async (id) => {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const createForm = async (form) => {
  const { data, error } = await supabase
    .from('forms')
    .insert(form)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateForm = async (id, updates) => {
  const { data, error } = await supabase
    .from('forms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteForm = async (id) => {
  const { error } = await supabase
    .from('forms')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export const getFormSubmissions = async (formId, branchCode = null, date = null) => {
  let query = supabase
    .from('form_submissions')
    .select('*, profiles(full_name)')
    .eq('form_id', formId)
  if (branchCode) query = query.eq('branch_code', branchCode)
  if (date) query = query.eq('submission_date', date)
  const { data, error } = await query
  if (error) throw error
  return data
}

export const submitForm = async (submission) => {
  const { data, error } = await supabase
    .from('form_submissions')
    .upsert(submission, {
      onConflict: 'form_id,branch_code,submission_date'
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export const getSubmissionsForApproval = async (filters = {}) => {
  let query = supabase
    .from('form_submissions')
    .select('*, forms(title), profiles(full_name)')
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.branch_code) query = query.eq('branch_code', filters.branch_code)
  if (filters.startDate) query = query.gte('submission_date', filters.startDate)
  if (filters.endDate) query = query.lte('submission_date', filters.endDate)
  if (filters.branchCodes) query = query.in('branch_code', filters.branchCodes)

  const { data, error } = await query
  if (error) throw error
  return data
}

export const approveSubmission = async (id, approvedBy) => {
  const { data, error } = await supabase
    .from('form_submissions')
    .update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const rejectSubmission = async (id, rejectedBy, reason) => {
  const { data, error } = await supabase
    .from('form_submissions')
    .update({ status: 'rejected', rejected_by: rejectedBy, rejection_reason: reason, approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getTodaySubmission = async (formId, branchCode) => {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('form_id', formId)
    .eq('branch_code', branchCode)
    .eq('submission_date', today)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}