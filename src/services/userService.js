import { supabase } from './supabase'

export const getUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')
  if (error) throw error
  return data
}

export const updateUser = async (id, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
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
  const { data, error } = await supabase.auth.signUp({
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
  // প্রথমে profile deactivate করো
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ is_active: false, role: 'deleted' })
    .eq('id', id)
  if (profileError) throw profileError
}