import { supabase } from './supabase'

const DEFAULT_PREFS = {
  inapp_form_submit:   true,
  inapp_approved:      true,
  inapp_rejected:      true,
  inapp_edit_request:  true,
  inapp_edit_approved: true,
  inapp_chat:          true,
  push_form_submit:    true,
  push_approved:       true,
  push_rejected:       true,
  push_edit_request:   true,
  push_edit_approved:  true,
  push_chat:           false,
}

// User-এর preference load করো — না থাকলে default দাও
export const getNotificationPrefs = async (userId) => {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return { ...DEFAULT_PREFS }
  return { ...DEFAULT_PREFS, ...data }
}

// Preference save করো
export const saveNotificationPrefs = async (userId, prefs) => {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (error) throw error
}

// Preference check করে notification পাঠাও
export const shouldNotify = (prefs, channel, event) => {
  const key = `${channel}_${event}`
  if (prefs[key] === undefined) return true
  return prefs[key]
}