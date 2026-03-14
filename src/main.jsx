import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppRoutes from './routes/AppRoutes'
import './index.css'
import { supabase } from './services/supabase'
import { applyFavicon } from './services/appSettingsService'

// App load হওয়ার সাথে সাথে saved favicon apply করো
supabase
  .from('app_settings')
  .select('value')
  .eq('key', 'favicon_url')
  .single()
  .then(({ data }) => {
    if (data?.value) applyFavicon(data.value)
  })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" />
    </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)