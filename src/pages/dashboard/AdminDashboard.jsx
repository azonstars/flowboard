import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    branches: 0,
    users: 0,
    forms: 0,
    submissions: 0,
  })

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
        <p className="text-gray-500 mt-1">Here's what's happening today.</p>
      </div>

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
    </div>
  )
}