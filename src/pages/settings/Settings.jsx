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
  { value: '🏠', label: 'Home' },
  { value: '📊', label: 'Dashboard' },
  { value: '📋', label: 'Forms' },
  { value: '🔨', label: 'Builder' },
  { value: '📈', label: 'Reports' },
  { value: '👥', label: 'Users' },
  { value: '🏢', label: 'Branches' },
  { value: '🔒', label: 'Permissions' },
  { value: '⚙️', label: 'Settings' },
  { value: '📝', label: 'Notes' },
  { value: '💰', label: 'Finance' },
  { value: '📦', label: 'Inventory' },
  { value: '🎯', label: 'Target' },
  { value: '📅', label: 'Calendar' },
  { value: '🔔', label: 'Notifications' },
  { value: '💼', label: 'Business' },
  { value: '🌐', label: 'Network' },
  { value: '📱', label: 'Mobile' },
  { value: '🔍', label: 'Search' },
  { value: '✅', label: 'Done' },
]

const SortableMenuItem = ({ item, onUpdateIcon, saving }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const [showIconPicker, setShowIconPicker] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 flex items-center justify-between gap-4 bg-white ${
        isDragging ? 'shadow-xl rounded-lg' : 'border-b border-gray-200'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Icon */}
        <div className="relative">
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-lg text-xl hover:bg-blue-100 transition"
            title="Click to change icon"
          >
            {item.icon || '📋'}
          </button>

          {showIconPicker && (
            <div className="absolute left-0 top-12 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-64">
              <p className="text-xs text-gray-500 mb-2 font-medium">Select Icon</p>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_ICONS.map(icon => (
                  <button
                    key={icon.value}
                    onClick={() => {
                      onUpdateIcon(item, icon.value)
                      setShowIconPicker(false)
                    }}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl hover:bg-blue-50 transition ${
                      item.icon === icon.value ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                    }`}
                    title={icon.label}
                  >
                    {icon.value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="font-medium text-gray-800">{item.label}</p>
          <p className="text-xs text-gray-500">{item.path}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
          {item.roles?.length} roles
        </span>
      </div>
    </div>
  )
}

const SortableFormItem = ({ form, onToggleMenu, onToggleActive, onUpdateIcon, saving }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: form.id })

  const [showIconPicker, setShowIconPicker] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 flex items-center justify-between flex-wrap gap-4 bg-white ${
        isDragging ? 'shadow-xl rounded-lg' : 'border-b border-gray-200'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Icon */}
        <div className="relative">
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-lg text-xl hover:bg-blue-100 transition"
            title="Click to change icon"
          >
            {form.menu_icon || '📋'}
          </button>

          {showIconPicker && (
            <div className="absolute left-0 top-12 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-64">
              <p className="text-xs text-gray-500 mb-2 font-medium">Select Icon</p>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_ICONS.map(icon => (
                  <button
                    key={icon.value}
                    onClick={() => {
                      onUpdateIcon(form, icon.value)
                      setShowIconPicker(false)
                    }}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl hover:bg-blue-50 transition ${
                      form.menu_icon === icon.value ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                    }`}
                    title={icon.label}
                  >
                    {icon.value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="font-medium text-gray-800">{form.title}</p>
          {form.description && (
            <p className="text-sm text-gray-500 mt-0.5">{form.description}</p>
          )}
          <div className="flex gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              form.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              form.show_in_menu ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {form.show_in_menu ? '📋 In Menu' : 'Not in Menu'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => onToggleMenu(form)}
          disabled={saving === form.id}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
            form.show_in_menu
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {saving === form.id ? '...' : form.show_in_menu ? '✅ In Menu' : 'Add to Menu'}
        </button>

        <button
          onClick={() => onToggleActive(form)}
          disabled={saving === form.id}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
            form.is_active
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-green-100 text-green-600 hover:bg-green-200'
          }`}
        >
          {saving === form.id ? '...' : form.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const { fetchMenuForms, fetchMenuItems } = useAuth()
  const [forms, setForms] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [activeTab, setActiveTab] = useState('menu')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null)

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
      const [f, m] = await Promise.all([getForms(), getMenuItems()])
      setForms(f)
      setMenuItems(m)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMenuItemDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = menuItems.findIndex(f => f.id === active.id)
    const newIndex = menuItems.findIndex(f => f.id === over.id)
    const newItems = arrayMove(menuItems, oldIndex, newIndex)
    setMenuItems(newItems)
    try {
      await updateMenuOrder(newItems)
      await fetchMenuItems()
      toast.success('Menu order updated!')
    } catch (error) {
      toast.error(error.message)
      loadAll()
    }
  }

  const handleFormDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = forms.findIndex(f => f.id === active.id)
    const newIndex = forms.findIndex(f => f.id === over.id)
    const newForms = arrayMove(forms, oldIndex, newIndex)
    setForms(newForms)
    try {
      await Promise.all(
        newForms.map((form, index) =>
          updateForm(form.id, { menu_order: index + 1 })
        )
      )
      await fetchMenuForms()
      toast.success('Form order updated!')
    } catch (error) {
      toast.error(error.message)
      loadAll()
    }
  }

  const handleUpdateMenuIcon = async (item, icon) => {
    try {
      await updateMenuItem(item.id, { icon })
      await fetchMenuItems()
      toast.success('Icon updated!')
      loadAll()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleUpdateFormIcon = async (form, icon) => {
    try {
      await updateForm(form.id, { menu_icon: icon })
      await fetchMenuForms()
      toast.success('Icon updated!')
      loadAll()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleToggleMenu = async (form) => {
    setSaving(form.id)
    try {
      await updateForm(form.id, { show_in_menu: !form.show_in_menu })
      await fetchMenuForms()
      toast.success(`${form.title} ${!form.show_in_menu ? 'added to' : 'removed from'} menu!`)
      loadAll()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(null)
    }
  }

  const handleToggleActive = async (form) => {
    setSaving(form.id)
    try {
      await updateForm(form.id, { is_active: !form.is_active })
      toast.success(`${form.title} ${!form.is_active ? 'activated' : 'deactivated'}!`)
      loadAll()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500 mt-1">Manage menu order, icons and form visibility.</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'menu'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Menu Items
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'forms'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Form Menu
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Menu Items Tab */}
            {activeTab === 'menu' && (
              <div>
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                  <p className="text-sm text-blue-700">
                    🖱️ Drag to reorder • Click icon to change
                  </p>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleMenuItemDragEnd}
                >
                  <SortableContext
                    items={menuItems.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {menuItems.map(item => (
                      <SortableMenuItem
                        key={item.id}
                        item={item}
                        onUpdateIcon={handleUpdateMenuIcon}
                        saving={saving}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Forms Tab */}
            {activeTab === 'forms' && (
              <div>
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                  <p className="text-sm text-blue-700">
                    🖱️ Drag to reorder • Click icon to change • Toggle menu visibility
                  </p>
                </div>
                {forms.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No forms found.</div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleFormDragEnd}
                  >
                    <SortableContext
                      items={forms.map(f => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {forms.map(form => (
                        <SortableFormItem
                          key={form.id}
                          form={form}
                          onToggleMenu={handleToggleMenu}
                          onToggleActive={handleToggleActive}
                          onUpdateIcon={handleUpdateFormIcon}
                          saving={saving}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}