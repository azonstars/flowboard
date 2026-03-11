// ── Skeleton UI Components ──────────────────────────────────

// Base pulse block
export const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
)

// Stat card skeleton (dashboard numbers)
export const SkeletonStatCard = () => (
  <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-gray-200">
    <SkeletonBlock className="h-3 w-20 mb-3" />
    <SkeletonBlock className="h-7 w-14" />
  </div>
)

// Table row skeleton
export const SkeletonTableRow = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <SkeletonBlock className={`h-4 ${i === 0 ? 'w-32' : i === cols - 1 ? 'w-16' : 'w-24'}`} />
      </td>
    ))}
  </tr>
)

// Card skeleton (list items)
export const SkeletonCard = () => (
  <div className="bg-white rounded-xl p-4 shadow-sm space-y-3 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-3 w-24" />
      </div>
    </div>
    <SkeletonBlock className="h-3 w-full" />
    <SkeletonBlock className="h-3 w-3/4" />
  </div>
)

// Chart area skeleton
export const SkeletonChart = ({ height = 'h-48' }) => (
  <div className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
    <SkeletonBlock className="h-4 w-32 mb-4" />
    <div className={`${height} bg-gray-100 rounded-lg flex items-end gap-2 px-4 pb-4`}>
      {[60, 80, 45, 90, 55, 70, 40, 85, 65, 75].map((h, i) => (
        <div key={i} className="flex-1 bg-gray-200 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
)

// Form field skeleton
export const SkeletonFormField = () => (
  <div className="space-y-2 animate-pulse">
    <SkeletonBlock className="h-3 w-28" />
    <SkeletonBlock className="h-10 w-full rounded-lg" />
  </div>
)

// Dashboard full skeleton (6 stat cards + 2 charts)
export const SkeletonDashboard = () => (
  <div className="space-y-5">
    <div className="bg-white rounded-xl p-5 shadow-sm animate-pulse">
      <SkeletonBlock className="h-6 w-56 mb-2" />
      <SkeletonBlock className="h-4 w-40" />
    </div>
    <div className="flex gap-2">
      {[1,2,3,4].map((i) => (
        <SkeletonBlock key={i} className="h-9 w-24 rounded-lg" />
      ))}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SkeletonChart height="h-48" />
      <SkeletonChart height="h-48" />
    </div>
  </div>
)

// Branch dashboard skeleton
export const SkeletonBranchDashboard = () => (
  <div className="space-y-5">
    <div className="bg-white rounded-xl p-5 shadow-sm animate-pulse">
      <SkeletonBlock className="h-6 w-48 mb-2" />
      <SkeletonBlock className="h-4 w-32" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  </div>
)

// Table skeleton wrapper
export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
    <div className="p-4 border-b border-gray-100">
      <SkeletonBlock className="h-5 w-40" />
    </div>
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="px-4 py-3">
              <SkeletonBlock className="h-3 w-16" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
)
