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
import toast from 'react-hot-toast'

const AVAILABLE_ICONS = [
  '🏠','📊','📋','🔨','📈','👥','🏢','🔒','⚙️','📝',
  '💰','📦','🎯','📅','🔔','💼','🌐','📱','🔍','✅',
  '📌','🗂️','📁','🏦','💳','🤝','📣','🧾','🔑','🏷️',
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

          <span className="flex-1 font-medium text-gray-800 text-sm">
            {item.label || item.title}
          </span>

          <button
            onClick={() => onToggleExpand(item.id)}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded */}
        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                type="text"
                value={item.label || item.title || ''}
                onChange={e => onUpdate(item, 'label', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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

      // Build current menu structure
      const activeMenuItems = items.map(i => ({ ...i, _type: 'menu' }))
      const activeFormItems = forms
        .filter(f => f.show_in_menu)
        .map(f => ({ ...f, _type: 'form', label: f.title }))

      setMenuStructure([...activeMenuItems, ...activeFormItems]
        .sort((a, b) => (a.menu_order || 0) - (b.menu_order || 0)))
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
      m.id === item.id ? { ...m, [key]: value, menu_icon: key === 'icon' ? value : m.menu_icon } : m
    ))
  }

  const handleRemove = (item) => {
    setMenuStructure(menuStructure.filter(m => m.id !== item.id))
  }

  const handleAddMenuItem = (item) => {
    if (menuStructure.find(m => m.id === item.id)) {
      toast.error('Already in menu!')
      return
    }
    setMenuStructure([...menuStructure, { ...item, _type: 'menu', label: item.label }])
    toast.success(`${item.label} added to menu!`)
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
    toast.success(`${form.title} added to menu!`)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save menu items order and icons
      for (let i = 0; i < menuStructure.length; i++) {
        const item = menuStructure[i]
        if (item._type === 'menu') {
          await updateMenuItem(item.id, {
            menu_order: i + 1,
            icon: item.icon,
            label: item.label,
          })
        } else if (item._type === 'form') {
          await updateForm(item.id, {
            menu_order: i + 1,
            show_in_menu: true,
            menu_icon: item.icon || item.menu_icon,
          })
        }
      }

      // Remove forms that are no longer in menu
      const menuFormIds = menuStructure
        .filter(m => m._type === 'form')
        .map(m => m.id)

      for (const form of allForms) {
        if (form.show_in_menu && !menuFormIds.includes(form.id)) {
          await updateForm(form.id, { show_in_menu: false })
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
          {/* Left — Add Menu Items */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="flex border-b">
              <button
                onClick={() => setLeftTab('menu')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                  leftTab === 'menu'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Menu Items
              </button>
              <button
                onClick={() => setLeftTab('forms')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                  leftTab === 'forms'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Forms
              </button>
            </div>

            <div className="p-4 space-y-2">
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
                    {inMenuIds.includes(item.id) ? 'Added' : 'Add to Menu'}
                  </button>
                </div>
              ))}

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
                    {inMenuIds.includes(form.id) ? 'Added' : 'Add to Menu'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Menu Structure */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-800">Menu Structure</h2>
                <p className="text-xs text-gray-500 mt-0.5">Drag to reorder • Click ▼ to edit</p>
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