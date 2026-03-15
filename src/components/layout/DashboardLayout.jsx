import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen" style={{backgroundColor: 'var(--bg-secondary, #f9f9f7)'}}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 h-full [&:has(.chat-fullpage)]:p-0 [&:has(.chat-fullpage)]:overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
