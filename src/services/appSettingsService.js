import { supabase } from './supabase'

export const getAppSettings = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
  if (error) throw error
  // key-value object হিসেবে return করো
  const settings = {}
  data.forEach(s => { settings[s.key] = s.value === 'true' })
  return settings
}

export const updateAppSetting = async (key, value) => {
  const { error } = await supabase
    .from('app_settings')
    .update({ value: value ? 'true' : 'false', updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw error
}

export const getAllAppSettings = async () => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .order('key')
  if (error) throw error
  return data
}