import { supabase } from './supabase'

export const getMenuItems = async () => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_active', true)
    .order('menu_order', { ascending: true })
  if (error) throw error
  return data
}

export const updateMenuOrder = async (items) => {
  const updates = items.map((item, index) => ({
    id: item.id,
    menu_order: index + 1,
  }))

  const { error } = await supabase
    .from('menu_items')
    .upsert(updates)
  if (error) throw error
}

export const updateMenuItem = async (id, updates) => {
  const { data, error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}