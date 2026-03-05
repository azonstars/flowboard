import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#f59e0b', '#22c55e', '#ef4444', '#94a3b8']
const STATUS_COLORS = {
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-600',
}

export default function CentralCheckerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalBranches: 0, todaySubmissions: 0, totalSubmissions: 0, pendingSubmissions: 0 })
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [statusData, setStatusData] = useState([])

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const [branches, todaySub, totalSub, pendingSub, recent] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact' }),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('submission_date', today),
        supabase.from('form_submissions').select('id', { count: 'exact' }),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'submitted'),
        supabase.from('form_submissions').select('*, forms(title), branches(name)')
          .order('created_at', { ascending: false }).limit(8),
      ])
      setStats({
        totalBranches: branches.count || 0,
        todaySubmissions: todaySub.count || 0,
        totalSubmissions: totalSub.count || 0,
        pendingSubmissions: pendingSub.count || 0,
      })
      setRecentSubmissions(recent.data || [])

      // গত ৭ দিন
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        days.push(d.toISOString().split('T')[0])
      }
      const weeklyResults = await Promise.all(
        days.map(day => supabase.from('form_submissions').select('id', { count: 'exact' }).eq('submission_date', day))
      )
      setWeeklyData(days.map((day, i) => ({ date: day.slice(5), submissions: weeklyResults[i].count || 0 })))

      // Status breakdown
      const [approved, rejected] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'approved'),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'rejected'),
      ])
      setStatusData([
        { name: 'Pending', value: pendingSub.count || 0 },
        { name: 'Approved', value: approved.count || 0 },
        { name: 'Rejected', value: rejected.count || 0 },
      ])
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}! 👋</h1>
        <p className="text-gray-500 mt-1">Central Checker Dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Total Branches</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalBranches}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Today's Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.todaySubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Total Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalSubmissions}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Pending Review</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.pendingSubmissions}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">📊 গত ৭ দিনের Submissions</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="submissions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Submissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">🥧 Submission Status</h2>
          {statusData.every(d => d.value === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400"><p>কোনো data নেই</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Recent Submissions</h2>
          <button onClick={() => navigate('/submissions')} className="text-sm text-blue-600 hover:underline">
            সব দেখুন →
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {recentSubmissions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No submissions yet.</div>
          ) : (
            recentSubmissions.map(sub => (
              <div key={sub.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{sub.forms?.title}</p>
                  <p className="text-sm text-gray-500">{sub.branches?.name} | {sub.submission_date}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                  {sub.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}