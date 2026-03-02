import { supabase } from './supabase'

export const getForms = async () => {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .order('created_at', { ascending: false })
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