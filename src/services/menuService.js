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

export const getMenuItemsWithChildren = async () => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_active', true)
    .order('menu_order', { ascending: true })
  if (error) throw error

  // Build tree structure
  const parents = data.filter(item => !item.parent_id)
  const children = data.filter(item => item.parent_id)

  return parents.map(parent => ({
    ...parent,
    children: children.filter(child => child.parent_id === parent.id)
  }))
}

export const updateMenuOrder = async (items) => {
  const updates = items.map((item, index) => ({
    id: item.id,
    menu_order: index + 1,
  }))
  const { error } = await supabase.from('menu_items').upsert(updates)
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

export const createMenuItem = async (item) => {
  const { data, error } = await supabase
    .from('menu_items')
    .insert(item)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteMenuItem = async (id) => {
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', id)
  if (error) throw error
}