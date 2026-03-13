import { supabase } from './supabase'
import { getYearRangeToToday } from './appSettingsService'

const aggregateFields = (submissions, fields, mode) => {
  if (!submissions.length || !fields.length) return []
  let rows = submissions
  if (mode === 'latest') {
    const latestMap = {}
    submissions.forEach(s => {
      const key = s.branch_code
      if (!latestMap[key] || s.submission_date > latestMap[key].submission_date) {
        latestMap[key] = s
      }
    })
    rows = Object.values(latestMap)
  }
  const result = []
  fields.forEach(field => {
    if (field.type === 'both' || field.type === 'count') {
      const key = `${field.id}_count`
      const total = rows.reduce((sum, s) => sum + (parseFloat(s.data_json?.[key]) || 0), 0)
      result.push({ fieldId: field.id, fieldLabel: field.label, key, subLabel: 'সংখ্যা', type: 'count', value: total })
    }
    if (field.type === 'both' || field.type === 'amount') {
      const key = `${field.id}_amount`
      const total = rows.reduce((sum, s) => sum + (parseFloat(s.data_json?.[key]) || 0), 0)
      result.push({ fieldId: field.id, fieldLabel: field.label, key, subLabel: 'পরিমাণ', type: 'amount', value: total })
    }
    if (field.children?.length) {
      field.children.forEach(child => {
        if (child.type === 'both' || child.type === 'count') {
          const key = `${field.id}_${child.id}_count`
          const total = rows.reduce((sum, s) => sum + (parseFloat(s.data_json?.[key]) || 0), 0)
          result.push({ fieldId: child.id, fieldLabel: child.label, key, subLabel: 'সংখ্যা', type: 'count', value: total })
        }
        if (child.type === 'both' || child.type === 'amount') {
          const key = `${field.id}_${child.id}_amount`
          const total = rows.reduce((sum, s) => sum + (parseFloat(s.data_json?.[key]) || 0), 0)
          result.push({ fieldId: child.id, fieldLabel: child.label, key, subLabel: 'পরিমাণ', type: 'amount', value: total })
        }
      })
    }
  })
  return result.filter(f => f.value > 0)
}

export const getDashboardMenuSummary = async ({
  isFiscal = true,
  branchCode = null,
  regionId = null,
  divisionId = null,
} = {}) => {
  const range = getYearRangeToToday(isFiscal)
  const { data: menuItems, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, label, icon, menu_order')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('menu_order', { ascending: true })
  if (menuErr) throw menuErr

  const { data: children, error: childErr } = await supabase
    .from('menu_items')
    .select('id, parent_id, label, form_id, link_type')
    .eq('is_active', true)
    .not('parent_id', 'is', null)
    .eq('link_type', 'form')
  if (childErr) throw childErr

  const parentFormMap = {}
  children.forEach(c => {
    if (c.form_id) {
      if (!parentFormMap[c.parent_id]) parentFormMap[c.parent_id] = []
      if (!parentFormMap[c.parent_id].includes(c.form_id))
        parentFormMap[c.parent_id].push(c.form_id)
    }
  })

  const activeParents = menuItems.filter(p => parentFormMap[p.id]?.length > 0)
  if (!activeParents.length) return []

  const allFormIds = [...new Set(Object.values(parentFormMap).flat())]
  const { data: forms, error: formErr } = await supabase
    .from('forms')
    .select('id, title, fields, report_mode')
    .in('id', allFormIds)
    .eq('is_active', true)
  if (formErr) throw formErr

  const formMap = {}
  forms.forEach(f => { formMap[f.id] = f })

  let allowedBranchCodes = null
  if (branchCode) {
    allowedBranchCodes = [branchCode]
  } else if (regionId) {
    const { data: branches } = await supabase
      .from('branches').select('branch_code').eq('region_id', regionId)
    allowedBranchCodes = (branches || []).map(b => b.branch_code)
  } else if (divisionId) {
    const { data: branches } = await supabase
      .from('branches').select('branch_code').eq('division_id', divisionId)
    allowedBranchCodes = (branches || []).map(b => b.branch_code)
  }

  const subPromises = allFormIds.map(async (formId) => {
    let q = supabase
      .from('form_submissions')
      .select('form_id, branch_code, submission_date, data_json')
      .eq('form_id', formId)
      .gte('submission_date', range.from)
      .lte('submission_date', range.to)
    if (allowedBranchCodes?.length) q = q.in('branch_code', allowedBranchCodes)
    const { data } = await q
    return { formId, subs: data || [] }
  })
  const subResults = await Promise.all(subPromises)
  const subsMap = {}
  subResults.forEach(r => { subsMap[r.formId] = r.subs })

  const summary = activeParents.map(parent => {
    const formIds = parentFormMap[parent.id] || []
    const formSummaries = formIds
      .filter(fid => formMap[fid])
      .map(fid => {
        const form = formMap[fid]
        const subs = subsMap[fid] || []
        const mode = form.report_mode || 'cumulative'
        const fields = aggregateFields(subs, form.fields || [], mode)
        return { formId: fid, formTitle: form.title, mode, fields, submissionCount: subs.length }
      })
      .filter(f => f.fields.length > 0)
    return {
      parentId: parent.id,
      parentLabel: parent.label,
      parentIcon: parent.icon,
      yearLabel: range.label,
      forms: formSummaries,
    }
  }).filter(p => p.forms.length > 0)

  return summary
}
