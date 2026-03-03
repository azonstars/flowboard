import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { getMenuItemsWithChildren } from '../services/menuService'
import { getMenuForms } from '../services/formService'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [menuForms, setMenuForms] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [allMenuItems, setAllMenuItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
        else {
          setProfile(null)
          setMenuForms([])
          setMenuItems([])
          setAllMenuItems([])
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) { setLoading(false); return }
      setProfile(data)
      await fetchAllMenuData()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllMenuData = async () => {
    try {
      const [itemsWithChildren, forms] = await Promise.all([
        getMenuItemsWithChildren(),
        getMenuForms()
      ])

      setMenuForms(forms)
      setMenuItems(itemsWithChildren)

      // Flat list for sidebar — parents only at top level
      // forms get inserted by menu_order
      const parentItems = itemsWithChildren
        .filter(i => !i.parent_id)
        .map(i => ({ ...i, _type: 'menu' }))

      const formsMapped = forms.map(f => ({
        ...f,
        _type: 'form',
        label: f.title,
        icon: f.menu_icon || '📋',
        path: `/forms/submit/${f.id}`,
        roles: ['admin', 'branch_manager', 'branch_employee'],
        children: [],
      }))

      const combined = [...parentItems, ...formsMapped]
        .sort((a, b) => (a.menu_order || 0) - (b.menu_order || 0))

      setAllMenuItems(combined)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchMenuForms = async () => { await fetchAllMenuData() }
  const fetchMenuItems = async () => { await fetchAllMenuData() }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setMenuForms([])
    setMenuItems([])
    setAllMenuItems([])
  }

  return (
    <AuthContext.Provider value={{
      user, profile, menuForms, menuItems, allMenuItems, loading,
      signOut, fetchProfile, fetchMenuForms, fetchMenuItems, fetchAllMenuData
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)