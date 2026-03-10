import { supabase } from './supabase'

// Activity log তৈরি করো
export const logActivity = async ({ userId, userName, role, action, targetType, targetId = null, targetLabel = null, meta = {} }) => {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      user_name: userName,
      role,
      action,
      target_type: targetType,
      target_id: targetId,
      target_label: targetLabel,
      meta,
      ip_address: null, // browser থেকে IP পাওয়া কঠিন
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    // log fail হলেও main flow বন্ধ হবে না
    console.warn('Audit log failed:', e.message)
  }
}

// সব logs পাও (admin)
export const getActivityLogs = async ({ userId = null, action = null, dateFrom = null, dateTo = null, limit = 50, offset = 0 } = {}) => {
  let query = supabase.from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId) query = query.eq('user_id', userId)
  if (action) query = query.eq('action', action)
  if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00')
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

// User এর নিজের activity
export const getMyActivity = async (userId, limit = 20) => {
  const { data, error } = await supabase.from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// Login history (action = 'LOGIN')
export const getLoginHistory = async (userId, limit = 10) => {
  const { data, error } = await supabase.from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('action', 'LOGIN')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// Action types — consistent labels
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  FORM_SUBMIT: 'FORM_SUBMIT',
  FORM_DRAFT: 'FORM_DRAFT',
  FORM_EDIT: 'FORM_EDIT',
  SUBMISSION_APPROVE: 'SUBMISSION_APPROVE',
  SUBMISSION_REJECT: 'SUBMISSION_REJECT',
  EDIT_REQUEST_SEND: 'EDIT_REQUEST_SEND',
  EDIT_REQUEST_APPROVE: 'EDIT_REQUEST_APPROVE',
  EDIT_REQUEST_REJECT: 'EDIT_REQUEST_REJECT',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  FORM_CREATE: 'FORM_CREATE',
  FORM_UPDATE: 'FORM_UPDATE',
  FORM_DELETE: 'FORM_DELETE',
  BRANCH_CREATE: 'BRANCH_CREATE',
  BRANCH_UPDATE: 'BRANCH_UPDATE',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
}

export const ACTION_LABELS = {
  LOGIN: '🔐 Login',
  LOGOUT: '🚪 Logout',
  FORM_SUBMIT: '📬 Form Submit',
  FORM_DRAFT: '📝 Draft Save',
  FORM_EDIT: '✏️ Form Edit',
  SUBMISSION_APPROVE: '✅ Approve',
  SUBMISSION_REJECT: '❌ Reject',
  EDIT_REQUEST_SEND: '📤 Edit Request',
  EDIT_REQUEST_APPROVE: '✅ Edit Approve',
  EDIT_REQUEST_REJECT: '❌ Edit Reject',
  USER_CREATE: '👤 User Create',
  USER_UPDATE: '✏️ User Update',
  USER_DELETE: '🗑 User Delete',
  FORM_CREATE: '📋 Form Create',
  FORM_UPDATE: '✏️ Form Update',
  FORM_DELETE: '🗑 Form Delete',
  BRANCH_CREATE: '🏢 Branch Create',
  BRANCH_UPDATE: '✏️ Branch Update',
  SETTINGS_UPDATE: '⚙️ Settings Update',
}