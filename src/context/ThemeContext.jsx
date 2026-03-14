import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { applyFavicon } from '../services/appSettingsService'

const ThemeContext = createContext({})

export const useTheme = () => useContext(ThemeContext)

// CSS variable apply করো
const applyGlobalTheme = (settings) => {
  const root = document.documentElement
  if (settings.primary_color) {
    root.style.setProperty('--primary', settings.primary_color)
    // darker variant
    root.style.setProperty('--primary-dark', settings.primary_color)
  }
  if (settings.sidebar_color) {
    root.style.setProperty('--sidebar-bg', settings.sidebar_color)
  }
  if (settings.favicon_url) {
    applyFavicon(settings.favicon_url)
  }
}

export const ThemeProvider = ({ children }) => {
  // User-level: light | dark | system
  const [colorMode, setColorMode] = useState(
    () => localStorage.getItem('flowboard_theme') || 'system'
  )

  // Global admin settings
  const [globalTheme, setGlobalTheme] = useState({
    app_name: 'FlowBoard',
    app_logo_url: '',
    primary_color: '#2563eb',
    sidebar_color: '#1e3a5f',
    favicon_url: '',
  })

  // Dark mode apply করো
  useEffect(() => {
    const applyDark = (dark) => {
      if (dark) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    }

    if (colorMode === 'dark') {
      applyDark(true)
    } else if (colorMode === 'light') {
      applyDark(false)
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyDark(mq.matches)
      const handler = (e) => applyDark(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [colorMode])

  // Global theme — একবারই load করো (mount-এ)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['app_name', 'app_logo_url', 'primary_color', 'sidebar_color', 'favicon_url'])

        if (!cancelled && data?.length) {
          const settings = {}
          data.forEach(s => { settings[s.key] = s.value })
          setGlobalTheme(prev => ({ ...prev, ...settings }))
          applyGlobalTheme(settings)
        }
      } catch (e) {
        console.error('Theme load error:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, []) // [] — শুধু একবার

  const setMode = (mode) => {
    setColorMode(mode)
    localStorage.setItem('flowboard_theme', mode)
  }

  const updateGlobalTheme = (newSettings) => {
    setGlobalTheme(prev => ({ ...prev, ...newSettings }))
    applyGlobalTheme(newSettings)
  }

  return (
    <ThemeContext.Provider value={{
      colorMode,
      setMode,
      globalTheme,
      updateGlobalTheme,
      isDark: document.documentElement.classList.contains('dark'),
    }}>
      {children}
    </ThemeContext.Provider>
  )
}