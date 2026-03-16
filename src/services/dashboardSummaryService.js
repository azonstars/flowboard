import { supabase } from './supabase'
import { getYearRangeToToday } from './appSettingsService'

// ─────────────────────────────────────────────────────────────
// Dashboard-এর জন্য menu-ভিত্তিক field summary
// প্রতিটি parent menu-র অধীনে থাকা form-এর
// numeric field-এর যোগফল (cumulative) বা সর্বশেষ (latest) দেখাবে
// ─────────────────────────────────────────────────────────────

/**
 * submissions থেকে field-ভিত্তিক যোগফল বের করো
 * @param {Array} submissions - form_submissions rows (data_json সহ)
 * @param {Array} fields      - form.fields definition
 * @param {string} mode       - 'cumulative' | 'latest'
 */
const aggregateFields = (submissions, fields, mode) => {
  if (!submissions.length || !fields.length) return []

  // latest mode: সর্বশেষ submission_date-এর টি রাখো
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
      const total = rows.reduce((sum, s) => {
        const val = s.data_json?.[key]
        return sum + (parseFloat(val) || 0)
      }, 0)
      result.push({
        fieldId: field.id,
        fieldLabel: field.label,
        key,
        subLabel: 'সংখ্যা',
        type: 'count',
        value: total,
      })
    }
    if (field.type === 'both' || field.type === 'amount') {
      const key = `${field.id}_amount`
      const total = rows.reduce((sum, s) => {
        const val = s.data_json?.[key]
        return sum + (parseFloat(val) || 0)
      }, 0)
      result.push({
        fieldId: field.id,
        fieldLabel: field.label,
        key,
        subLabel: 'পরিমাণ',
        type: 'amount',
        value: total,
      })
    }
    // sub-fields (nested)
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

  // Subtotal rows calculate করো
  fields.forEach(field => {
    if (field.type === 'subtotal') {
      const sources = field.sourceFields || []
      let totalCount = 0, totalAmount = 0
      let hasCount = false, hasAmount = false
      sources.forEach(srcId => {
        const src = fields.find(f => f.id === srcId)
        if (!src) return
        if (['both','count'].includes(src.type)) {
          const key = `${srcId}_count`
          totalCount += rows.reduce((s, r) => s + (parseFloat(r.data_json?.[key]) || 0), 0)
          hasCount = true
        }
        if (['both','amount'].includes(src.type)) {
          const key = `${srcId}_amount`
          totalAmount += rows.reduce((s, r) => s + (parseFloat(r.data_json?.[key]) || 0), 0)
          hasAmount = true
        }
      })
      if (hasCount && totalCount > 0) result.push({ fieldId: field.id, fieldLabel: field.label, subLabel: 'সংখ্যা', type: 'count', value: totalCount, isSubtotal: true })
      if (hasAmount && totalAmount > 0) result.push({ fieldId: field.id + '_a', fieldLabel: field.label, subLabel: 'পরিমাণ', type: 'amount', value: totalAmount, isSubtotal: true })
    }
    if (field.type === 'grandtotal') {
      const sources = field.sourceFields || []
      let totalCount = 0, totalAmount = 0
      sources.forEach(srcId => {
        const sub = fields.find(f => f.id === srcId)
        if (!sub || sub.type !== 'subtotal') return
        const subSources = sub.sourceFields || []
        subSources.forEach(fId => {
          const src = fields.find(f => f.id === fId)
          if (!src) return
          if (['both','count'].includes(src.type)) totalCount += rows.reduce((s, r) => s + (parseFloat(r.data_json?.[`${fId}_count`]) || 0), 0)
          if (['both','amount'].includes(src.type)) totalAmount += rows.reduce((s, r) => s + (parseFloat(r.data_json?.[`${fId}_amount`]) || 0), 0)
        })
      })
      if (totalCount > 0) result.push({ fieldId: field.id, fieldLabel: field.label, subLabel: 'সংখ্যা', type: 'count', value: totalCount, isGrandTotal: true })
      if (totalAmount > 0) result.push({ fieldId: field.id + '_a', fieldLabel: field.label, subLabel: 'পরিমাণ', type: 'amount', value: totalAmount, isGrandTotal: true })
    }
  })

  return result.filter(f => f.value > 0) // শুধু মান আছে এমন field দেখাও
}

/**
 * Dashboard-এর জন্য menu-ভিত্তিক summary fetch করো
 * @param {object} params
 * @param {boolean} params.isFiscal       - fiscal year mode?
 * @param {string|null} params.branchCode - branch filter (branch role)
 * @param {string|null} params.regionId   - region filter
 * @param {string|null} params.divisionId - division filter
 */
export const getDashboardMenuSummary = async ({
  isFiscal = true,
  branchCode = null,
  regionId = null,
  divisionId = null,
} = {}) => {
  const range = getYearRangeToToday(isFiscal)

  // 1. Active parent menu items (যাদের children আছে)
  const { data: menuItems, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, label, icon, menu_order')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('menu_order', { ascending: true })
  if (menuErr) throw menuErr

  // 2. Child menu items (form type)
  const { data: children, error: childErr } = await supabase
    .from('menu_items')
    .select('id, parent_id, label, form_id, link_type')
    .eq('is_active', true)
    .not('parent_id', 'is', null)
    .eq('link_type', 'form')
  if (childErr) throw childErr

  // 3. Parent-এর অধীনে form_id গুলো সংগ্রহ করো
  const parentFormMap = {} // parentId → [form_id]
  children.forEach(c => {
    if (c.form_id) {
      if (!parentFormMap[c.parent_id]) parentFormMap[c.parent_id] = []
      if (!parentFormMap[c.parent_id].includes(c.form_id))
        parentFormMap[c.parent_id].push(c.form_id)
    }
  })

  // যেসব parent-এ form আছে শুধু তারা
  const activeParents = menuItems.filter(p => parentFormMap[p.id]?.length > 0)
  if (!activeParents.length) return []

  // 4. সব form-এর fields ও report_mode fetch
  const allFormIds = [...new Set(Object.values(parentFormMap).flat())]
  const { data: forms, error: formErr } = await supabase
    .from('forms')
    .select('id, title, fields, report_mode')
    .in('id', allFormIds)
    .eq('is_active', true)
  if (formErr) throw formErr

  const formMap = {}
  forms.forEach(f => { formMap[f.id] = f })

  // 5. Branch filter জন্য branch_codes বের করো
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

  // 6. সব form-এর submissions fetch করো (year range অনুযায়ী)
  const subPromises = allFormIds.map(async (formId) => {
    let q = supabase
      .from('form_submissions')
      .select('form_id, branch_code, submission_date, data_json')
      .eq('form_id', formId)
      .gte('submission_date', range.from)
      .lte('submission_date', range.to)
    if (allowedBranchCodes?.length) q = q.in('branch_code', allowedBranchCodes)
    else if (allowedBranchCodes !== null && allowedBranchCodes?.length === 0) {
      return { formId, subs: [] } // empty branch list — no data
    }
    const { data } = await q
    return { formId, subs: data || [] }
  })
  const subResults = await Promise.all(subPromises)
  const subsMap = {} // formId → submissions
  subResults.forEach(r => { subsMap[r.formId] = r.subs })

  // 7. প্রতিটি parent-এর জন্য field summary তৈরি করো
  const summary = activeParents.map(parent => {
    const formIds = parentFormMap[parent.id] || []
    const formSummaries = formIds
      .filter(fid => formMap[fid])
      .map(fid => {
        const form = formMap[fid]
        const subs = subsMap[fid] || []
        const mode = form.report_mode || 'cumulative'
        const fields = aggregateFields(subs, form.fields || [], mode)
        return {
          formId: fid,
          formTitle: form.title,
          mode,
          fields,
          submissionCount: subs.length,
        }
      })
      .filter(f => f.fields.length > 0) // data আছে এমন form

    return {
      parentId: parent.id,
      parentLabel: parent.label,
      parentIcon: parent.icon,
      yearLabel: range.label,
      forms: formSummaries,
    }
  }).filter(p => p.forms.length > 0) // data আছে এমন parent menu

  return summary
}