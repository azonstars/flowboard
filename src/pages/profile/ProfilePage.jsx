import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import { ROLE_LABELS } from '../../constants/roles'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { profile, fetchProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  })
  const [pwData, setPwData] = useState({ current: '', newPw: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false })

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

  const handlePasswordChange = async () => {
    if (!pwData.current) { toast.error('বর্তমান password লিখুন!'); return }
    if (pwData.newPw.length < 6) { toast.error('নতুন password কমপক্ষে ৬ অক্ষর হতে হবে!'); return }
    if (pwData.newPw !== pwData.confirm) { toast.error('নতুন password দুটো মিলছে না!'); return }

    setPwSaving(true)
    try {
      // বর্তমান password দিয়ে re-authenticate
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: pwData.current,
      })
      if (signInError) { toast.error('বর্তমান password ভুল!'); return }

      // নতুন password সেট করো
      const { error } = await supabase.auth.updateUser({ password: pwData.newPw })
      if (error) throw error

      toast.success('Password পরিবর্তন হয়েছে!')
      setPwData({ current: '', newPw: '', confirm: '' })
    } catch (error) {
      toast.error(error.message)
    } finally {
      setPwSaving(false)
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

  const PwInput = ({ label, field, placeholder, autoFocus }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={showPw[field] ? 'text' : 'password'}
          value={pwData[field]}
          onChange={e => setPwData({ ...pwData, [field]: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
          autoFocus={autoFocus}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder}
        />
        <button type="button"
          onClick={() => setShowPw(prev => ({ ...prev, [field]: !prev[field] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPw[field] ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Avatar Card */}
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

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            👤 Profile Info
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'password' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🔒 Password Change
          </button>
        </div>

        {/* Profile Info Tab */}
        {activeTab === 'info' && (
          <>
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
                  <input type="text" value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="আপনার পূর্ণ নাম" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="01XXXXXXXXX" />
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
                    <span className="text-sm text-gray-500 w-32 shrink-0">{row.label}</span>
                    <span className="text-sm font-medium text-gray-800 break-all">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">নতুন password কমপক্ষে ৬ অক্ষর হতে হবে।</p>
            <PwInput label="বর্তমান Password" field="current" placeholder="বর্তমান password লিখুন" autoFocus />
            <PwInput label="নতুন Password" field="newPw" placeholder="নতুন password লিখুন" />
            <PwInput label="নতুন Password নিশ্চিত করুন" field="confirm" placeholder="আবার লিখুন" />

            {pwData.newPw && pwData.confirm && pwData.newPw !== pwData.confirm && (
              <p className="text-xs text-red-500">⚠️ Password দুটো মিলছে না</p>
            )}
            {pwData.newPw && pwData.confirm && pwData.newPw === pwData.confirm && (
              <p className="text-xs text-green-500">✅ Password মিলেছে</p>
            )}

            <button onClick={handlePasswordChange} disabled={pwSaving}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 mt-2">
              {pwSaving ? 'Changing...' : '🔒 Password পরিবর্তন করুন'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}