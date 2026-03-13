import { useState, useEffect } from 'react'
import { SkeletonDashboard, SkeletonStatCard } from '../../components/ui/Skeleton'
import { useAuth } from '../../context/AuthContext'
import MenuSummaryPanel from '../../components/dashboard/MenuSummaryPanel'
import { supabase } from '../../services/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const ActivityHeatmap = ({ data }) => {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const getColor = (count) => {
    if (count === 0) return 'bg-gray-100'
    const pct = count / max
    if (pct < 0.25) return 'bg-blue-100'
    if (pct < 0.5) return 'bg-blue-300'
    if (pct < 0.75) return 'bg-blue-500'
    return 'bg-blue-700'
  }
  const weeks = []
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7))
  const dayLabels = ['রবি', 'সোম', 'মঙ্গ', 'বুধ', 'বৃহ', 'শুক্র', 'শনি']
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map(d => <div key={d} className="h-4 w-8 text-xs text-gray-400 flex items-center">{d}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = week[di]
              return <div key={di} title={cell ? `${cell.date}: ${cell.count}টি` : ''}
                className={`w-4 h-4 rounded-sm ${cell ? getColor(cell.count) : 'bg-gray-50'} cursor-pointer transition-transform hover:scale-125`} />
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
        <span>কম</span>
        {['bg-gray-100','bg-blue-100','bg-blue-300','bg-blue-500','bg-blue-700'].map((c,i) => <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />)}
        <span>বেশি</span>
      </div>
      <MenuSummaryPanel />
    </div>
  )
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ branches:0, users:0, forms:0, submissions:0, pending:0, approved:0 })
  const [weeklyData, setWeeklyData] = useState([])
  const [statusData, setStatusData] = useState([])
  const [topBranches, setTopBranches] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [formBreakdown, setFormBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30*86400000).toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo, setDateTo] = useState(today)

  useEffect(() => { loadAll() }, [dateFrom, dateTo])

  const loadAll = async () => {
    setLoading(true)
    try { await Promise.all([loadStats(), loadCharts(), loadTopBranches(), loadHeatmap(), loadFormBreakdown()]) }
    finally { setLoading(false) }
  }

  const loadStats = async () => {
    const [br, us, fm, td, pe, ap] = await Promise.all([
      supabase.from('branches').select('id',{count:'exact',head:true}),
      supabase.from('profiles').select('id',{count:'exact',head:true}),
      supabase.from('forms').select('id',{count:'exact',head:true}).eq('is_active',true),
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('submission_date',today),
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('status','submitted'),
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('status','approved').gte('submission_date',dateFrom).lte('submission_date',dateTo),
    ])
    setStats({ branches:br.count||0, users:us.count||0, forms:fm.count||0, submissions:td.count||0, pending:pe.count||0, approved:ap.count||0 })
  }

  const loadCharts = async () => {
    const days=[], from=new Date(dateFrom), to=new Date(dateTo)
    for(let d=new Date(from);d<=to;d.setDate(d.getDate()+1)) days.push(new Date(d).toISOString().split('T')[0])
    const step = days.length > 60 ? 7 : 1
    const sampled = days.filter((_,i) => i%step===0)
    const results = await Promise.all(sampled.map(day =>
      supabase.from('form_submissions').select('id',{count:'exact',head:true})
        .gte('submission_date',day)
        .lte('submission_date', step>1 ? new Date(new Date(day).getTime()+6*86400000).toISOString().split('T')[0] : day)
    ))
    setWeeklyData(sampled.map((day,i) => ({ date:day.slice(5), submissions:results[i].count||0 })))

    const [sub,app,rej,dft] = await Promise.all([
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('status','submitted').gte('submission_date',dateFrom).lte('submission_date',dateTo),
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('status','approved').gte('submission_date',dateFrom).lte('submission_date',dateTo),
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('status','rejected').gte('submission_date',dateFrom).lte('submission_date',dateTo),
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('status','draft').gte('submission_date',dateFrom).lte('submission_date',dateTo),
    ])
    setStatusData([
      {name:'Pending',value:sub.count||0},{name:'Approved',value:app.count||0},
      {name:'Rejected',value:rej.count||0},{name:'Draft',value:dft.count||0},
    ])
  }

  const loadTopBranches = async () => {
    const {data:branches} = await supabase.from('branches').select('branch_code,name').limit(20)
    if(!branches?.length) return
    const results = await Promise.all(branches.map(b =>
      supabase.from('form_submissions').select('id',{count:'exact',head:true})
        .eq('branch_code',b.branch_code).gte('submission_date',dateFrom).lte('submission_date',dateTo)
        .then(r => ({name:b.name||b.branch_code, code:b.branch_code, count:r.count||0}))
    ))
    setTopBranches(results.sort((a,b)=>b.count-a.count).slice(0,8))
  }

  const loadHeatmap = async () => {
    const start = new Date(); start.setDate(start.getDate()-62)
    start.setDate(start.getDate()-start.getDay())
    const hDays = Array.from({length:63},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d.toISOString().split('T')[0]})
    const results = await Promise.all(hDays.map(day =>
      supabase.from('form_submissions').select('id',{count:'exact',head:true}).eq('submission_date',day)
        .then(r=>({date:day,count:r.count||0}))
    ))
    setHeatmapData(results)
  }

  const loadFormBreakdown = async () => {
    const {data:forms} = await supabase.from('forms').select('id,title').eq('is_active',true)
    if(!forms?.length) return
    const results = await Promise.all(forms.map(f =>
      supabase.from('form_submissions').select('id',{count:'exact',head:true})
        .eq('form_id',f.id).gte('submission_date',dateFrom).lte('submission_date',dateTo)
        .then(r=>({name:f.title,count:r.count||0}))
    ))
    setFormBreakdown(results.filter(f=>f.count>0).sort((a,b)=>b.count-a.count))
  }

  const setRange = (days) => {
    setDateFrom(new Date(Date.now()-days*86400000).toISOString().split('T')[0])
    setDateTo(today)
  }

  if (loading) return <SkeletonDashboard />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}! 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Admin Analytics Dashboard</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">📅</span>
          {[{l:'৭ দিন',d:7},{l:'৩০ দিন',d:30},{l:'৯০ দিন',d:90}].map(({l,d})=>{
            const from = new Date(Date.now()-d*86400000).toISOString().split('T')[0]
            return <button key={d} onClick={()=>setRange(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dateFrom===from&&dateTo===today?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
          })}
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          <span className="text-gray-400 text-xs">→</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"/>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{k:'overview',l:'📊 Overview'},{k:'branches',l:'🏢 Branches'},{k:'heatmap',l:'🗓 Activity'},{k:'forms',l:'📋 Forms'}].map(t=>(
          <button key={t.k} onClick={()=>setActiveTab(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm ${activeTab===t.k?'bg-blue-600 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>{t.l}</button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {label:'Branches',value:stats.branches,color:'border-blue-500',icon:'🏢'},
          {label:'Users',value:stats.users,color:'border-purple-500',icon:'👥'},
          {label:'Active Forms',value:stats.forms,color:'border-yellow-500',icon:'📋'},
          {label:'আজকের',value:stats.submissions,color:'border-green-500',icon:'📬'},
          {label:'Pending',value:stats.pending,color:'border-orange-500',icon:'⏳'},
          {label:'Approved',value:stats.approved,color:'border-emerald-500',icon:'✅'},
        ].map((s,i)=>(
          <div key={i} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${s.color}`}>
            <p className="text-xs text-gray-500">{s.icon} {s.label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* OVERVIEW */}
        {activeTab==='overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-1">📈 Submission Trend</h2>
              <p className="text-xs text-gray-400 mb-4">{dateFrom} → {dateTo}</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyData}>
                  <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="date" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} allowDecimals={false}/>
                  <Tooltip/>
                  <Area type="monotone" dataKey="submissions" stroke="#3b82f6" fill="url(#grad)" strokeWidth={2} name="Submissions"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-1">🥧 Status Breakdown</h2>
              <p className="text-xs text-gray-400 mb-4">মোট {statusData.reduce((s,d)=>s+d.value,0)}টি</p>
              {statusData.every(d=>d.value===0)
                ? <div className="flex items-center justify-center h-48 text-gray-400 text-sm">এই range-এ কোনো data নেই</div>
                : <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData.filter(d=>d.value>0)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,value})=>`${name}:${value}`} labelLine={false}>
                        {statusData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie><Tooltip/><Legend/>
                    </PieChart>
                  </ResponsiveContainer>}
            </div>
          </div>
        )}

        {/* BRANCHES */}
        {activeTab==='branches' && (
          <div className="bg-white rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="font-bold text-gray-800 mb-5">🏆 Top Performing Branches <span className="text-xs font-normal text-gray-400">({dateFrom} → {dateTo})</span></h2>
              {topBranches.length===0
                ? <p className="text-center text-gray-400 py-8">কোনো data নেই</p>
                : <div className="space-y-3">
                    {topBranches.map((b,i)=>{
                      const pct = Math.round((b.count/(topBranches[0]?.count||1))*100)
                      const medals=['🥇','🥈','🥉']
                      return (
                        <div key={b.code} className="flex items-center gap-3">
                          <span className="text-lg w-7 shrink-0">{medals[i]||`${i+1}.`}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium text-gray-800">{b.name}</span>
                              <span className="text-sm font-bold text-blue-600">{b.count}টি</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{width:`${pct}%`,background:i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#b45309':'#3b82f6'}}/>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>}
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-4">📊 Comparison Chart</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topBranches} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={90}/>
                  <Tooltip/>
                  <Bar dataKey="count" name="Submissions" radius={[0,4,4,0]}>
                    {topBranches.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* HEATMAP */}
        {activeTab==='heatmap' && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-1">🗓 Activity Heatmap</h2>
            <p className="text-xs text-gray-400 mb-5">গত ৯ সপ্তাহের submission activity</p>
            <ActivityHeatmap data={heatmapData}/>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">📅 সবচেয়ে সক্রিয় দিন</h3>
                {[...heatmapData].filter(d=>d.count>0).sort((a,b)=>b.count-a.count).slice(0,5).map((d,i)=>(
                  <div key={d.date} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-600">{i+1}. {d.date}</span>
                    <span className="font-bold text-blue-600">{d.count}টি</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">📊 বারের গড়</h3>
                {['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'].map((name,i)=>{
                  const items = heatmapData.filter((_,idx)=>new Date(heatmapData[idx]?.date).getDay()===i)
                  const avg = items.length ? (items.reduce((s,d)=>s+d.count,0)/items.length).toFixed(1) : 0
                  return (
                    <div key={name} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-600">{name}</span>
                      <span className="font-semibold text-gray-700">{avg} গড়</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* FORMS */}
        {activeTab==='forms' && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-5">📋 Form-wise Breakdown <span className="text-xs font-normal text-gray-400">({dateFrom} → {dateTo})</span></h2>
            {formBreakdown.length===0
              ? <p className="text-center text-gray-400 py-8">এই range-এ কোনো submission নেই</p>
              : <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={formBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} allowDecimals={false}/>
                      <Tooltip/>
                      <Bar dataKey="count" name="Submissions" radius={[4,4,0,0]}>
                        {formBreakdown.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-5 divide-y divide-gray-100">
                    {formBreakdown.map((f,i)=>{
                      const total = formBreakdown.reduce((s,d)=>s+d.count,0)
                      const pct = total?Math.round((f.count/total)*100):0
                      return (
                        <div key={f.name} className="py-3 flex items-center gap-3">
                          <span className="text-sm text-gray-400 w-5">{i+1}.</span>
                          <span className="flex-1 text-sm font-medium text-gray-800">{f.name}</span>
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width:`${pct}%`}}/>
                          </div>
                          <span className="text-sm font-bold text-blue-600 w-12 text-right">{f.count}টি</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>}
          </div>
        )}
      <MenuSummaryPanel />
    </div>
  )
}