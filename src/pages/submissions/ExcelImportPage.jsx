import { useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../constants/roles'
import { supabase } from '../../services/supabase'
import { submitForm } from '../../services/formService'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

// Excel column header তৈরি করো field থেকে
const getExcelHeaders = (fields) => {
  const headers = ['branch_code', 'submission_date']
  fields.forEach(field => {
    if (field.type === 'both' || field.type === 'count')
      headers.push(`${field.label}_সংখ্যা`)
    if (field.type === 'both' || field.type === 'amount')
      headers.push(`${field.label}_পরিমাণ`)
    if (field.children?.length) {
      field.children.forEach(child => {
        if (child.type === 'both' || child.type === 'count')
          headers.push(`${field.label}__${child.label}_সংখ্যা`)
        if (child.type === 'both' || child.type === 'amount')
          headers.push(`${field.label}__${child.label}_পরিমাণ`)
      })
    }
  })
  return headers
}

// Excel row → data_json convert করো
const rowToDataJson = (row, fields, headers) => {
  const data = {}
  fields.forEach(field => {
    if (field.type === 'both' || field.type === 'count') {
      const col = `${field.label}_সংখ্যা`
      const idx = headers.indexOf(col)
      if (idx > -1) data[`${field.id}_count`] = row[idx] ?? ''
    }
    if (field.type === 'both' || field.type === 'amount') {
      const col = `${field.label}_পরিমাণ`
      const idx = headers.indexOf(col)
      if (idx > -1) data[`${field.id}_amount`] = row[idx] ?? ''
    }
    if (field.children?.length) {
      field.children.forEach(child => {
        if (child.type === 'both' || child.type === 'count') {
          const col = `${field.label}__${child.label}_সংখ্যা`
          const idx = headers.indexOf(col)
          if (idx > -1) data[`${field.id}_${child.id}_count`] = row[idx] ?? ''
        }
        if (child.type === 'both' || child.type === 'amount') {
          const col = `${field.label}__${child.label}_পরিমাণ`
          const idx = headers.indexOf(col)
          if (idx > -1) data[`${field.id}_${child.id}_amount`] = row[idx] ?? ''
        }
      })
    }
  })
  return data
}

export default function ExcelImportPage() {
  const { profile } = useAuth()
  const fileRef = useRef()

  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [branches, setBranches] = useState([])
  const [preview, setPreview] = useState([]) // parsed rows
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(null) // { success, failed }
  const [formsLoaded, setFormsLoaded] = useState(false)

  // Forms load
  const loadForms = async () => {
    if (formsLoaded) return
    const { data } = await supabase.from('forms').select('id, title, fields').eq('is_active', true)
    setForms(data || [])

    // Role অনুযায়ী branch filter
    let brQuery = supabase.from('branches').select('branch_code, name')
    if (profile?.role === ROLES.REGIONAL_CHECKER && profile?.region_id) {
      brQuery = brQuery.eq('region_id', profile.region_id)
    } else if (profile?.role === ROLES.DIVISIONAL_CHECKER && profile?.division_id) {
      brQuery = brQuery.eq('division_id', profile.division_id)
    }
    const { data: br } = await brQuery
    setBranches(br || [])
    setFormsLoaded(true)
  }

  useState(() => { loadForms() }, [])

  // Template download
  const downloadTemplate = () => {
    if (!selectedForm) return toast.error('আগে form select করুন')
    const headers = getExcelHeaders(selectedForm.fields || [])
    const example = [
      headers,
      headers.map((h, i) => {
        if (h === 'branch_code') return 'BR001'
        if (h === 'submission_date') return '2024-07-15'
        return i % 2 === 0 ? 100 : 50000
      }),
    ]
    const ws = XLSX.utils.aoa_to_sheet(example)
    // Header row bold style
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
      if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'DBEAFE' } } }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `${selectedForm.title}_template.xlsx`)
    toast.success('Template downloaded!')
  }

  // File parse
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!selectedForm) { toast.error('আগে form select করুন'); return }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (rows.length < 2) { toast.error('Excel-এ data নেই'); return }

        const headers = rows[0].map(h => String(h).trim())
        const branchCodes = new Set(branches.map(b => b.branch_code))
        const parsed = []
        const errs = []

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (row.every(c => c === '' || c == null)) continue // empty row skip

          const branch_code = String(row[headers.indexOf('branch_code')] || '').trim()
          const submission_date = String(row[headers.indexOf('submission_date')] || '').trim()

          const rowErrs = []
          if (!branch_code) rowErrs.push('branch_code নেই')
          else if (!branchCodes.has(branch_code)) rowErrs.push(`branch_code "${branch_code}" পাওয়া যায়নি`)
          if (!submission_date) rowErrs.push('submission_date নেই')
          else if (!/^\d{4}-\d{2}-\d{2}$/.test(submission_date)) rowErrs.push('date format ভুল (YYYY-MM-DD হওয়া উচিত)')

          const data_json = rowToDataJson(row, selectedForm.fields || [], headers)

          if (rowErrs.length) {
            errs.push({ row: i + 1, errors: rowErrs, branch_code, submission_date })
          } else {
            parsed.push({ branch_code, submission_date, data_json })
          }
        }

        setPreview(parsed)
        setErrors(errs)
        setDone(null)
        if (errs.length) toast.error(`${errs.length}টি row-এ error আছে`)
        else toast.success(`${parsed.length}টি row প্রস্তুত`)
      } catch (err) {
        toast.error('Excel পড়তে সমস্যা: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Import submit
  const handleImport = async () => {
    if (!preview.length) return
    setImporting(true)
    let success = 0, failed = 0

    for (const row of preview) {
      try {
        await submitForm({
          form_id: selectedForm.id,
          branch_code: row.branch_code,
          submission_date: row.submission_date,
          data_json: row.data_json,
          status: 'submitted',
          submitted_by: profile.id,
        })
        success++
      } catch {
        failed++
      }
    }

    setImporting(false)
    setDone({ success, failed })
    setPreview([])
    setErrors([])
    if (fileRef.current) fileRef.current.value = ''
    toast.success(`${success}টি import সফল${failed ? `, ${failed}টি ব্যর্থ` : ''}`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">📥 Excel Import</h1>
        <p className="text-sm text-gray-500 mt-1">Excel ফাইল আপলোড করে একসাথে অনেক শাখার data submit করুন</p>
      </div>

      {/* Step 1 — Form Select */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ধাপ ১ — Form নির্বাচন করুন</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Form</label>
            <select
              value={selectedForm?.id || ''}
              onChange={e => {
                const f = forms.find(x => x.id === e.target.value)
                setSelectedForm(f || null)
                setPreview([]); setErrors([]); setDone(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">-- form select করুন --</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <button
            onClick={downloadTemplate}
            disabled={!selectedForm}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-40">
            📄 Template Download
          </button>
        </div>
        {selectedForm && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">✅ নির্বাচিত: {selectedForm.title}</p>
            <p className="text-xs text-blue-500 mt-0.5">
              Fields: {selectedForm.fields?.map(f => f.label).join(', ')}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              💡 Template download করুন → data পূরণ করুন → নিচে upload করুন
            </p>
          </div>
        )}
      </div>

      {/* Step 2 — File Upload */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ধাপ ২ — Excel ফাইল আপলোড করুন</p>
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition cursor-pointer"
          onClick={() => fileRef.current?.click()}>
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm font-medium text-gray-600">Excel ফাইল (.xlsx) এখানে click করে বেছে নিন</p>
          <p className="text-xs text-gray-400 mt-1">আগে form select করুন ও template download করুন</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-red-700 mb-3">⚠️ {errors.length}টি row-এ সমস্যা পাওয়া গেছে (import হবে না)</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {errors.map((e, i) => (
              <div key={i} className="text-xs bg-white border border-red-100 rounded-lg px-3 py-2">
                <span className="font-medium text-red-600">Row {e.row}</span>
                {e.branch_code && <span className="text-gray-500 ml-2">({e.branch_code} / {e.submission_date})</span>}
                <span className="text-red-500 ml-2">→ {e.errors.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm">👁️ Preview — {preview.length}টি row import হবে</p>
              <p className="text-xs text-gray-400 mt-0.5">নিচের data যাচাই করুন, তারপর Import করুন</p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
              {importing ? '⏳ Import হচ্ছে...' : `✅ Import করুন (${preview.length}টি)`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">#</th>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Branch Code</th>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">তারিখ</th>
                  {selectedForm?.fields?.map(f => (
                    <th key={f.id} className="px-4 py-2 text-left text-gray-500 font-medium" colSpan={
                      f.type === 'both' ? 2 : 1
                    }>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-700">{row.branch_code}</td>
                    <td className="px-4 py-2 text-gray-600">{row.submission_date}</td>
                    {selectedForm?.fields?.map(f => (
                      <>
                        {(f.type === 'both' || f.type === 'count') && (
                          <td key={f.id + '_c'} className="px-4 py-2 text-blue-700">
                            {row.data_json[`${f.id}_count`] || '—'}
                          </td>
                        )}
                        {(f.type === 'both' || f.type === 'amount') && (
                          <td key={f.id + '_a'} className="px-4 py-2 text-green-700">
                            {row.data_json[`${f.id}_amount`] || '—'}
                          </td>
                        )}
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && (
              <p className="text-xs text-gray-400 text-center py-3">... আরো {preview.length - 20}টি row (সব import হবে)</p>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {done && (
        <div className={`rounded-xl p-5 ${done.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <p className={`font-semibold text-sm ${done.failed === 0 ? 'text-green-700' : 'text-yellow-700'}`}>
            {done.failed === 0
              ? `✅ সব ${done.success}টি row সফলভাবে import হয়েছে!`
              : `⚠️ ${done.success}টি সফল, ${done.failed}টি ব্যর্থ (duplicate বা অন্য error)`}
          </p>
          <p className="text-xs text-gray-500 mt-1">Dashboard বা Submissions page-এ গিয়ে data দেখুন।</p>
        </div>
      )}
    </div>
  )
}