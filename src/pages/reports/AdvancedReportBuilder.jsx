import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getForms, getFormById } from '../../services/formService'
import { createAdvancedReportTemplate, updateAdvancedReportTemplate, getAdvancedReportTemplateById } from '../../services/advancedReportService'
import toast from 'react-hot-toast'

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const CALC_TYPES = [
  { value: 'sum', label: 'Sum (যোগফল)' },
  { value: 'average', label: 'Average (গড়)' },
  { value: 'count', label: 'Count (সংখ্যা)' },
  { value: 'latest', label: 'Latest (সর্বশেষ)' },
  { value: 'percent', label: '% (শতাংশ)' },
]

export default function AdvancedReportBuilder() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [title, setTitle] = useState('')
  const [type, setType] = useState('branch_wise')
  const [formId, setFormId] = useState('')
  const [forms, setForms] = useState([])
  const [formFields, setFormFields] = useState([])
  const [loading, setLoading] = useState(false)

  // Column Groups — প্রতিটি group এ sub-columns
  const [columnGroups, setColumnGroups] = useState([
    { id: genId(), label: 'গ্রুপ-১', columns: [
      { id: genId(), label: 'কলাম-১', fieldId: '', calcType: 'sum', numeratorColId: '', denominatorColId: '' }
    ]}
  ])

  // Category-wise rows config
  const [rowsConfig, setRowsConfig] = useState([
    { id: genId(), label: '', level: 0, fieldMappings: {}, isTotal: false }
  ])

  useEffect(() => { loadForms() }, [])
  useEffect(() => { if (editId) loadTemplate() }, [editId])
  useEffect(() => { if (formId) loadFormFields() }, [formId])

  const loadForms = async () => {
    try { const data = await getForms(); setForms(data.filter(f => f.is_active)) }
    catch (e) { console.error(e) }
  }

  const loadTemplate = async () => {
    try {
      const t = await getAdvancedReportTemplateById(editId)
      setTitle(t.title); setType(t.type); setFormId(t.form_id || '')
      if (t.column_groups?.length) setColumnGroups(t.column_groups)
      if (t.rows_config?.length) setRowsConfig(t.rows_config)
    } catch (e) { toast.error(e.message) }
  }

  const loadFormFields = async () => {
    try {
      const f = await getFormById(formId)
      const flat = []
      ;(f.fields || []).forEach(field => {
        if (field.children?.length) {
          field.children.forEach(child => {
            flat.push({ id: `${field.id}_${child.id}_count`, label: `${field.label} › ${child.label} (সংখ্যা)` })
            flat.push({ id: `${field.id}_${child.id}_amount`, label: `${field.label} › ${child.label} (পরিমাণ)` })
          })
        } else {
          if (field.type === 'both' || field.type === 'count')
            flat.push({ id: `${field.id}_count`, label: `${field.label} (সংখ্যা)` })
          if (field.type === 'both' || field.type === 'amount')
            flat.push({ id: `${field.id}_amount`, label: `${field.label} (পরিমাণ)` })
          if (['text','select','yesno'].includes(field.type))
            flat.push({ id: field.id, label: field.label })
        }
      })
      setFormFields(flat)
    } catch (e) { console.error(e) }
  }

  // Column Group operations
  const addGroup = () => setColumnGroups([...columnGroups, {
    id: genId(), label: 'নতুন গ্রুপ',
    columns: [{ id: genId(), label: 'কলাম', fieldId: '', calcType: 'sum', numeratorColId: '', denominatorColId: '' }]
  }])

  const updateGroup = (gId, key, val) =>
    setColumnGroups(columnGroups.map(g => g.id === gId ? { ...g, [key]: val } : g))

  const removeGroup = (gId) => setColumnGroups(columnGroups.filter(g => g.id !== gId))

  const addColumn = (gId) => setColumnGroups(columnGroups.map(g =>
    g.id === gId ? { ...g, columns: [...g.columns, { id: genId(), label: 'নতুন কলাম', fieldId: '', calcType: 'sum', numeratorColId: '', denominatorColId: '' }] } : g
  ))

  const updateColumn = (gId, cId, key, val) => setColumnGroups(columnGroups.map(g =>
    g.id === gId ? { ...g, columns: g.columns.map(c => c.id === cId ? { ...c, [key]: val } : c) } : g
  ))

  const removeColumn = (gId, cId) => setColumnGroups(columnGroups.map(g =>
    g.id === gId ? { ...g, columns: g.columns.filter(c => c.id !== cId) } : g
  ))

  // All columns flat list (for % reference)
  const allColumns = columnGroups.flatMap(g => g.columns)

  // Row operations (category_wise)
  const addRow = (afterIdx = null, level = 0) => {
    const newRow = { id: genId(), label: '', level, fieldMappings: {}, isTotal: false }
    if (afterIdx === null) setRowsConfig([...rowsConfig, newRow])
    else { const r = [...rowsConfig]; r.splice(afterIdx + 1, 0, newRow); setRowsConfig(r) }
  }

  const updateRow = (rId, key, val) =>
    setRowsConfig(rowsConfig.map(r => r.id === rId ? { ...r, [key]: val } : r))

  const removeRow = (rId) => setRowsConfig(rowsConfig.filter(r => r.id !== rId))

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Template নাম লিখুন'); return }
    if (!formId) { toast.error('Form বেছে নিন'); return }
    if (columnGroups.length === 0) { toast.error('কমপক্ষে একটি column group যোগ করুন'); return }

    setLoading(true)
    try {
      const payload = {
        title, type, form_id: formId,
        column_groups: columnGroups,
        rows_config: type === 'category_wise' ? rowsConfig : [],
        created_by: profile.id,
      }
      if (editId) await updateAdvancedReportTemplate(editId, payload)
      else await createAdvancedReportTemplate(payload)
      toast.success(editId ? 'Template আপডেট হয়েছে!' : 'Template তৈরি হয়েছে!')
      navigate('/advanced-reports')
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">
          {editId ? '✏️ Report Template Edit' : '📊 Advanced Report Builder'}
        </h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/advanced-reports')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
            বাতিল
          </button>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
            {loading ? 'Saving...' : '💾 Save Template'}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-700">📋 Basic Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-500 block mb-1">Report Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="যেমন: আমানত সংগ্রহ প্রতিবেদন"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Report Type *</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="branch_wise">Branch-wise (শাখা/অঞ্চল ভিত্তিক)</option>
              <option value="category_wise">Category-wise (বিবরণ ভিত্তিক)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Data Source (Form) *</label>
            <select value={formId} onChange={e => setFormId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Form বেছে নিন</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
        </div>
        {type === 'branch_wise' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            ℹ️ <strong>Branch-wise:</strong> Rows automatically generate হবে — user/branch/region/division role অনুযায়ী। Filter করে যেকোনো level দেখা যাবে।
          </div>
        )}
        {type === 'category_wise' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-700">
            ℹ️ <strong>Category-wise:</strong> আপনি নিজে rows define করবেন। প্রতিটি row এর জন্য কোন form field ব্যবহার করবে সেটা বলবেন।
          </div>
        )}
      </div>

      {/* Column Groups */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">📊 Column Groups</h2>
          <button onClick={addGroup}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 transition">
            + Group যোগ
          </button>
        </div>

        {columnGroups.map((group, gi) => (
          <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Group Header */}
            <div className="bg-gray-50 px-4 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium w-6">{gi + 1}.</span>
              <input value={group.label} onChange={e => updateGroup(group.id, 'label', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Group নাম (যেমন: আমানত সংগ্রহ)"/>
              <button onClick={() => addColumn(group.id)}
                className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                + Column
              </button>
              {columnGroups.length > 1 && (
                <button onClick={() => removeGroup(group.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
              )}
            </div>

            {/* Columns */}
            <div className="divide-y divide-gray-100">
              {group.columns.map((col, ci) => (
                <div key={col.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-400 w-5">{ci + 1}.</span>
                  <input value={col.label} onChange={e => updateColumn(group.id, col.id, 'label', e.target.value)}
                    className="w-36 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Column নাম"/>
                  <select value={col.calcType} onChange={e => updateColumn(group.id, col.id, 'calcType', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {CALC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  {col.calcType === 'percent' ? (
                    <>
                      <select value={col.numeratorColId} onChange={e => updateColumn(group.id, col.id, 'numeratorColId', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">লব (÷ উপর)</option>
                        {allColumns.filter(c => c.id !== col.id && c.calcType !== 'percent').map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <span className="text-gray-400 text-xs">÷</span>
                      <select value={col.denominatorColId} onChange={e => updateColumn(group.id, col.id, 'denominatorColId', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">হর (÷ নিচ)</option>
                        {allColumns.filter(c => c.id !== col.id && c.calcType !== 'percent').map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <span className="text-xs text-gray-400">× ১০০</span>
                    </>
                  ) : (
                    <select value={col.fieldId} onChange={e => updateColumn(group.id, col.id, 'fieldId', e.target.value)}
                      className="flex-1 min-w-48 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Form field বেছে নিন</option>
                      {formFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  )}

                  {group.columns.length > 1 && (
                    <button onClick={() => removeColumn(group.id, col.id)} className="text-red-400 hover:text-red-600">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Category-wise Rows Config */}
      {type === 'category_wise' && (
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">📋 Rows Configuration</h2>
            <button onClick={() => addRow()}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 transition">
              + Row যোগ
            </button>
          </div>

          <div className="space-y-2">
            {rowsConfig.map((row, ri) => (
              <div key={row.id} className="flex items-center gap-3 flex-wrap"
                style={{ paddingLeft: `${row.level * 24}px` }}>
                <select value={row.level} onChange={e => updateRow(row.id, 'level', parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none w-28">
                  <option value={0}>মূল row</option>
                  <option value={1}>— Sub row</option>
                  <option value={2}>—— Sub-sub</option>
                </select>
                <input value={row.label} onChange={e => updateRow(row.id, 'label', e.target.value)}
                  className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Row বিবরণ"/>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={row.isTotal || false}
                    onChange={e => updateRow(row.id, 'isTotal', e.target.checked)}/>
                  মোট row
                </label>

                {/* প্রতিটি column group এর জন্য field mapping */}
                {!row.isTotal && allColumns.filter(c => c.calcType !== 'percent').map(col => (
                  <select key={col.id}
                    value={row.fieldMappings?.[col.id] || ''}
                    onChange={e => updateRow(row.id, 'fieldMappings', { ...row.fieldMappings, [col.id]: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none min-w-36"
                    title={col.label}>
                    <option value="">{col.label}: field বেছে নিন</option>
                    {formFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                ))}

                <div className="flex gap-1">
                  <button onClick={() => addRow(ri, row.level)}
                    className="text-blue-400 hover:text-blue-600 text-xs px-1.5 py-1 border border-blue-200 rounded" title="নিচে row যোগ">+</button>
                  {rowsConfig.length > 1 && (
                    <button onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 text-xs px-1.5 py-1 border border-red-200 rounded">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}