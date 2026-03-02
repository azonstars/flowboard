import { supabase } from './supabase'

export const getPermissions = async (grantedBy = null, branchCode = null) => {
  let query = supabase
    .from('branch_edit_permissions')
    .select('*, profiles!branch_edit_permissions_manager_id_fkey(full_name), profiles!branch_edit_permissions_employee_id_fkey(full_name)')
    .order('created_at', { ascending: false })

  if (grantedBy) query = query.eq('granted_by', grantedBy)
  if (branchCode) query = query.eq('branch_code', branchCode)

  const { data, error } = await query
  if (error) throw error
  return data
}

export const createPermission = async (permission) => {
  const { data, error } = await supabase
    .from('branch_edit_permissions')
    .insert(permission)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updatePermission = async (id, updates) => {
  const { data, error } = await supabase
    .from('branch_edit_permissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const revokePermission = async (id) => {
  const { error } = await supabase
    .from('branch_edit_permissions')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export const markAsEdited = async (id, editedBy) => {
  const { error } = await supabase
    .from('branch_edit_permissions')
    .update({
      is_edited: true,
      edited_by: editedBy,
      edited_at: new Date().toISOString()
    })
    .eq('id', id)
  if (error) throw error
}