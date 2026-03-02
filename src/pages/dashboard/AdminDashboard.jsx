import { useAuth } from '../../context/AuthContext'

export default function AdminDashboard() {
  const { profile } = useAuth()

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
          <p className="text-3xl font-bold text-gray-800 mt-1">0</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">0</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Total Forms</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">0</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-purple-500">
          <p className="text-sm text-gray-500">Today's Submissions</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">0</p>
        </div>
      </div>
    </div>
  )
}