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

  // Print Layout config
  const [printLayout, setPrintLayout] = useState({
    headerBorderBottom: true,   // header-এর নিচে double line
    tableHeaderBg:      '#1e3a5f',  // table header background
    tableHeaderColor:   '#ffffff',  // table header text
    evenRowBg:          '#ffffff',  // even row background
    oddRowBg:           '#f8fafc',  // odd row background
    totalRowBg:         '#e8f0fe',  // total row background
    totalRowColor:      '#1e3a5f',  // total row text
    fontSize:           '8',        // pt
    rowHeight:          'normal',   // 'compact' | 'normal' | 'relaxed'
    borderStyle:        'full',     // 'full' | 'horizontal' | 'minimal'
    labelColWidth:      '22',       // % of table width
    showSerial:         true,
    showDate:           true,
    showUnit:           true,
  })
  const updLayout = (k, v) => setPrintLayout(l => ({ ...l, [k]: v }))

  // PDF Analysis state
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false)
  const [pdfSuggestion, setPdfSuggestion] = useState(null)

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
      if (t.print_layout) setPrintLayout(l => ({ ...l, ...t.print_layout }))
    } catch (e) { toast.error(e.message) }
  }

  const loadFormFields = async (fid) => {
    try {
      const { supabase } = await import('../../services/supabase')
      const { data } = await supabase.from('forms').select('fields').eq('id', fid).single()
      const flat = []
      ;(data?.fields || []).forEach(f => {

        // ── নতুন numeric type: প্রতিটি column আলাদা entry ──────────
        if (f.type === 'numeric' && f.columns?.length) {
          f.columns.forEach(col => {
            flat.push({
              id:    `${f.id}_${col.key}`,
              label: `${f.label || f.id} › ${col.label || col.key}`,
            })
          })
          // sub-fields থাকলে সেগুলোও
          if (f.children?.length) {
            f.children.forEach(child => {
              f.columns.forEach(col => {
                flat.push({
                  id:    `${f.id}_${child.id}_${col.key}`,
                  label: `${f.label} › ${child.label} › ${col.label || col.key}`,
                })
              })
            })
          }
          return
        }

        // ── Legacy both/count/amount type ────────────────────────────
        if (f.type === 'both' || (!f.type && f.children === undefined)) {
          flat.push({ id: `${f.id}_count`,  label: `${f.label || f.id} › সংখ্যা` })
          flat.push({ id: `${f.id}_amount`, label: `${f.label || f.id} › পরিমাণ` })
        } else if (f.type === 'count') {
          flat.push({ id: `${f.id}_count`,  label: `${f.label || f.id} › সংখ্যা` })
        } else if (f.type === 'amount') {
          flat.push({ id: `${f.id}_amount`, label: `${f.label || f.id} › পরিমাণ` })
        } else if (['text','select','yesno'].includes(f.type)) {
          flat.push({ id: `${f.id}_${f.type}`, label: f.label || f.id })
        }

        // ── Sub-fields (legacy) ───────────────────────────────────────
        if (f.children?.length && f.type !== 'numeric') {
          f.children.forEach(child => {
            if (f.columns?.length) {
              f.columns.forEach(col => {
                flat.push({
                  id:    `${f.id}_${child.id}_${col.key}`,
                  label: `${f.label} › ${child.label} › ${col.label || col.key}`,
                })
              })
            } else {
              flat.push({ id: `${f.id}_${child.id}_count`,  label: `${f.label} › ${child.label} › সংখ্যা` })
              flat.push({ id: `${f.id}_${child.id}_amount`, label: `${f.label} › ${child.label} › পরিমাণ` })
            }
          })
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
        print_layout: printLayout,
        created_by: profile.id,
      }
      if (editId) await updateAdvancedReportTemplate(editId, payload)
      else await createAdvancedReportTemplate(payload)
      toast.success(editId ? 'আপডেট হয়েছে!' : 'Template তৈরি হয়েছে!')
      navigate('/advanced-reports')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // PDF থেকে layout analyze করো (Claude API)
  const analyzePdfLayout = async (file) => {
    setPdfAnalyzing(true)
    setPdfSuggestion(null)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 }
              },
              {
                type: 'text',
                text: `এই PDF রিপোর্টের print layout বিশ্লেষণ করো। শুধু JSON দাও, কোনো ব্যাখ্যা না:
{
  "tableHeaderBg": "#hex রঙ (header background)",
  "tableHeaderColor": "#hex (header text)",
  "evenRowBg": "#hex (even row)",
  "oddRowBg": "#hex (odd row)",
  "totalRowBg": "#hex (total row background)",
  "totalRowColor": "#hex (total row text)",
  "fontSize": "7-10 (pt)",
  "rowHeight": "compact/normal/relaxed",
  "borderStyle": "full/horizontal/minimal",
  "labelColWidth": "15-35 (%)",
  "showSerial": true/false,
  "headerBorderBottom": true/false,
  "suggestion": "বাংলায় ১ লাইনে layout সম্পর্কে মন্তব্য"
}`
              }
            ]
          }]
        })
      })

      const data = await resp.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setPdfSuggestion(parsed)
      toast.success('✅ PDF বিশ্লেষণ সম্পন্ন! নিচে পরামর্শ দেখো।')
    } catch (e) {
      toast.error('PDF বিশ্লেষণ ব্যর্থ হয়েছে')
      console.error(e)
    } finally {
      setPdfAnalyzing(false)
    }
  }

  const applyPdfSuggestion = () => {
    if (!pdfSuggestion) return
    const { suggestion, ...layout } = pdfSuggestion
    setPrintLayout(l => ({ ...l, ...layout }))
    setPdfSuggestion(null)
    toast.success('✅ Layout config প্রয়োগ হয়েছে!')
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
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none"
              placeholder="যেমন: আমানত সংগ্রহ প্রতিবেদন ২০২৫-২৬"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Report Type *</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none">
              <option value="branch_wise">Branch-wise — শাখা/অঞ্চল/বিভাগ ভিত্তিক (Image 1)</option>
              <option value="summary">Summary — একটি মোট row (Image 2)</option>
              <option value="category_wise">Category-wise — বিবরণ/খাত ভিত্তিক (Image 3)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Current Year Form *</label>
            <select value={formId} onChange={e => setFormId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none">
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
          <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-2 text-sm text-primary-700">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none"
              placeholder="বাংলাদেশ কৃষি ব্যাংক"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">কার্যালয়ের নাম</label>
            <input value={headerConfig.officeName} onChange={e => updHeader('officeName', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none"
              placeholder="যেমন: আঞ্চলিক কার্যালয়, রাঙামাটি"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">পরিশিষ্ট/ছক নম্বর (ডান কোণে)</label>
            <input value={headerConfig.appNumber} onChange={e => updHeader('appNumber', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none"
              placeholder='ছক-"ক"'/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">একক লেবেল (ডান কোণে, নিচে)</label>
            <input value={headerConfig.unitLabel} onChange={e => updHeader('unitLabel', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none"
              placeholder="(কোটি টাকা)"/>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 block mb-1">বিবরণ / subtitle (শিরোনামের নিচে)</label>
            <textarea value={headerConfig.subTitle} onChange={e => updHeader('subTitle', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none"
              rows={2}
              placeholder="যেমন: রাঙামাটি অঞ্চলের বিগত অর্থ-বছরের তুলনায় ঋণ বিতরণ, ঋণ আদায়..."/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Page Size</label>
            <select value={headerConfig.pageSize} onChange={e => updHeader('pageSize', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none">
              <option value="legal">Legal (14×8.5 ইঞ্চি)</option>
              <option value="a3">A3 (16.5×11.7 ইঞ্চি)</option>
              <option value="a4">A4 (11.7×8.3 ইঞ্চি)</option>
            </select>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={headerConfig.showWeekNumber}
                onChange={e => updHeader('showWeekNumber', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600"/>
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
            className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg text-sm hover:bg-primary-100">
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
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-1 focus:ring-primary-400 focus:outline-none"
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
                      className="w-36 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary-400 focus:outline-none"
                      placeholder="Column নাম"/>

                    {/* Calc type */}
                    <select value={col.calcType} onChange={e => updCol(group.id, col.id, 'calcType', e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary-400 focus:outline-none">
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
                        className="flex-1 min-w-48 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary-400 focus:outline-none">
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
              className="px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg text-sm hover:bg-primary-100">
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
                  className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-400 focus:outline-none"
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
                    className="text-primary-400 hover:text-primary-600 border border-primary-200 rounded px-1.5 py-0.5 text-xs">+</button>
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

      {/* ── Print Layout Section ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">🖨️ Print Layout কাস্টমাইজেশন</h2>

        {/* PDF Upload → AI Analysis */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800">📄 PDF থেকে Layout বিশ্লেষণ (AI)</p>
          <p className="text-xs text-blue-600">বিদ্যমান report-এর PDF upload করলে AI স্বয়ংক্রিয়ভাবে layout config suggest করবে</p>
          <div className="flex gap-3 items-center flex-wrap">
            <label className="cursor-pointer">
              <input type="file" accept=".pdf" className="hidden"
                onChange={e => e.target.files[0] && analyzePdfLayout(e.target.files[0])} />
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition
                ${pdfAnalyzing
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'}`}>
                {pdfAnalyzing ? '⏳ বিশ্লেষণ হচ্ছে...' : '📤 PDF Upload করুন'}
              </span>
            </label>
          </div>
          {pdfSuggestion && (
            <div className="bg-white border border-blue-300 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700">✨ AI পরামর্শ:</p>
              {pdfSuggestion.suggestion && (
                <p className="text-xs text-gray-600 italic">"{pdfSuggestion.suggestion}"</p>
              )}
              <div className="flex gap-2 flex-wrap text-xs">
                {pdfSuggestion.tableHeaderBg && (
                  <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                    <span style={{background: pdfSuggestion.tableHeaderBg}} className="inline-block w-3 h-3 rounded-sm border"/>
                    Header: {pdfSuggestion.tableHeaderBg}
                  </span>
                )}
                <span className="bg-gray-50 px-2 py-1 rounded border border-gray-200">Font: {pdfSuggestion.fontSize}pt</span>
                <span className="bg-gray-50 px-2 py-1 rounded border border-gray-200">Border: {pdfSuggestion.borderStyle}</span>
              </div>
              <button onClick={applyPdfSuggestion}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
                ✅ এই layout apply করুন
              </button>
            </div>
          )}
        </div>

        {/* Manual Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Table Colors */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">রঙ সেটিং</p>
            {[
              { key: 'tableHeaderBg',  label: 'Header Background' },
              { key: 'tableHeaderColor', label: 'Header Text' },
              { key: 'evenRowBg',      label: 'সাধারণ Row' },
              { key: 'oddRowBg',       label: 'বিজোড় Row' },
              { key: 'totalRowBg',     label: 'মোট Row Background' },
              { key: 'totalRowColor',  label: 'মোট Row Text' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <input type="color" value={printLayout[key]}
                  onChange={e => updLayout(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
                <label className="text-sm text-gray-700 flex-1">{label}</label>
                <span className="text-xs text-gray-400 font-mono">{printLayout[key]}</span>
              </div>
            ))}
          </div>

          {/* Layout Options */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Layout</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Font Size (pt)</label>
              <div className="flex items-center gap-2">
                <input type="range" min="6" max="12" value={printLayout.fontSize}
                  onChange={e => updLayout('fontSize', e.target.value)}
                  className="flex-1" />
                <span className="text-sm font-medium w-8">{printLayout.fontSize}pt</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Row Height</label>
              <select value={printLayout.rowHeight} onChange={e => updLayout('rowHeight', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="compact">Compact — ঘন</option>
                <option value="normal">Normal — স্বাভাবিক</option>
                <option value="relaxed">Relaxed — প্রশস্ত</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Border Style</label>
              <select value={printLayout.borderStyle} onChange={e => updLayout('borderStyle', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="full">Full — সব দিকে border</option>
                <option value="horizontal">Horizontal — শুধু আড়াআড়ি</option>
                <option value="minimal">Minimal — শুধু header ও footer</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">বিবরণ Column প্রস্থ (%)</label>
              <div className="flex items-center gap-2">
                <input type="range" min="15" max="45" value={printLayout.labelColWidth}
                  onChange={e => updLayout('labelColWidth', e.target.value)}
                  className="flex-1" />
                <span className="text-sm font-medium w-10">{printLayout.labelColWidth}%</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              {[
                { key: 'showSerial',         label: 'ক্রমিক নম্বর দেখাও' },
                { key: 'showDate',           label: 'তারিখ header-এ দেখাও' },
                { key: 'showUnit',           label: 'একক লেবেল দেখাও' },
                { key: 'headerBorderBottom', label: 'Header-এর নিচে double line' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" checked={printLayout[key]}
                    onChange={e => updLayout(key, e.target.checked)}
                    className="w-4 h-4 rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Preview</p>
          <div style={{fontFamily:"'SolaimanLipi', Arial, sans-serif", fontSize: `${printLayout.fontSize}pt`}}
            className="border border-gray-300 rounded-lg overflow-hidden text-xs">
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th colSpan="3" style={{
                    background: printLayout.tableHeaderBg,
                    color: printLayout.tableHeaderColor,
                    padding: printLayout.rowHeight === 'compact' ? '4px 8px' : printLayout.rowHeight === 'relaxed' ? '10px 8px' : '6px 8px',
                    textAlign:'center', fontSize:`${printLayout.fontSize}pt`
                  }}>
                    Column Group
                  </th>
                </tr>
                <tr>
                  {['বিবরণ', 'সংখ্যা', 'পরিমাণ'].map((h, i) => (
                    <th key={i} style={{
                      background: printLayout.tableHeaderBg, color: printLayout.tableHeaderColor,
                      padding: printLayout.rowHeight === 'compact' ? '3px 6px' : '5px 6px',
                      borderLeft: i > 0 && printLayout.borderStyle === 'full' ? `1px solid ${printLayout.tableHeaderBg}` : 'none',
                      textAlign: i === 0 ? 'left' : 'right', fontSize:`${printLayout.fontSize}pt`
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[['নমুনা ডেটা ১', '১২৫', '৩৪.৫০'], ['নমুনা ডেটা ২', '৮৭', '২১.৩০']].map((row, ri) => (
                  <tr key={ri} style={{background: ri % 2 === 0 ? printLayout.evenRowBg : printLayout.oddRowBg}}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: printLayout.rowHeight === 'compact' ? '2px 6px' : printLayout.rowHeight === 'relaxed' ? '7px 6px' : '4px 6px',
                        borderBottom: printLayout.borderStyle !== 'minimal' ? '1px solid #e2e8f0' : 'none',
                        borderLeft: ci > 0 && printLayout.borderStyle === 'full' ? '1px solid #e2e8f0' : 'none',
                        textAlign: ci === 0 ? 'left' : 'right', fontSize:`${printLayout.fontSize}pt`
                      }}>{cell}</td>
                    ))}
                  </tr>
                ))}
                <tr style={{background: printLayout.totalRowBg}}>
                  {['মোট', '২১২', '৫৫.৮০'].map((cell, ci) => (
                    <td key={ci} style={{
                      padding: printLayout.rowHeight === 'compact' ? '3px 6px' : '5px 6px',
                      fontWeight: 'bold', color: printLayout.totalRowColor,
                      borderTop: '2px solid ' + printLayout.tableHeaderBg,
                      textAlign: ci === 0 ? 'left' : 'right', fontSize:`${printLayout.fontSize}pt`
                    }}>{cell}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}