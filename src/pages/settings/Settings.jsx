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
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const SortableFormItem = ({ form, onToggleMenu, onToggleActive, saving }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: form.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-6 flex items-center justify-between flex-wrap gap-4 bg-white ${
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
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        <div>
          <p className="font-medium text-gray-800">{form.title}</p>
          {form.description && (
            <p className="text-sm text-gray-500 mt-1">{form.description}</p>
          )}
          <div className="flex gap-2 mt-2">
            <span className={`px-2 py-1 rounded-full text-xs ${
              form.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs ${
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
          className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
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
          className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
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
  const { fetchMenuForms } = useAuth()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => { loadForms() }, [])

  const loadForms = async () => {
    setLoading(true)
    try {
      const data = await getForms()
      setForms(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = forms.findIndex(f => f.id === active.id)
    const newIndex = forms.findIndex(f => f.id === over.id)
    const newForms = arrayMove(forms, oldIndex, newIndex)
    setForms(newForms)

    // Save new order to database
    try {
      await Promise.all(
        newForms.map((form, index) =>
          updateForm(form.id, { menu_order: index + 1 })
        )
      )
      await fetchMenuForms()
      toast.success('Menu order updated!')
    } catch (error) {
      toast.error(error.message)
      loadForms()
    }
  }

  const handleToggleMenu = async (form) => {
    setSaving(form.id)
    try {
      await updateForm(form.id, { show_in_menu: !form.show_in_menu })
      await fetchMenuForms()
      toast.success(`${form.title} ${!form.show_in_menu ? 'added to' : 'removed from'} menu!`)
      loadForms()
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
      loadForms()
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
        <p className="text-gray-500 mt-1">Manage form visibility and menu order.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-bold text-gray-800 text-lg">Form Menu Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Drag and drop to reorder. Control which forms appear in the sidebar menu.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : forms.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No forms found.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
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
                  saving={saving}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}