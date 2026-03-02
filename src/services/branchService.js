import { supabase } from './supabase'

// Divisions
export const getDivisions = async () => {
  const { data, error } = await supabase
    .from('divisions')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export const createDivision = async (division) => {
  const { data, error } = await supabase
    .from('divisions')
    .insert(division)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateDivision = async (id, updates) => {
  const { data, error } = await supabase
    .from('divisions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteDivision = async (id) => {
  const { error } = await supabase
    .from('divisions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Regions
export const getRegions = async (divisionId = null) => {
  let query = supabase
    .from('regions')
    .select('*, divisions(name)')
    .order('name')
  if (divisionId) query = query.eq('division_id', divisionId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export const createRegion = async (region) => {
  const { data, error } = await supabase
    .from('regions')
    .insert(region)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateRegion = async (id, updates) => {
  const { data, error } = await supabase
    .from('regions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteRegion = async (id) => {
  const { error } = await supabase
    .from('regions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Branches
export const getBranches = async (regionId = null, divisionId = null) => {
  let query = supabase
    .from('branches')
    .select('*, regions(name), divisions(name)')
    .order('name')
  if (regionId) query = query.eq('region_id', regionId)
  if (divisionId) query = query.eq('division_id', divisionId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export const createBranch = async (branch) => {
  const { data, error } = await supabase
    .from('branches')
    .insert(branch)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateBranch = async (id, updates) => {
  const { data, error } = await supabase
    .from('branches')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteBranch = async (id) => {
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', id)
  if (error) throw error
}