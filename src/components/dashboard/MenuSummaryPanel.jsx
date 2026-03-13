import { useState, useEffect } from 'react'
import { getDashboardMenuSummary } from '../../services/dashboardSummaryService'
import { useAuth } from '../../context/AuthContext'

const formatNumber = (val) => {
  if (val >= 10000000) return (val / 10000000).toFixed(2) + ' কোটি'
  if (val >= 100000)   return (val / 100000).toFixed(2) + ' লক্ষ'
  if (val >= 1000)     return val.toLocaleString('bn-BD')
  return val.toString()
}

export default function MenuSummaryPanel({ branchCode = null, regionId = null, divisionId = null }) {
  const { appSettings } = useAuth()
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [openParents, setOpenParents] = useState({})
  const isFiscal = appSettings?.fiscal_year_mode !== false

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await getDashboardMenuSummary({ isFiscal, branchCode, regionId, divisionId })
        setSummary(data)
        if (data.length > 0) setOpenParents({ [data[0].parentId]: true })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isFiscal, branchCode, regionId, divisionId])

  const toggleParent = (id) => setOpenParents(p => ({ ...p, [id]: !p[id] }))

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-4" />
      {[1,2,3].map(i => (
        <div key={i} className="mb-3">
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse mb-2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-4">
            {[1,2,3,4].map(j => <div key={j} className="h-16 bg-gray-50 rounded-lg animate-pulse" />)}
          </div>
        </div>
      ))}
    </div>
  )

  if (!summary.length) return null

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">📊 মেনু-ভিত্তিক সারসংক্ষেপ</h3>
          <p className="text-xs text-gray-400 mt-0.5">{summary[0]?.yearLabel}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${isFiscal ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
          {isFiscal ? 'অর্থবছর' : 'ক্যালেন্ডার'}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {summary.map(parent => (
          <div key={parent.parentId}>
            <button
              onClick={() => toggleParent(parent.parentId)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition text-left">
              <div className="flex items-center gap-2">
                <span className="text-base">{parent.parentIcon || '📁'}</span>
                <span className="font-semibold text-gray-700 text-sm">{parent.parentLabel}</span>
                <span className="text-xs text-gray-400">({parent.forms.length}টি ফর্ম)</span>
              </div>
              <span className="text-gray-400 text-xs">{openParents[parent.parentId] ? '▲' : '▼'}</span>
            </button>
            {openParents[parent.parentId] && (
              <div className="px-4 pb-4 space-y-4 bg-gray-50">
                {parent.forms.map(form => (
                  <div key={form.formId} className="pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-gray-600">{form.formTitle}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${form.mode === 'latest' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {form.mode === 'latest' ? 'সর্বশেষ' : 'সর্বমোট'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {form.fields.map((f, i) => (
                        <div key={i} className="bg-white rounded-lg px-3 py-2.5 border border-gray-100 shadow-sm">
                          <p className="text-xs text-gray-500 leading-tight truncate">{f.fieldLabel}</p>
                          <p className="text-xs text-gray-400">{f.subLabel}</p>
                          <p className={`text-sm font-bold mt-1 ${f.type === 'amount' ? 'text-green-700' : 'text-blue-700'}`}>
                            {formatNumber(f.value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
