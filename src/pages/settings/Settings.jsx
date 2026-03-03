import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getForms, updateForm } from '../../services/formService'
import { getMenuItems, updateMenuOrder, updateMenuItem } from '../../services/menuService'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
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

const SortableItem = ({ item, onToggleExpand, expandedId, onUpdate, onRemove }) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isExpanded = expandedId === item.id
  const itemRoles = item.roles || []

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <div className={`border rounded-lg bg-white ${isDragging ? 'shadow-xl' : 'shadow-sm'}`}>
        {/* Header */}
        <div className="flex items-center gap-2 p-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <span className="text-xl">{item.icon || item.menu_icon || '📋'}</span>
          <span className="flex-1 font-medium text-gray-800 text-sm">{item.label || item.title}</span>
          <span className="text-xs text-gray-400 hidden sm:block">{item.path || `/forms/submit/${item.id}`}</span>
          <button
            onClick={() => onToggleExpand(item.id)}
            className="text-gray-400 hover:text-gray-600 transition ml-2"
          >
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded */}
        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                type="text"
                value={item.label || item.title || ''}
                onChange={e => onUpdate(item, 'label', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {item._type === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL / Path</label>
                <input
                  type="text"
                  value={item.path || ''}
                  onChange={e => onUpdate(item, 'path', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/custom-path"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Icon</label>
              <div className="grid grid-cols-10 gap-1">
                {AVAILABLE_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => onUpdate(item, 'icon', icon)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-blue-50 transition ${
                      (item.icon || item.menu_icon) === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {(item._type === 'menu' || item._type === 'custom') && (
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

            <div className="flex justify-end">
              <button
                onClick={() => onRemove(item)}
                className="text-sm text-red-500 hover:text-red-700 hover:underline"
              >
                Remove from Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const { fetchMenuForms, fetchMenuItems } = useAuth()
  const [allMenuItems, setAllMenuItems] = useState([])
  const [allForms, setAllForms] = useState([])
  const [menuStructure, setMenuStructure] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leftTab, setLeftTab] = useState('menu')
  const [customLink, setCustomLink] = useState({ label: '', path: '', icon: '📌' })
  const [showIconPicker, setShowIconPicker] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [items, forms] = await Promise.all([getMenuItems(), getForms()])
      setAllMenuItems(items)
      setAllForms(forms)

      const activeMenuItems = items.map(i => ({ ...i, _type: 'menu' }))
      const activeFormItems = forms
        .filter(f => f.show_in_menu)
        .map(f => ({ ...f, _type: 'form', label: f.title, icon: f.menu_icon || '📋' }))

      const combined = [...activeMenuItems, ...activeFormItems]
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

  const handleToggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleUpdate = (item, key, value) => {
    setMenuStructure(menuStructure.map(m =>
      m.id === item.id
        ? { ...m, [key]: value, ...(key === 'icon' ? { menu_icon: value } : {}) }
        : m
    ))
  }

  const handleRemove = (item) => {
    setMenuStructure(menuStructure.filter(m => m.id !== item.id))
    toast.success('Removed from menu!')
  }

  const handleAddMenuItem = (item) => {
    if (menuStructure.find(m => m.id === item.id)) {
      toast.error('Already in menu!')
      return
    }
    setMenuStructure([...menuStructure, { ...item, _type: 'menu' }])
    toast.success(`${item.label} added!`)
  }

  const handleAddForm = (form) => {
    if (menuStructure.find(m => m.id === form.id)) {
      toast.error('Already in menu!')
      return
    }
    setMenuStructure([...menuStructure, {
      ...form,
      _type: 'form',
      label: form.title,
      icon: form.menu_icon || '📋',
    }])
    toast.success(`${form.title} added!`)
  }

  const handleAddCustomLink = async () => {
    if (!customLink.label) { toast.error('Label is required!'); return }
    if (!customLink.path) { toast.error('Path/URL is required!'); return }

    try {
      const { data, error } = await supabase
        .from('menu_items')
        .insert({
          label: customLink.label,
          path: customLink.path,
          icon: customLink.icon,
          menu_order: 99,
          is_active: true,
          roles: ['admin'],
        })
        .select()
        .single()
      if (error) throw error

      setMenuStructure([...menuStructure, { ...data, _type: 'custom' }])
      setCustomLink({ label: '', path: '', icon: '📌' })
      toast.success('Custom link added!')
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
        if (item._type === 'menu' || item._type === 'custom') {
          await updateMenuItem(item.id, {
            menu_order: i + 1,
            icon: item.icon,
            label: item.label,
            roles: item.roles,
          })
        } else if (item._type === 'form') {
          await updateForm(item.id, {
            menu_order: i + 1,
            show_in_menu: true,
            menu_icon: item.icon || item.menu_icon,
          })
        }
      }

      // Remove forms no longer in menu
      const menuFormIds = menuStructure.filter(m => m._type === 'form').map(m => m.id)
      for (const form of allForms) {
        if (form.show_in_menu && !menuFormIds.includes(form.id)) {
          await updateForm(form.id, { show_in_menu: false })
        }
      }

      // Remove menu items no longer in menu (mark inactive)
      const menuItemIds = menuStructure
        .filter(m => m._type === 'menu' || m._type === 'custom')
        .map(m => m.id)
      for (const item of allMenuItems) {
        if (!menuItemIds.includes(item.id)) {
          await updateMenuItem(item.id, { is_active: false })
        } else {
          await updateMenuItem(item.id, { is_active: true })
        }
      }

      await Promise.all([fetchMenuItems(), fetchMenuForms()])
      toast.success('Menu saved successfully!')
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
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Settings — Menu Manager</h1>
        <p className="text-gray-500 mt-1">WordPress style menu management.</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="flex border-b">
              {['menu', 'forms', 'custom'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`flex-1 px-2 py-3 text-xs font-medium transition capitalize ${
                    leftTab === tab
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'menu' ? 'Menu Items' : tab === 'forms' ? 'Forms' : 'Custom Link'}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-2">
              {/* Menu Items Tab */}
              {leftTab === 'menu' && allMenuItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span>{item.icon || '📋'}</span>
                    <span className="text-sm text-gray-800">{item.label}</span>
                  </div>
                  <button
                    onClick={() => handleAddMenuItem(item)}
                    disabled={inMenuIds.includes(item.id)}
                    className={`text-xs px-3 py-1 rounded-lg transition ${
                      inMenuIds.includes(item.id)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {inMenuIds.includes(item.id) ? 'Added' : 'Add'}
                  </button>
                </div>
              ))}

              {/* Forms Tab */}
              {leftTab === 'forms' && allForms.map(form => (
                <div key={form.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span>{form.menu_icon || '📋'}</span>
                    <span className="text-sm text-gray-800">{form.title}</span>
                  </div>
                  <button
                    onClick={() => handleAddForm(form)}
                    disabled={inMenuIds.includes(form.id)}
                    className={`text-xs px-3 py-1 rounded-lg transition ${
                      inMenuIds.includes(form.id)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {inMenuIds.includes(form.id) ? 'Added' : 'Add'}
                  </button>
                </div>
              ))}

              {/* Custom Link Tab */}
              {leftTab === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                    <input
                      type="text"
                      value={customLink.label}
                      onChange={e => setCustomLink({ ...customLink, label: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Menu label"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Path / URL</label>
                    <input
                      type="text"
                      value={customLink.path}
                      onChange={e => setCustomLink({ ...customLink, path: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="/custom-page"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
                    <div className="relative">
                      <button
                        onClick={() => setShowIconPicker(!showIconPicker)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50"
                      >
                        <span className="text-xl">{customLink.icon}</span>
                        <span className="text-gray-600">Click to change icon</span>
                      </button>
                      {showIconPicker && (
                        <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3">
                          <div className="grid grid-cols-8 gap-1">
                            {AVAILABLE_ICONS.map(icon => (
                              <button
                                key={icon}
                                onClick={() => {
                                  setCustomLink({ ...customLink, icon })
                                  setShowIconPicker(false)
                                }}
                                className={`w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-blue-50 transition ${
                                  customLink.icon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                                }`}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleAddCustomLink}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
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
                <p className="text-xs text-gray-500 mt-0.5">Drag to reorder • Click ▼ to edit label, icon & roles</p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
              >
                {saving ? 'Saving...' : 'Save Menu'}
              </button>
            </div>

            <div className="p-4">
              {menuStructure.length === 0 ? (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  Add items from the left panel
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={menuStructure.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {menuStructure.map(item => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        onToggleExpand={handleToggleExpand}
                        expandedId={expandedId}
                        onUpdate={handleUpdate}
                        onRemove={handleRemove}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}