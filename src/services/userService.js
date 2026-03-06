import { supabase } from './supabase'

export const getUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_deleted', false)
    .order('full_name')
  if (error) {
    // is_deleted column না থাকলে সব আনো
    const { data: allData, error: allError } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')
    if (allError) throw allError
    return allData
  }
  return data
}

export const updateUser = async (id, updates) => {
  // empty string গুলো null করো — uuid field এ empty string error দেয়
  const cleaned = { ...updates }
  if (cleaned.division_id === '') cleaned.division_id = null
  if (cleaned.region_id === '') cleaned.region_id = null
  if (cleaned.branch_code === '') cleaned.branch_code = null

  const { data, error } = await supabase
    .from('profiles')
    .update(cleaned)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const toggleUserStatus = async (id, isActive) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getUsersByRole = async (role) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .order('full_name')
  if (error) throw error
  return data
}

export const createUser = async (email, password, fullName, role, extraData = {}) => {
  // আলাদা client দিয়ে signUp করো — main client এর session affected হবে না
  const { createClient } = await import('@supabase/supabase-js')
  const tempClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
        ...extraData,
      },
    },
  })
  if (error) throw error
  return data
}

export const deleteUser = async (id) => {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false, is_deleted: true })
    .eq('id', id)
  if (error) throw error
}