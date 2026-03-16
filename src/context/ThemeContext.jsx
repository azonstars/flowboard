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
    const hex = settings.primary_color
    root.style.setProperty('--primary', hex)
    root.style.setProperty('--primary-600', hex)
    // Hex থেকে lighter/darker shades বের করো
    const r = parseInt(hex.slice(1,3),16)
    const g = parseInt(hex.slice(3,5),16)
    const b = parseInt(hex.slice(5,7),16)
    const toHex = (v) => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')
    const mix = (ratio) => `#${toHex(r+(255-r)*ratio)}${toHex(g+(255-g)*ratio)}${toHex(b+(255-b)*ratio)}`
    const darken = (ratio) => `#${toHex(r*(1-ratio))}${toHex(g*(1-ratio))}${toHex(b*(1-ratio))}`
    root.style.setProperty('--primary-50',  mix(0.92))
    root.style.setProperty('--primary-100', mix(0.80))
    root.style.setProperty('--primary-200', mix(0.65))
    root.style.setProperty('--primary-300', mix(0.45))
    root.style.setProperty('--primary-400', mix(0.22))
    root.style.setProperty('--primary-500', mix(0.08))
    root.style.setProperty('--primary-700', darken(0.12))
    root.style.setProperty('--primary-800', darken(0.22))
    root.style.setProperty('--primary-900', darken(0.30))
    root.style.setProperty('--primary-dark', darken(0.12))
    root.style.setProperty('--primary-light', mix(0.80))
  }
  if (settings.sidebar_color) {
    const textColor = settings.sidebar_text_color || getAutoTextColor(settings.sidebar_color)
    localStorage.setItem('flowboard_sidebar_color', settings.sidebar_color)
    localStorage.setItem('flowboard_sidebar_text', textColor)
    const isDarkNow = document.documentElement.classList.contains('dark')
    if (!isDarkNow) {
      root.style.setProperty('--sidebar-bg', settings.sidebar_color)
      const isLight = getLuminance(settings.sidebar_color) > 0.35
      root.style.setProperty('--sidebar-text-solid', textColor)
      root.style.setProperty('--sidebar-text', isLight ? 'rgba(26,26,26,0.75)' : 'rgba(236,236,236,0.75)')
      root.style.setProperty('--sidebar-active-bg', isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)')
      root.style.setProperty('--sidebar-hover-bg', isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)')
      root.style.setProperty('--sidebar-border-color', isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')
    }
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
    primary_color: '#cc785c',
    sidebar_color: '#f9f9f7',
    sidebar_text_color: '#1a1a1a',
    favicon_url: '',
  })

  // Dark mode apply করো
  useEffect(() => {
    const applyDark = (dark) => {
      const root = document.documentElement
      if (dark) {
        root.classList.add('dark')
        root.style.setProperty('--sidebar-bg',           '#1f1f1e')
        root.style.setProperty('--sidebar-text-solid',   '#ececec')
        root.style.setProperty('--sidebar-text',         'rgba(236,236,236,0.75)')
        root.style.setProperty('--sidebar-hover-bg',     'rgba(255,255,255,0.06)')
        root.style.setProperty('--sidebar-active-bg',    'rgba(255,255,255,0.1)')
        root.style.setProperty('--sidebar-border-color', 'rgba(255,255,255,0.08)')
        root.style.setProperty('--bg-primary',   '#1f1f1e')
        root.style.setProperty('--bg-secondary', '#2a2a28')
        root.style.setProperty('--bg-card',      '#2a2a28')
        root.style.setProperty('--text-primary', '#ececec')
        root.style.setProperty('--text-secondary','#a0a0a0')
        root.style.setProperty('--border',       'rgba(255,255,255,0.1)')
      } else {
        root.classList.remove('dark')
        const sidebarColor = localStorage.getItem('flowboard_sidebar_color') || '#f9f9f7'
        const sidebarText  = localStorage.getItem('flowboard_sidebar_text')  || '#1a1a1a'
        root.style.setProperty('--sidebar-bg',           sidebarColor)
        root.style.setProperty('--sidebar-text-solid',   sidebarText)
        root.style.setProperty('--sidebar-text',         'rgba(26,26,26,0.75)')
        root.style.setProperty('--sidebar-hover-bg',     'rgba(0,0,0,0.05)')
        root.style.setProperty('--sidebar-active-bg',    'rgba(0,0,0,0.08)')
        root.style.setProperty('--sidebar-border-color', 'rgba(0,0,0,0.08)')
        root.style.setProperty('--bg-primary',   '#ffffff')
        root.style.setProperty('--bg-secondary', '#f9f9f7')
        root.style.setProperty('--bg-card',      '#ffffff')
        root.style.setProperty('--text-primary', '#1a1a1a')
        root.style.setProperty('--text-secondary','#6b6b6b')
        root.style.setProperty('--border',       'rgba(0,0,0,0.1)')
      }
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