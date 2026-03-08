import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const STATUS_COLORS = {
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-600',
}

export default function RegionalCheckerDashboard() {
  const { profile, appSettings } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalBranches: 0, todaySubmissions: 0, totalSubmissions: 0, pendingSubmissions: 0 })
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [branchData, setBranchData] = useState([])

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: branches } = await supabase.from('branches').select('branch_code, name').eq('region_id', profile?.region_id)
      const branchCodes = branches?.map(b => b.branch_code) || []

      if (branchCodes.length === 0) return

      const [todaySub, totalSub, pendingSub, recent] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' }).in('branch_code', branchCodes).eq('submission_date', today),
        supabase.from('form_submissions').select('id', { count: 'exact' }).in('branch_code', branchCodes),
        supabase.from('form_submissions').select('id', { count: 'exact' }).in('branch_code', branchCodes).eq('status', 'submitted'),
        supabase.from('form_submissions').select('*, forms(title), branches(name)').in('branch_code', branchCodes).order('created_at', { ascending: false }).limit(8),
      ])
      setStats({ totalBranches: branchCodes.length, todaySubmissions: todaySub.count || 0, totalSubmissions: totalSub.count || 0, pendingSubmissions: pendingSub.count || 0 })
      setRecentSubmissions(recent.data || [])

      // গত ৭ দিন
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        days.push(d.toISOString().split('T')[0])
      }
      const weeklyResults = await Promise.all(
        days.map(day => supabase.from('form_submissions').select('id', { count: 'exact' }).in('branch_code', branchCodes).eq('submission_date', day))
      )
      setWeeklyData(days.map((day, i) => ({ date: day.slice(5), submissions: weeklyResults[i].count || 0 })))

      // Branch-wise today submissions
      const branchResults = await Promise.all(
        (branches || []).map(b =>
          supabase.from('form_submissions').select('id', { count: 'exact' }).eq('branch_code', b.branch_code).eq('submission_date', today)
            .then(res => ({ name: b.name || b.branch_code, submissions: res.count || 0 }))
        )
      )
      setBranchData(branchResults)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}! 👋</h1>
        <p className="text-gray-500 mt-1">Regional Checker Dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Region Branches</p>
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
          <h2 className="font-bold text-gray-800 mb-4">🏢 আজকের Branch-wise Submissions</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={branchData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="submissions" radius={[0, 4, 4, 0]} name="Submissions">
                {branchData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#3b82f6' : '#8b5cf6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Recent Submissions</h2>
          {appSettings?.feature_checker_all_submissions_btn !== false && (
            <button onClick={() => navigate('/submissions')} className="text-sm text-blue-600 hover:underline">সব দেখুন →</button>
          )}
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