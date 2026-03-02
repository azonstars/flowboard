import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { useNavigate } from 'react-router-dom'

export default function CentralCheckerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalBranches: 0,
    todaySubmissions: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
  })
  const [recentSubmissions, setRecentSubmissions] = useState([])

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
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      setStats({
        totalBranches: branches.count || 0,
        todaySubmissions: todaySub.count || 0,
        totalSubmissions: totalSub.count || 0,
        pendingSubmissions: pendingSub.count || 0,
      })
      setRecentSubmissions(recent.data || [])
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, {profile?.full_name}! 👋
        </h1>
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

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Recent Submissions</h2>
          <button
            onClick={() => navigate('/reports')}
            className="text-sm text-blue-600 hover:underline"
          >
            View Reports →
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
                <span className={`px-2 py-1 rounded-full text-xs ${
                  sub.status === 'submitted' ? 'bg-green-100 text-green-700' :
                  sub.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
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