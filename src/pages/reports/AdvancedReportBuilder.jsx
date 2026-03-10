import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getForms } from '../../services/formService'
import {
  createAdvancedReportTemplate,
  updateAdvancedReportTemplate,
  getAdvancedReportTemplateById,
} from '../../services/advancedReportService'
import toast from 'react-hot-toast'

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const CALC_TYPES = [
  { value: 'sum',       label: 'Sum — যোগফল' },
  { value: 'average',   label: 'Average — গড়' },
  { value: 'count',     label: 'Count — সংখ্যা' },
  { value: 'latest',    label: 'Latest — সর্বশেষ' },
  { value: 'percent',   label: '% — শতাংশ (÷ calculation)' },
  { value: 'weekly',    label: '⏱ সাপ্তাহিক অর্জন (বৃহস্পতি–বৃহস্পতি)' },
  { value: 'prev_year', label: '📅 গত বছরের অর্জন' },
]

export default function AdvancedReportBuilder() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [title, setTitle]               = useState('')
  const [reportType, setReportType]     = useState('branch_wise')
  const [formId, setFormId]             = useState('')
  const [prevYearFormId, setPrevYearFormId] = useState('')
  const [forms, setForms]               = useState([])
  const [formFields, setFormFields]     = useState([])
  const [saving, setSaving]             = useState(false)

  // Header config — সব editable
  const [headerConfig, setHeaderConfig] = useState({
    orgName:       'বাংলাদেশ কৃষি ব্যাংক',
    officeName:    '',
    appNumber:     'ছক-"ক"',
    showWeekNumber: false,
    subTitle:      '',      // report title এর নিচে extra বিবরণ (optional)
    unitLabel:     '(কোটি টাকা)',
    pageSize:      'legal', // 'legal' | 'a3' | 'a4'
    orientation:   'landscape',
  })
  const updHeader = (k, v) => setHeaderConfig(h => ({ ...h, [k]: v }))

  const [columnGroups, setColumnGroups] = useState([{
    id: genId(), label: 'গ্রুপ-১',
    columns: [{ id: genId(), label: 'কলাম-১', fieldId: '', calcType: 'sum', numeratorColId: '', denominatorColId: '' }]
  }])
  const [rowsConfig, setRowsConfig] = useState([
    { id: genId(), label: '', level: 0, fieldMappings: {}, isTotal: false }
  ])

  useEffect(() => { loadForms() }, [])
  useEffect(() => { if (editId) loadTemplate() }, [editId])
  useEffect(() => { if (formId) loadFormFields(formId) }, [formId])

  const loadForms = async () => {
    try { const d = await getForms(); setForms(d.filter(f => f.is_active)) }
    catch (e) { console.error(e) }
  }

  const loadTemplate = async () => {
    try {
      const t = await getAdvancedReportTemplateById(editId)
      setTitle(t.title)
      setReportType(t.type)
      setFormId(t.form_id || '')
      setPrevYearFormId(t.prev_year_form_id || '')
      if (t.header_config) setHeaderConfig(h => ({ ...h, ...t.header_config }))
      if (t.column_groups?.length) setColumnGroups(t.column_groups)
      if (t.rows_config?.length) setRowsConfig(t.rows_config)
    } catch (e) { toast.error(e.message) }
  }

  const loadFormFields = async (fid) => {
    try {
      const { supabase } = await import('../../services/supabase')
      const { data } = await supabase.from('forms').select('fields').eq('id', fid).single()
      const flat = []
      ;(data?.fields || []).forEach(f => {
        if (['text','number','select','yesno'].includes(f.type) || !f.type) {
          flat.push({ id: f.id, label: f.label || f.id })
        }
        if (f.children?.length) {
          f.children.forEach(c => flat.push({ id: `${f.id}_${c.id}`, label: `${f.label} › ${c.label}` }))
        }
      })
      setFormFields(flat)
    } catch (e) { console.error(e) }
  }

  // column groups
  const addGroup = () => setColumnGroups(g => [...g, {
    id: genId(), label: 'নতুন গ্রুপ',
    columns: [{ id: genId(), label: 'কলাম', fieldId: '', calcType: 'sum', numeratorColId: '', denominatorColId: '' }]
  }])
  const updGroup = (gId, k, v) => setColumnGroups(g => g.map(x => x.id === gId ? { ...x, [k]: v } : x))
  const delGroup = (gId) => setColumnGroups(g => g.filter(x => x.id !== gId))
  const addCol = (gId) => setColumnGroups(g => g.map(x => x.id === gId
    ? { ...x, columns: [...x.columns, { id: genId(), label: 'নতুন কলাম', fieldId: '', calcType: 'sum', numeratorColId: '', denominatorColId: '' }] }
    : x))
  const updCol = (gId, cId, k, v) => setColumnGroups(g => g.map(x => x.id === gId
    ? { ...x, columns: x.columns.map(c => c.id === cId ? { ...c, [k]: v } : c) } : x))
  const delCol = (gId, cId) => setColumnGroups(g => g.map(x => x.id === gId
    ? { ...x, columns: x.columns.filter(c => c.id !== cId) } : x))

  const allCols = columnGroups.flatMap(g => g.columns)
  const nonPctCols = allCols.filter(c => !['percent','weekly','prev_year'].includes(c.calcType))

  // rows config
  const addRow = (idx) => {
    const r = [...rowsConfig]
    r.splice(idx + 1, 0, { id: genId(), label: '', level: 0, fieldMappings: {}, isTotal: false })
    setRowsConfig(r)
  }
  const updRow = (rId, k, v) => setRowsConfig(r => r.map(x => x.id === rId ? { ...x, [k]: v } : x))
  const delRow = (rId) => setRowsConfig(r => r.filter(x => x.id !== rId))

  const needsPrevYear = allCols.some(c => c.calcType === 'prev_year')
  const needsWeekly = allCols.some(c => c.calcType === 'weekly')

  const handleSave = async () => {
    if (!title.trim()) return toast.error('Title দিন')
    if (!formId) return toast.error('Form বেছে নিন')
    if (!columnGroups.length) return toast.error('কমপক্ষে ১টি column group দিন')
    setSaving(true)
    try {
      const payload = {
        title, type: reportType,
        form_id: formId,
        prev_year_form_id: prevYearFormId || null,
        office_name: headerConfig.officeName || null,
        show_week_number: headerConfig.showWeekNumber,
        header_config: headerConfig,
        column_groups: columnGroups,
        rows_config: reportType === 'category_wise' ? rowsConfig : [],
        created_by: profile.id,
      }
      if (editId) await updateAdvancedReportTemplate(editId, payload)
      else await createAdvancedReportTemplate(payload)
      toast.success(editId ? 'আপডেট হয়েছে!' : 'Template তৈরি হয়েছে!')
      navigate('/advanced-reports')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">
          {editId ? '✏️ Template Edit' : '📊 Advanced Report Builder'}
        </h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/advanced-reports')}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">বাতিল</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">📋 Basic Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Report Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              placeholder="যেমন: আমানত সংগ্রহ প্রতিবেদন ২০২৫-২৬"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Report Type *</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
              <option value="branch_wise">Branch-wise — শাখা/অঞ্চল/বিভাগ ভিত্তিক (Image 1)</option>
              <option value="summary">Summary — একটি মোট row (Image 2)</option>
              <option value="category_wise">Category-wise — বিবরণ/খাত ভিত্তিক (Image 3)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Current Year Form *</label>
            <select value={formId} onChange={e => setFormId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
              <option value="">Form বেছে নিন</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Previous Year Form
              <span className="ml-1 text-gray-400">(শুধু "গত বছর" column থাকলে)</span>
            </label>
            <select value={prevYearFormId} onChange={e => setPrevYearFormId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
              <option value="">প্রযোজ্য নয়</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
        </div>

        {needsPrevYear && !prevYearFormId && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 text-sm text-yellow-700">
            ⚠️ "গত বছরের অর্জন" column আছে — Previous Year Form বেছে নিন।
          </div>
        )}
        {needsWeekly && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
            ⏱ সাপ্তাহিক অর্জন column আছে — প্রতি বৃহস্পতিবার থেকে পরের বৃহস্পতিবার পর্যন্ত data দেখাবে।
          </div>
        )}
      </div>

      {/* Header Config */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">🖨️ Print / Excel Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">সংগঠনের নাম (শীর্ষে)</label>
            <input value={headerConfig.orgName} onChange={e => updHeader('orgName', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              placeholder="বাংলাদেশ কৃষি ব্যাংক"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">কার্যালয়ের নাম</label>
            <input value={headerConfig.officeName} onChange={e => updHeader('officeName', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              placeholder="যেমন: আঞ্চলিক কার্যালয়, রাঙামাটি"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">পরিশিষ্ট/ছক নম্বর (ডান কোণে)</label>
            <input value={headerConfig.appNumber} onChange={e => updHeader('appNumber', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              placeholder='ছক-"ক"'/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">একক লেবেল (ডান কোণে, নিচে)</label>
            <input value={headerConfig.unitLabel} onChange={e => updHeader('unitLabel', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              placeholder="(কোটি টাকা)"/>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 block mb-1">বিবরণ / subtitle (শিরোনামের নিচে)</label>
            <textarea value={headerConfig.subTitle} onChange={e => updHeader('subTitle', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              rows={2}
              placeholder="যেমন: রাঙামাটি অঞ্চলের বিগত অর্থ-বছরের তুলনায় ঋণ বিতরণ, ঋণ আদায়..."/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Page Size</label>
            <select value={headerConfig.pageSize} onChange={e => updHeader('pageSize', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none">
              <option value="legal">Legal (14×8.5 ইঞ্চি)</option>
              <option value="a3">A3 (16.5×11.7 ইঞ্চি)</option>
              <option value="a4">A4 (11.7×8.3 ইঞ্চি)</option>
            </select>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={headerConfig.showWeekNumber}
                onChange={e => updHeader('showWeekNumber', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"/>
              সপ্তাহ নম্বর দেখাও
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 text-center space-y-0.5">
          <p className="font-bold text-sm">{headerConfig.orgName || '—'}</p>
          {headerConfig.officeName && <p className="text-sm font-semibold">{headerConfig.officeName}</p>}
          {headerConfig.subTitle && <p className="text-xs text-gray-500 italic">{headerConfig.subTitle}</p>}
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{headerConfig.showWeekNumber ? 'X তম সপ্তাহ' : ''}</span>
            <span>{headerConfig.appNumber}</span>
          </div>
          <div className="text-right text-xs text-gray-400">{headerConfig.unitLabel}</div>
        </div>
      </div>

      {/* Column Groups */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="font-semibold text-gray-700">📊 Column Groups</h2>
          <button onClick={addGroup}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100">
            + Group যোগ
          </button>
        </div>

        <div className="space-y-4">
          {columnGroups.map((group, gi) => (
            <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs text-gray-400 font-bold w-5">{gi + 1}</span>
                <input value={group.label} onChange={e => updGroup(group.id, 'label', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-1 focus:ring-blue-400 focus:outline-none"
                  placeholder="Group নাম (যেমন: আমানত সংগ্রহ ২০২৫-২৬)"/>
                <button onClick={() => addCol(group.id)}
                  className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                  + Column
                </button>
                {columnGroups.length > 1 && (
                  <button onClick={() => delGroup(group.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                )}
              </div>

              {/* Columns */}
              <div className="divide-y divide-gray-100">
                {group.columns.map((col, ci) => (
                  <div key={col.id} className="px-4 py-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400 w-4">{ci + 1}.</span>

                    {/* Column name */}
                    <input value={col.label} onChange={e => updCol(group.id, col.id, 'label', e.target.value)}
                      className="w-36 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none"
                      placeholder="Column নাম"/>

                    {/* Calc type */}
                    <select value={col.calcType} onChange={e => updCol(group.id, col.id, 'calcType', e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none">
                      {CALC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>

                    {/* Percent: numerator ÷ denominator */}
                    {col.calcType === 'percent' && (
                      <>
                        <select value={col.numeratorColId} onChange={e => updCol(group.id, col.id, 'numeratorColId', e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none min-w-32">
                          <option value="">লব (উপর)</option>
                          {nonPctCols.filter(c => c.id !== col.id).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <span className="text-gray-400 text-xs font-bold">÷</span>
                        <select value={col.denominatorColId} onChange={e => updCol(group.id, col.id, 'denominatorColId', e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none min-w-32">
                          <option value="">হর (নিচ)</option>
                          {nonPctCols.filter(c => c.id !== col.id).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <span className="text-xs text-gray-400">× ১০০</span>
                      </>
                    )}

                    {/* Normal field select */}
                    {!['percent'].includes(col.calcType) && (
                      <select value={col.fieldId} onChange={e => updCol(group.id, col.id, 'fieldId', e.target.value)}
                        className="flex-1 min-w-48 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none">
                        <option value="">Form field বেছে নিন</option>
                        {formFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    )}

                    {group.columns.length > 1 && (
                      <button onClick={() => delCol(group.id, col.id)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-auto">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category-wise rows */}
      {reportType === 'category_wise' && (
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="font-semibold text-gray-700">📋 Rows Configuration</h2>
            <button onClick={() => addRow(rowsConfig.length - 1)}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100">
              + Row যোগ
            </button>
          </div>
          <div className="space-y-2">
            {rowsConfig.map((row, ri) => (
              <div key={row.id} className="flex items-center gap-2 flex-wrap"
                style={{ paddingLeft: `${row.level * 20}px` }}>
                <select value={row.level} onChange={e => updRow(row.id, 'level', parseInt(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-xs w-28 focus:outline-none">
                  <option value={0}>মূল row</option>
                  <option value={1}>— Sub row</option>
                  <option value={2}>—— Sub-sub</option>
                </select>
                <input value={row.label} onChange={e => updRow(row.id, 'label', e.target.value)}
                  className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none"
                  placeholder="বিবরণ"/>
                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={row.isTotal || false}
                    onChange={e => updRow(row.id, 'isTotal', e.target.checked)}/>
                  মোট row
                </label>
                {!row.isTotal && nonPctCols.map(col => (
                  <select key={col.id}
                    value={row.fieldMappings?.[col.id] || ''}
                    onChange={e => updRow(row.id, 'fieldMappings', { ...row.fieldMappings, [col.id]: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-xs min-w-36 focus:outline-none"
                    title={col.label}>
                    <option value="">{col.label}</option>
                    {formFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                ))}
                <div className="flex gap-1 ml-auto">
                  <button onClick={() => addRow(ri)}
                    className="text-blue-400 hover:text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 text-xs">+</button>
                  {rowsConfig.length > 1 && (
                    <button onClick={() => delRow(row.id)}
                      className="text-red-400 hover:text-red-600 border border-red-200 rounded px-1.5 py-0.5 text-xs">×</button>
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