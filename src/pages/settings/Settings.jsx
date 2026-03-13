import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getForms, updateForm, deleteForm } from '../../services/formService'
import { getMenuItems, updateMenuItem, createMenuItem, deleteMenuItem } from '../../services/menuService'
import { getReportLayouts } from '../../services/reportService'
import { getAllAppSettings, updateAppSetting, uploadFavicon, applyFavicon } from '../../services/appSettingsService'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const AVAILABLE_ICONS = [
  '🏠','📊','📋','🔨','📈','👥','🏢','🔒','⚙️','📝',
  '💰','📦','🎯','📅','🔔','💼','🌐','📱','🔍','✅',
  '📌','🗂️','📁','🏦','💳','🤝','📣','🧾','🔑','🏷️',
  '📉','📤','📥','🖨️','🖥️','💡','🔧','🔎','🏆','⭐',
]

const ALL_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'central_checker', label: 'Central Checker' },
  { value: 'divisional_checker', label: 'Divisional Checker' },
  { value: 'regional_checker', label: 'Regional Checker' },
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'branch_employee', label: 'Branch Employee' },
]

const SortableItem = ({ item, onToggleExpand, expandedId, onUpdate, onRemove, onAddSubMenu, onChangeParent, allForms, allReports, menuStructure }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showSubMenuForm, setShowSubMenuForm] = useState(false)
  const [subItem, setSubItem] = useState({ label: '', path: '', icon: '📌', link_type: 'custom', roles: [] })
  const [showSubIconPicker, setShowSubIconPicker] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isExpanded = expandedId === item.id
  const itemRoles = item.roles || []
  const children = item.children || []
  const isVisible = item.is_active !== false
  const isSubItem = !!item.parent_id
  const possibleParents = menuStructure.filter(m => m.id !== item.id && m._type !== 'form')

  return (
    <div ref={setNodeRef} style={style} className={`mb-2 ${isSubItem ? 'ml-8' : ''}`}>
      <div className={`border rounded-lg bg-white ${isDragging ? 'shadow-xl border-blue-300' : 'shadow-sm'} ${isSubItem ? 'border-l-4 border-l-blue-400' : ''}`}>
        {/* Header */}
        <div className="flex items-center gap-2 p-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <span className={`text-xl ${!isVisible ? 'opacity-40' : ''}`}>{item.icon || item.menu_icon || '📋'}</span>
          <div className="flex-1 min-w-0">
            <span className={`font-medium text-sm ${!isVisible ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {item.label || item.title}
            </span>
            {isSubItem && <span className="ml-2 text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">sub-menu</span>}
          </div>
          {children.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{children.length} sub</span>
          )}
          <button
            onClick={() => onUpdate(item, 'is_active', !isVisible)}
            className={`text-xs px-2 py-1 rounded-lg transition ${isVisible ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          >
            {isVisible ? '👁' : '🙈'}
          </button>
          <button onClick={() => onToggleExpand(item.id)} className="text-gray-400 hover:text-gray-600 transition ml-1">
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded */}
        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-4">

            {/* Parent Selection */}
            <div className="bg-blue-50 rounded-lg p-3">
              <label className="block text-xs font-medium text-blue-700 mb-1">📂 Parent Menu (Sub-menu of)</label>
              <select
                value={item.parent_id || ''}
                onChange={e => onChangeParent(item, e.target.value || null)}
                className="w-full border border-blue-200 bg-white rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Top Level (No Parent) —</option>
                {possibleParents.map(p => (
                  <option key={p.id} value={p.id}>{p.icon || '📋'} {p.label || p.title}</option>
                ))}
              </select>
              <p className="text-xs text-blue-500 mt-1">Select a parent to make this a sub-menu item</p>
            </div>

            {/* Label */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                type="text"
                value={item.label || item.title || ''}
                onChange={e => onUpdate(item, 'label', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Link To */}
            {item._type !== 'form' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Link To</label>
                <select
                  value={item.link_type || 'path'}
                  onChange={e => {
                    onUpdate(item, 'link_type', e.target.value)
                    if (e.target.value === 'blank') onUpdate(item, 'path', '#')
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  <option value="path">Custom Path</option>
                  <option value="form">Form (Submit Page)</option>
                  <option value="blank">Blank (No Link)</option>
                  <option value="report">Report Summary</option>
                </select>

                {item.link_type === 'form' ? (
                  <select
                    value={item.form_id || ''}
                    onChange={e => {
                      const form = allForms.find(f => f.id === e.target.value)
                      onUpdate(item, 'form_id', e.target.value)
                      onUpdate(item, 'path', `/forms/submit/${e.target.value}`)
                      if (form && !item.label) onUpdate(item, 'label', form.title)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Form</option>
                    {allForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                  </select>
                ) : item.link_type === 'blank' ? (
                  <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-500 border border-gray-200">
                    No link — item will only expand sub-menu
                  </div>
                ) : item.link_type === 'report' ? (
                  <select
                    value={item.report_id || ''}
                    onChange={e => {
                      onUpdate(item, 'report_id', e.target.value)
                      onUpdate(item, 'path', `/reports?report_id=${e.target.value}`)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Report</option>
                    {allReports.map(r => <option key={r.id} value={r.id}>{r.title || r.name}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={item.path || ''}
                    onChange={e => onUpdate(item, 'path', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="/dashboard"
                  />
                )}
              </div>
            )}

            {/* Icon */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Icon</label>
              <div className="relative">
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  <span className="text-xl">{item.icon || item.menu_icon || '📋'}</span>
                  <span className="text-gray-500">Change icon</span>
                </button>
                {showIconPicker && (
                  <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-72">
                    <div className="grid grid-cols-10 gap-1">
                      {AVAILABLE_ICONS.map(icon => (
                        <button key={icon} onClick={() => { onUpdate(item, 'icon', icon); setShowIconPicker(false) }}
                          className={`w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-blue-50 transition ${(item.icon || item.menu_icon) === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''}`}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Roles */}
            {item._type !== 'form' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Visible to Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map(role => (
                    <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemRoles.includes(role.value)}
                        onChange={e => {
                          const newRoles = e.target.checked
                            ? [...itemRoles, role.value]
                            : itemRoles.filter(r => r !== role.value)
                          onUpdate(item, 'roles', newRoles)
                        }}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-700">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Add Sub Menu */}
            {item._type !== 'form' && !isSubItem && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-600">Sub Menu Items</label>
                  <button onClick={() => setShowSubMenuForm(!showSubMenuForm)} className="text-xs text-blue-600 hover:underline">
                    + Add Sub Menu
                  </button>
                </div>

                {children.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {children.map(child => (
                      <div key={child.id} className="bg-blue-50 rounded-lg border-l-4 border-blue-300">
                        {/* Child preview row */}
                        <div className="flex items-center gap-2 p-2">
                          <span>{child.icon || '📌'}</span>
                          <span className="flex-1 text-sm text-gray-700">{child.label}</span>
                          <span className="text-xs text-gray-400 hidden sm:block">{child.path}</span>
                          <button
                            onClick={() => onUpdate(item, 'editingChild', child.id === item._editingChild ? null : child.id)}
                            className="text-xs text-blue-500 hover:text-blue-700 px-1"
                            title="Edit"
                          >✏️</button>
                          <button onClick={() => onUpdate(item, 'removeChild', child.id)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                        </div>

                        {/* Child edit form */}
                        {item._editingChild === child.id && (
                          <div className="px-3 pb-3 space-y-2 border-t border-blue-200">
                            <input type="text" value={child.label}
                              onChange={e => onUpdate(item, 'updateChild', { ...child, label: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Label" />
                            <input type="text" value={child.path || ''}
                              onChange={e => onUpdate(item, 'updateChild', { ...child, path: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Path (e.g. /reports)" />
                            {/* Child Icon Picker */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
                              <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-lg max-h-28 overflow-y-auto">
                                {AVAILABLE_ICONS.map(icon => (
                                  <button key={icon}
                                    onClick={() => onUpdate(item, 'updateChild', { ...child, icon })}
                                    className={`w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-blue-50 transition ${child.icon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''}`}>
                                    {icon}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Child Roles */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Visible to Roles</label>
                              <div className="grid grid-cols-2 gap-1">
                                {ALL_ROLES.map(role => (
                                  <label key={role.value} className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox"
                                      checked={(child.roles || []).includes(role.value)}
                                      onChange={e => {
                                        const newRoles = e.target.checked
                                          ? [...(child.roles || []), role.value]
                                          : (child.roles || []).filter(r => r !== role.value)
                                        onUpdate(item, 'updateChild', { ...child, roles: newRoles })
                                      }}
                                      className="rounded" />
                                    <span className="text-xs text-gray-700">{role.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => onUpdate(item, 'editingChild', null)}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                            >Done</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showSubMenuForm && (
                  <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                    <input type="text" placeholder="Label"
                      value={subItem.label}
                      onChange={e => setSubItem({ ...subItem, label: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select value={subItem.link_type}
                      onChange={e => setSubItem({ ...subItem, link_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="custom">Custom Path</option>
                      <option value="form">Form (Submit Page)</option>
                      <option value="blank">Blank (No Link)</option>
                      <option value="report">Report Summary</option>
                    </select>
                    {subItem.link_type === 'form' ? (
                      <select value={subItem.form_id || ''}
                        onChange={e => {
                          const form = allForms.find(f => f.id === e.target.value)
                          setSubItem({
                            ...subItem, form_id: e.target.value,
                            path: `/forms/submit/${e.target.value}`,
                            label: subItem.label || (form ? form.title : ''),
                          })
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Form</option>
                        {allForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                      </select>
                    ) : subItem.link_type === 'blank' ? (
                      <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-500 border border-gray-200">
                        No link — sub-menu only
                      </div>
                    ) : subItem.link_type === 'report' ? (
                      <select value={subItem.report_id || ''}
                        onChange={e => setSubItem({
                          ...subItem, report_id: e.target.value,
                          path: `/reports?report_id=${e.target.value}`,
                        })}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Report</option>
                        {allReports.map(r => <option key={r.id} value={r.id}>{r.title || r.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="Path (e.g. /reports)"
                        value={subItem.path}
                        onChange={e => setSubItem({ ...subItem, path: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    <div className="relative">
                      <button onClick={() => setShowSubIconPicker(!showSubIconPicker)}
                        className="flex items-center gap-2 border border-gray-300 bg-white rounded-md px-3 py-1.5 text-sm hover:bg-gray-50 w-full"
                      >
                        <span className="text-xl">{subItem.icon}</span>
                        <span className="text-gray-500">Icon</span>
                      </button>
                      {showSubIconPicker && (
                        <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-72">
                          <div className="grid grid-cols-10 gap-1">
                            {AVAILABLE_ICONS.map(icon => (
                              <button key={icon} onClick={() => { setSubItem({ ...subItem, icon }); setShowSubIconPicker(false) }}
                                className={`w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-blue-50 transition ${subItem.icon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''}`}>
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Sub-menu Roles */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Visible to Roles</label>
                      <div className="grid grid-cols-2 gap-1">
                        {ALL_ROLES.map(role => (
                          <label key={role.value} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(subItem.roles || []).includes(role.value)}
                              onChange={e => {
                                const newRoles = e.target.checked
                                  ? [...(subItem.roles || []), role.value]
                                  : (subItem.roles || []).filter(r => r !== role.value)
                                setSubItem({ ...subItem, roles: newRoles })
                              }}
                              className="rounded"
                            />
                            <span className="text-xs text-gray-700">{role.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">কোনো role না দিলে সবাই দেখবে</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!subItem.label) { toast.error('Label required!'); return }
                          if (subItem.link_type !== 'blank' && !subItem.path) { toast.error('Path required!'); return }
                          onAddSubMenu(item, { ...subItem, path: subItem.link_type === 'blank' ? '#' : subItem.path })
                          setSubItem({ label: '', path: '', icon: '📌', link_type: 'custom', roles: [] })
                          setShowSubMenuForm(false)
                        }}
                        className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-sm hover:bg-blue-700"
                      >Add</button>
                      <button onClick={() => setShowSubMenuForm(false)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg text-sm hover:bg-gray-300">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button onClick={() => onRemove(item)} className="text-sm text-red-500 hover:text-red-700 hover:underline">
                Remove from Menu
              </button>
            </div>
          </div>
        )}

        {/* Sub items preview */}
        {children.length > 0 && !isExpanded && (
          <div className="border-t border-gray-100 ml-8 mr-3 mb-2 mt-1 space-y-1">
            {children.map(child => (
              <div key={child.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                <span className="text-sm">{child.icon || '📌'}</span>
                <span className="flex-1 text-xs text-gray-600">{child.label}</span>
                <span className="text-xs text-gray-400">
                  {child.roles?.length > 0 ? `${child.roles.length} roles` : 'সবাই'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const { fetchAllMenuData, user } = useAuth()
  const [allMenuItems, setAllMenuItems] = useState([])
  const [allForms, setAllForms] = useState([])
  const [allReports, setAllReports] = useState([])
  const [menuStructure, setMenuStructure] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leftTab, setLeftTab] = useState('menu')
  const [activeTab, setActiveTab] = useState('menu_manager') // menu_manager | features
  const [features, setFeatures] = useState([])
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconUrl, setFaviconUrl] = useState('')
  const [customLink, setCustomLink] = useState({ label: '', path: '', icon: '📌', link_type: 'path' })
  const [showIconPicker, setShowIconPicker] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (activeTab === 'features') loadFeatures() }, [activeTab])

  const loadFeatures = async () => {
    setFeaturesLoading(true)
    try {
      const data = await getAllAppSettings()
      setFeatures(data)
      // favicon url আলাদা রাখো
      const favicon = data.find(f => f.key === 'favicon_url')
      if (favicon?.value) setFaviconUrl(favicon.value)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setFeaturesLoading(false)
    }
  }

  const handleFaviconUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('PNG, JPG, SVG বা ICO ফাইল ব্যবহার করুন')
      return
    }
    if (file.size > 500 * 1024) {
      toast.error('ফাইল সাইজ ৫০০KB-এর বেশি হওয়া যাবে না')
      return
    }
    setFaviconUploading(true)
    try {
      const url = await uploadFavicon(file)
      setFaviconUrl(url)
      applyFavicon(url)
      toast.success('Favicon আপডেট হয়েছে! Page refresh করলে দেখা যাবে।')
    } catch (err) {
      toast.error('Upload ব্যর্থ: ' + err.message)
    } finally {
      setFaviconUploading(false)
      e.target.value = ''
    }
  }

  const handleToggleFeature = async (key, currentValue) => {
    try {
      await updateAppSetting(key, currentValue !== 'true')
      setFeatures(features.map(f => f.key === key ? { ...f, value: currentValue === 'true' ? 'false' : 'true' } : f))
      toast.success('Updated!')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const [items, forms] = await Promise.all([getMenuItems(), getForms()])
      setAllMenuItems(items)
      setAllForms(forms)

      try {
        const reports = await getReportLayouts(user?.id)
        setAllReports(reports || [])
      } catch {
        setAllReports([])
      }

      const parentItems = items
        .filter(i => !i.parent_id)
        .map(i => ({
          ...i, _type: 'menu',
          children: items.filter(c => c.parent_id === i.id)
        }))

      const formItems = forms
        .filter(f => f.show_in_menu)
        .map(f => ({
          ...f, _type: 'form',
          label: f.title, icon: f.menu_icon || '📋', children: [],
        }))

      const combined = [...parentItems, ...formItems]
        .sort((a, b) => (a.menu_order || 0) - (b.menu_order || 0))

      setMenuStructure(combined)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = menuStructure.findIndex(f => f.id === active.id)
    const newIndex = menuStructure.findIndex(f => f.id === over.id)
    setMenuStructure(arrayMove(menuStructure, oldIndex, newIndex))
  }

  const handleToggleExpand = (id) => setExpandedId(expandedId === id ? null : id)

  const handleUpdate = (item, key, value) => {
    setMenuStructure(menuStructure.map(m => {
      if (m.id !== item.id) return m
      if (key === 'removeChild') return { ...m, children: m.children.filter(c => c.id !== value) }
      if (key === 'editingChild') return { ...m, _editingChild: value }
      if (key === 'updateChild') return { ...m, children: m.children.map(c => c.id === value.id ? value : c) }
      return { ...m, [key]: value, ...(key === 'icon' ? { menu_icon: value } : {}) }
    }))
  }

  const handleChangeParent = (item, newParentId) => {
    if (newParentId) {
      const newStructure = menuStructure.map(m => ({
        ...m, children: (m.children || []).filter(c => c.id !== item.id)
      })).filter(m => m.id !== item.id)

      const parentIndex = newStructure.findIndex(m => m.id === newParentId)
      if (parentIndex !== -1) {
        newStructure[parentIndex] = {
          ...newStructure[parentIndex],
          children: [
            ...(newStructure[parentIndex].children || []),
            { ...item, parent_id: newParentId, _type: 'new_child' }
          ]
        }
      }
      setMenuStructure(newStructure)
      toast.success(`"${item.label}" is now a sub-menu!`)
    } else {
      const newStructure = menuStructure.map(m => ({
        ...m, children: (m.children || []).filter(c => c.id !== item.id)
      }))
      const alreadyTop = newStructure.find(m => m.id === item.id)
      if (!alreadyTop) {
        newStructure.push({ ...item, parent_id: null, _type: 'menu', children: item.children || [] })
      }
      setMenuStructure(newStructure)
      toast.success(`"${item.label}" moved to top level!`)
    }
    setExpandedId(null)
  }

  const handleRemove = (item) => {
    const newStructure = menuStructure
      .filter(m => m.id !== item.id)
      .map(m => ({ ...m, children: (m.children || []).filter(c => c.id !== item.id) }))
    setMenuStructure(newStructure)
    toast.success('Removed!')
  }

  const handleAddSubMenu = (parentItem, subItem) => {
    setMenuStructure(menuStructure.map(m => {
      if (m.id !== parentItem.id) return m
      return {
        ...m,
        children: [...(m.children || []), {
          ...subItem,
          id: `new_${Date.now()}`,
          _type: 'new_child',
          parent_id: parentItem.id,
          roles: parentItem.roles || ['admin'],
          menu_order: (m.children || []).length + 1,
          is_active: true,
        }]
      }
    }))
    toast.success('Sub menu added!')
  }

  const handleAddMenuItem = (item) => {
    if (menuStructure.find(m => m.id === item.id)) { toast.error('Already in menu!'); return }
    setMenuStructure([...menuStructure, {
      ...item, _type: 'menu',
      children: allMenuItems.filter(c => c.parent_id === item.id)
    }])
    toast.success(`${item.label} added!`)
  }

  const handleAddForm = (form) => {
    if (menuStructure.find(m => m.id === form.id)) { toast.error('Already in menu!'); return }
    setMenuStructure([...menuStructure, {
      ...form, _type: 'form',
      label: form.title, icon: form.menu_icon || '📋', children: [],
    }])
    toast.success(`${form.title} added!`)
  }

  const handleEditForm = (form) => {
    window.open(`/forms/builder?edit=${form.id}`, '_blank')
  }

  const handleDeleteForm = async (form) => {
    if (!window.confirm(`"${form.title}" ফর্মটি স্থায়ীভাবে ডিলিট করবেন?\nএই কাজটি আর ফেরানো যাবে না!`)) return
    try {
      await deleteForm(form.id)
      setAllForms(prev => prev.filter(f => f.id !== form.id))
      setMenuStructure(prev => prev.filter(m => m.id !== form.id))
      toast.success(`"${form.title}" ডিলিট হয়েছে!`)
    } catch (error) {
      toast.error('ডিলিট করতে সমস্যা হয়েছে: ' + error.message)
    }
  }

  const handleAddCustomLink = async () => {
    if (!customLink.label) { toast.error('Label is required!'); return }
    let path = '#'
    if (customLink.link_type === 'form' && customLink.form_id) {
      path = `/forms/submit/${customLink.form_id}`
    } else if (customLink.link_type === 'report' && customLink.report_id) {
      path = `/reports?report_id=${customLink.report_id}`
    } else if (customLink.link_type === 'path') {
      if (!customLink.path) { toast.error('Path is required!'); return }
      path = customLink.path
    }
    try {
      const data = await createMenuItem({
        label: customLink.label, path,
        icon: customLink.icon, menu_order: 99,
        is_active: true, roles: ['admin'],
        link_type: customLink.link_type,
        report_id: customLink.report_id || null,
      })
      setMenuStructure([...menuStructure, { ...data, _type: 'custom', children: [] }])
      setCustomLink({ label: '', path: '', icon: '📌', link_type: 'path' })
      toast.success('Added to menu!')
      loadAll()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (let i = 0; i < menuStructure.length; i++) {
        const item = menuStructure[i]
        if (item._type === 'form') {
          await updateForm(item.id, {
            menu_order: i + 1, show_in_menu: true,
            menu_icon: item.icon || item.menu_icon,
          })
        } else {
          const menuUpdate = {
            menu_order: i + 1, icon: item.icon,
            label: item.label, roles: item.roles,
            is_active: item.is_active !== false,
            path: item.path, parent_id: null,
            link_type: item.link_type || 'path',
          }
          if (item.report_id) menuUpdate.report_id = item.report_id
          await updateMenuItem(item.id, menuUpdate)

          const children = item.children || []
          for (let j = 0; j < children.length; j++) {
            const child = children[j]
            const childData = {
              label: child.label, path: child.path || '#', icon: child.icon,
              menu_order: j + 1, is_active: true,
              roles: child.roles || item.roles, parent_id: item.id,
              link_type: child.link_type || 'path',
            }
            if (child.report_id) childData.report_id = child.report_id
            if (child.form_id) childData.form_id = child.form_id
            if (String(child.id).startsWith('new_')) {
              await createMenuItem(childData)
            } else {
              await updateMenuItem(child.id, childData)
              // form-type child হলে forms table-এও menu_icon আপডেট করো
              if (child.link_type === 'form' && child.form_id && child.icon) {
                await updateForm(child.form_id, { menu_icon: child.icon })
              }
            }
          }

          const existingChildren = allMenuItems.filter(m => m.parent_id === item.id)
          const currentChildIds = children.filter(c => !String(c.id).startsWith('new_')).map(c => c.id)
          for (const ec of existingChildren) {
            if (!currentChildIds.includes(ec.id)) await deleteMenuItem(ec.id)
          }
        }
      }

      const menuFormIds = menuStructure.filter(m => m._type === 'form').map(m => m.id)
      for (const form of allForms) {
        if (form.show_in_menu && !menuFormIds.includes(form.id)) {
          await updateForm(form.id, { show_in_menu: false })
        }
      }

      const menuItemIds = menuStructure.filter(m => m._type !== 'form').map(m => m.id)
      for (const item of allMenuItems.filter(i => !i.parent_id)) {
        if (!menuItemIds.includes(item.id)) {
          await updateMenuItem(item.id, { is_active: false })
        }
      }

      await fetchAllMenuData()
      toast.success('Menu saved!')
      loadAll()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const inMenuIds = menuStructure.map(m => m.id)

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 pt-6">
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        </div>
        <div className="flex border-b border-gray-200 mt-4 px-6">
          <button
            onClick={() => setActiveTab('menu_manager')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${activeTab === 'menu_manager' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            📋 Menu Manager
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${activeTab === 'features' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ⚙️ Feature Toggles
          </button>
        </div>
      </div>

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Feature Toggles</h2>
          <p className="text-sm text-gray-500 mb-6">প্রতিটি feature on/off করুন — সাথে সাথে সব user এর জন্য apply হবে।</p>
          {/* Favicon Upload */}
          <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-medium text-gray-800 text-sm">🖼️ App Icon (Favicon)</p>
                <p className="text-xs text-gray-500 mt-0.5">Address bar, PWA ও bookmark-এ দেখাবে। PNG/JPG/SVG/ICO — সর্বোচ্চ ৫০০KB।</p>
              </div>
              <div className="flex items-center gap-3">
                {faviconUrl && (
                  <img src={faviconUrl} alt="favicon" className="w-8 h-8 rounded object-contain border border-gray-200 bg-white p-0.5" />
                )}
                <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition ${faviconUploading ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {faviconUploading ? '⏳ Uploading...' : '📤 Icon Upload'}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/webp"
                    className="hidden" onChange={handleFaviconUpload} disabled={faviconUploading} />
                </label>
              </div>
            </div>
          </div>

          {featuresLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {features.filter(f => f.key !== 'favicon_url').map(feature => (
                <div key={feature.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition">
                  <div className="flex-1 mr-4">
                    <p className="font-medium text-gray-800 text-sm">{feature.label || feature.key}</p>
                    {feature.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleFeature(feature.key, feature.value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${feature.value === 'true' ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${feature.value === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu Manager Tab */}
      {activeTab === 'menu_manager' && (
      <>
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="flex border-b">
              {['menu', 'forms', 'custom'].map(tab => (
                <button key={tab} onClick={() => setLeftTab(tab)}
                  className={`flex-1 px-2 py-3 text-xs font-medium transition capitalize ${leftTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  {tab === 'menu' ? 'Menu Items' : tab === 'forms' ? 'Forms' : 'Custom Link'}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-2">
              {leftTab === 'menu' && allMenuItems.filter(i => !i.parent_id).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span>{item.icon || '📋'}</span>
                    <span className="text-sm text-gray-800">{item.label}</span>
                  </div>
                  <button onClick={() => handleAddMenuItem(item)} disabled={inMenuIds.includes(item.id)}
                    className={`text-xs px-3 py-1 rounded-lg transition ${inMenuIds.includes(item.id) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {inMenuIds.includes(item.id) ? 'Added' : 'Add'}
                  </button>
                </div>
              ))}

              {leftTab === 'forms' && allForms.map(form => (
                <div key={form.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span>{form.menu_icon || '📋'}</span>
                    <span className="text-sm text-gray-800 truncate">{form.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditForm(form)}
                      title="Edit Form"
                      className="text-xs px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteForm(form)}
                      title="Delete Form"
                      className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                    >
                      🗑️
                    </button>
                    <button onClick={() => handleAddForm(form)} disabled={inMenuIds.includes(form.id)}
                      className={`text-xs px-3 py-1 rounded-lg transition ${inMenuIds.includes(form.id) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                      {inMenuIds.includes(form.id) ? 'Added' : 'Add'}
                    </button>
                  </div>
                </div>
              ))}

              {leftTab === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                    <input type="text" value={customLink.label}
                      onChange={e => setCustomLink({ ...customLink, label: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Menu label" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Link To</label>
                    <select value={customLink.link_type}
                      onChange={e => setCustomLink({ ...customLink, link_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2">
                      <option value="path">Custom Path</option>
                      <option value="form">Form (Submit Page)</option>
                      <option value="blank">Blank (No Link)</option>
                      <option value="report">Report Summary</option>
                    </select>
                    {customLink.link_type === 'form' ? (
                      <select value={customLink.form_id || ''}
                        onChange={e => setCustomLink({ ...customLink, form_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Form</option>
                        {allForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                      </select>
                    ) : customLink.link_type === 'blank' ? (
                      <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-500 border border-gray-200">
                        No link — parent menu only
                      </div>
                    ) : customLink.link_type === 'report' ? (
                      <select value={customLink.report_id || ''}
                        onChange={e => setCustomLink({ ...customLink, report_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Report</option>
                        {allReports.map(r => <option key={r.id} value={r.id}>{r.title || r.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={customLink.path}
                        onChange={e => setCustomLink({ ...customLink, path: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="/custom-page" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
                    <div className="relative">
                      <button onClick={() => setShowIconPicker(!showIconPicker)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50">
                        <span className="text-xl">{customLink.icon}</span>
                        <span className="text-gray-600">Click to change</span>
                      </button>
                      {showIconPicker && (
                        <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3">
                          <div className="grid grid-cols-8 gap-1">
                            {AVAILABLE_ICONS.map(icon => (
                              <button key={icon} onClick={() => { setCustomLink({ ...customLink, icon }); setShowIconPicker(false) }}
                                className={`w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-blue-50 transition ${customLink.icon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''}`}>
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={handleAddCustomLink}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                    + Add to Menu
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right — Menu Structure */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-800">Menu Structure</h2>
                <p className="text-xs text-gray-500 mt-0.5">🔃 Drag to reorder • ▼ Click to edit & set parent</p>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium">
                {saving ? 'Saving...' : 'Save Menu'}
              </button>
            </div>

            <div className="p-4">
              {menuStructure.length === 0 ? (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  Add items from the left panel
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={menuStructure.map(m => m.id)} strategy={verticalListSortingStrategy}>
                    {menuStructure.map(item => (
                      <SortableItem
                        key={item.id} item={item}
                        onToggleExpand={handleToggleExpand}
                        expandedId={expandedId}
                        onUpdate={handleUpdate}
                        onRemove={handleRemove}
                        onAddSubMenu={handleAddSubMenu}
                        onChangeParent={handleChangeParent}
                        allForms={allForms}
                        allReports={allReports}
                        menuStructure={menuStructure}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}