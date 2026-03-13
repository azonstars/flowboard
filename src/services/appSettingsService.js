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

// Fiscal year range calculate করো
// fiscal_year_mode = true  → জুলাই–জুন
// fiscal_year_mode = false → জানুয়ারি–ডিসেম্বর
export const getYearRange = (isFiscal = true) => {
  const now = new Date()
  const month = now.getMonth() // 0-indexed (জুলাই = 6)
  const year = now.getFullYear()

  if (isFiscal) {
    // অর্থবছর: জুলাই থেকে জুন
    // জুলাই বা পরে হলে → এ বছর জুলাই থেকে পরের বছর জুন
    // জুলাইয়ের আগে হলে → গত বছর জুলাই থেকে এ বছর জুন
    const startYear = month >= 6 ? year : year - 1
    const endYear = startYear + 1
    return {
      from: `${startYear}-07-01`,
      to: `${endYear}-06-30`,
      label: `অর্থবছর ${startYear}-${String(endYear).slice(2)}`,
    }
  } else {
    // ক্যালেন্ডার বছর: জানুয়ারি–ডিসেম্বর
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: `ক্যালেন্ডার বছর ${year}`,
    }
  }
}

// আজকের তারিখ পর্যন্ত range (to = আজ)
export const getYearRangeToToday = (isFiscal = true) => {
  const range = getYearRange(isFiscal)
  const today = new Date().toISOString().split('T')[0]
  return { ...range, to: today }
}