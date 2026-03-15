import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { applyFavicon } from '../services/appSettingsService'

const ThemeContext = createContext({})

export const useTheme = () => useContext(ThemeContext)

// Hex color থেকে luminance বের করো (0=dark, 1=light)
const getLuminance = (hex) => {
  const c = hex.replace('#','')
  const r = parseInt(c.substr(0,2),16)/255
  const g = parseInt(c.substr(2,2),16)/255
  const b = parseInt(c.substr(4,2),16)/255
  const toLinear = x => x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4)
  return 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b)
}

// Background dark হলে white text, light হলে dark text
const getAutoTextColor = (bgHex) => {
  try {
    const lum = getLuminance(bgHex)
    return lum > 0.35 ? '#1e293b' : '#ffffff'
  } catch { return '#ffffff' }
}

// CSS variable apply করো
const applyGlobalTheme = (settings) => {
  const root = document.documentElement
  if (settings.primary_color) {
    root.style.setProperty('--primary', settings.primary_color)
    root.style.setProperty('--primary-dark', settings.primary_color)
  }
  if (settings.sidebar_color) {
    root.style.setProperty('--sidebar-bg', settings.sidebar_color)
    // Auto contrast text — manual override না থাকলে
    const textColor = settings.sidebar_text_color || getAutoTextColor(settings.sidebar_color)
    const isLight = getLuminance(settings.sidebar_color) > 0.35
    root.style.setProperty('--sidebar-text', textColor === '#ffffff' ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)')
    root.style.setProperty('--sidebar-text-solid', textColor)
    root.style.setProperty('--sidebar-active-bg', isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)')
    root.style.setProperty('--sidebar-hover-bg', isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)')
    root.style.setProperty('--sidebar-border-color', isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)')
  }
  if (settings.favicon_url) {
    applyFavicon(settings.favicon_url)
  }
}

export { getAutoTextColor, getLuminance }

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
    sidebar_text_color: '',
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
          .in('key', ['app_name', 'app_logo_url', 'primary_color', 'sidebar_color', 'sidebar_text_color', 'favicon_url'])

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