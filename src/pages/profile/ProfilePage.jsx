import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { ROLE_LABELS } from '../../constants/roles'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { profile, fetchProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  })

  const handleSave = async () => {
    if (!formData.full_name.trim()) { toast.error('নাম লিখুন!'); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: formData.full_name, phone: formData.phone })
        .eq('id', profile.id)
      if (error) throw error
      await fetchProfile(profile.id)
      toast.success('Profile আপডেট হয়েছে!')
      setEditing(false)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const avatarLetter = profile?.full_name?.charAt(0).toUpperCase()

  const infoRows = [
    { label: 'পূর্ণ নাম', value: profile?.full_name, icon: '👤' },
    { label: 'Email', value: profile?.email, icon: '📧' },
    { label: 'Role', value: ROLE_LABELS[profile?.role] || profile?.role, icon: '🎭' },
    { label: 'Branch Code', value: profile?.branch_code || '—', icon: '🏢' },
    { label: 'Phone', value: profile?.phone || '—', icon: '📱' },
    { label: 'Status', value: profile?.is_active ? 'Active ✅' : 'Inactive ❌', icon: '🔘' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center text-center">
        <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold mb-4">
          {avatarLetter}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">{profile?.full_name}</h1>
        <p className="text-gray-500 mt-1">{ROLE_LABELS[profile?.role] || profile?.role}</p>
        {profile?.branch_code && (
          <span className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            🏢 Branch: {profile.branch_code}
          </span>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Profile Information</h2>
          {!editing && (
            <button
              onClick={() => { setEditing(true); setFormData({ full_name: profile?.full_name || '', phone: profile?.phone || '' }) }}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">পূর্ণ নাম <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="আপনার পূর্ণ নাম"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="01XXXXXXXXX"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : '💾 Save করুন'}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition text-sm">
                বাতিল
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {infoRows.map((row, i) => (
              <div key={i} className="flex items-center px-6 py-4">
                <span className="text-xl w-8">{row.icon}</span>
                <span className="text-sm text-gray-500 w-32">{row.label}</span>
                <span className="text-sm font-medium text-gray-800">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}