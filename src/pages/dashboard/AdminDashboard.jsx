import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ branches: 0, users: 0, forms: 0, submissions: 0 })
  const [weeklyData, setWeeklyData] = useState([])
  const [statusData, setStatusData] = useState([])

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [branches, users, forms, submissions] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('forms').select('id', { count: 'exact' }),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('submission_date', today),
      ])
      setStats({
        branches: branches.count || 0,
        users: users.count || 0,
        forms: forms.count || 0,
        submissions: submissions.count || 0,
      })

      // গত ৭ দিনের submission data
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(d.toISOString().split('T')[0])
      }
      const weeklyResults = await Promise.all(
        days.map(day =>
          supabase.from('form_submissions').select('id', { count: 'exact' }).eq('submission_date', day)
        )
      )
      setWeeklyData(days.map((day, i) => ({
        date: day.slice(5), // MM-DD
        submissions: weeklyResults[i].count || 0,
      })))

      // Status breakdown
      const [submitted, approved, rejected, draft] = await Promise.all([
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'submitted'),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'approved'),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'rejected'),
        supabase.from('form_submissions').select('id', { count: 'exact' }).eq('status', 'draft'),
      ])
      setStatusData([
        { name: 'Pending', value: submitted.count || 0 },
        { name: 'Approved', value: approved.count || 0 },
        { name: 'Rejected', value: rejected.count || 0 },
        { name: 'Draft', value: draft.count || 0 },
      ])
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile?.full_name}! 👋</h1>
        <p className="text-gray-500 mt-1">Here's what's happening today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Total Branches</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.branches}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.users}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Total Forms</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.forms}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-purple-500">
          <p className="text-sm text-gray-500">Today's Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.submissions}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Bar Chart */}
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

        {/* Status Pie Chart */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">🥧 Submission Status</h2>
          {statusData.every(d => d.value === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <p>কোনো data নেই</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}