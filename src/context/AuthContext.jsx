import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { getMenuForms } from '../services/formService'
import { getMenuItems } from '../services/menuService'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [menuForms, setMenuForms] = useState([])
  const [menuItems, setMenuItems] = useState([])
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
      if (error) {
        console.error('Profile fetch error:', error)
        setLoading(false)
        return
      }
      setProfile(data)
      await Promise.all([fetchMenuForms(), fetchMenuItems()])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMenuForms = async () => {
    try {
      const forms = await getMenuForms()
      setMenuForms(forms)
    } catch (error) {
      console.error('Menu forms error:', error)
    }
  }

  const fetchMenuItems = async () => {
    try {
      const items = await getMenuItems()
      setMenuItems(items)
    } catch (error) {
      console.error('Menu items error:', error)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setMenuForms([])
    setMenuItems([])
  }

  return (
    <AuthContext.Provider value={{
      user, profile, menuForms, menuItems, loading,
      signOut, fetchProfile, fetchMenuForms, fetchMenuItems
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)