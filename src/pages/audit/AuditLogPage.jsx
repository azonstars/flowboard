import { useState, useEffect } from 'react'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'
import { getActivityLogs, getMyActivity, ACTION_LABELS } from '../../services/auditService'
import { getUsers } from '../../services/userService'

const ROLE_LABELS = {
  admin: 'Admin', central_checker: 'Central', divisional_checker: 'Divisional',
  regional_checker: 'Regional', branch_manager: 'Manager', branch_employee: 'Employee'
}
const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700', central_checker: 'bg-purple-100 text-purple-700',
  divisional_checker: 'bg-blue-100 text-blue-700', regional_checker: 'bg-cyan-100 text-cyan-700',
  branch_manager: 'bg-green-100 text-green-700', branch_employee: 'bg-gray-100 text-gray-700'
}

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'এইমাত্র'
  if (m < 60) return `${m} মিনিট আগে`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ঘণ্টা আগে`
  const d = Math.floor(h / 24)
  return `${d} দিন আগে`
}

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('bn-BD', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
}

export default function AuditLogPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState(weekAgo)
  const [filterTo, setFilterTo] = useState(today)
  const [page, setPage] = useState(0)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'mine' | 'login'
  const LIMIT = 30

  useEffect(() => { if (isAdmin) loadUsers() }, [])
  useEffect(() => { loadLogs() }, [filterUser, filterAction, filterFrom, filterTo, page, activeTab])

  const loadUsers = async () => {
    try { const data = await getUsers(); setUsers(data || []) } catch (e) {}
  }

  const loadLogs = async () => {
    setLoading(true)
    try {
      if (!isAdmin || activeTab === 'mine') {
        const data = await getMyActivity(profile.id, 50)
        setLogs(data || []); setTotal(data?.length || 0)
      } else {
        const { data, count } = await getActivityLogs({
          userId: filterUser || null,
          action: (activeTab === 'login' ? 'LOGIN' : filterAction) || null,
          dateFrom: filterFrom,
          dateTo: filterTo,
          limit: LIMIT,
          offset: page * LIMIT,
        })
        setLogs(data || []); setTotal(count || 0)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const resetFilters = () => {
    setFilterUser(''); setFilterAction(''); setFilterFrom(weekAgo); setFilterTo(today); setPage(0)
  }

  // Stats for summary cards
  const actionCounts = logs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1; return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Activity & Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'সকল user-এর activity দেখুন' : 'আপনার নিজের activity'}
          </p>
        </div>
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
          মোট <span className="font-bold text-blue-600">{total}</span>টি record
        </div>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex gap-2 flex-wrap">
          {[
            { k: 'all', l: '📋 সব Activity' },
            { k: 'login', l: '🔐 Login History' },
            { k: 'mine', l: '👤 আমার Activity' },
          ].map(t => (
            <button key={t.k} onClick={() => { setActiveTab(t.k); setPage(0) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm
                ${activeTab === t.k ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {t.l}
            </button>
          ))}
        </div>
      )}

      {/* Filters — Admin all tab only */}
      {isAdmin && activeTab === 'all' && (
        <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">User</label>
            <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0) }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-40">
              <option value="">সব User</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Action</label>
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">সব Action</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0) }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(0) }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </div>
          <button onClick={resetFilters}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
            🔄 Reset
          </button>
        </div>
      )}

      {/* Summary chips */}
      {Object.keys(actionCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(actionCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([action, cnt]) => (
            <span key={action} className="bg-white shadow-sm border border-gray-100 text-xs px-3 py-1.5 rounded-full text-gray-600">
              {ACTION_LABELS[action] || action} <span className="font-bold text-blue-600 ml-1">{cnt}</span>
            </span>
          ))}
        </div>
      )}

      {/* Log Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">
            <p className="text-2xl mb-2">⏳</p><p className="text-sm">Loading...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <EmptyState type="activity" title="কোনো activity পাওয়া যায়নি" description="নির্বাচিত সময়ে কোনো লগ নেই" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold">সময়</th>
                  {isAdmin && activeTab !== 'mine' && (
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold">User</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold">Action</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold">বিস্তারিত</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-gray-800 font-medium text-xs">{formatDate(log.created_at)}</div>
                      <div className="text-gray-400 text-xs">{timeAgo(log.created_at)}</div>
                    </td>
                    {isAdmin && activeTab !== 'mine' && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{log.user_name || '—'}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[log.role] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[log.role] || log.role}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-700">{ACTION_LABELS[log.action] || log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs">
                      {log.target_label && <span className="text-gray-700">"{log.target_label}"</span>}
                      {log.target_type && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{log.target_type}</span>}
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <span className="ml-2 text-xs text-gray-400">
                          {Object.entries(log.meta).slice(0,2).map(([k,v])=>`${k}: ${v}`).join(' • ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {isAdmin && activeTab === 'all' && total > LIMIT && (
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {page * LIMIT + 1}–{Math.min((page+1)*LIMIT, total)} / {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}
                className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition">
                ← আগে
              </button>
              <button onClick={() => setPage(p=>p+1)} disabled={(page+1)*LIMIT >= total}
                className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition">
                পরে →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}