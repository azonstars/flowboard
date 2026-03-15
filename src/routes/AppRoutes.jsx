import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'

// Lazy imports — প্রতিটি page আলাদা chunk হবে
const Login                      = lazy(() => import('../pages/auth/Login'))
const Register                   = lazy(() => import('../pages/auth/Register'))
const ResetPassword              = lazy(() => import('../pages/auth/ResetPassword'))
const DashboardLayout            = lazy(() => import('../components/layout/DashboardLayout'))
const AdminDashboard             = lazy(() => import('../pages/dashboard/AdminDashboard'))
const BranchDashboard            = lazy(() => import('../pages/dashboard/BranchDashboard'))
const CentralCheckerDashboard    = lazy(() => import('../pages/dashboard/CentralCheckerDashboard'))
const DivisionalCheckerDashboard = lazy(() => import('../pages/dashboard/DivisionalCheckerDashboard'))
const RegionalCheckerDashboard   = lazy(() => import('../pages/dashboard/RegionalCheckerDashboard'))
const BranchManagement           = lazy(() => import('../pages/branches/BranchManagement'))
const UserManagement             = lazy(() => import('../pages/users/UserManagement'))
const FormListPage               = lazy(() => import('../pages/forms/FormListPage'))
const FormBuilderPage            = lazy(() => import('../pages/forms/FormBuilderPage'))
const FormSubmitPage             = lazy(() => import('../pages/forms/FormSubmitPage'))
const AdvancedReportViewer       = lazy(() => import('../pages/reports/AdvancedReportViewer'))
const AdvancedReportBuilder      = lazy(() => import('../pages/reports/AdvancedReportBuilder'))
const PermissionManagement       = lazy(() => import('../pages/permissions/PermissionManagement'))
const Settings                   = lazy(() => import('../pages/settings/Settings'))
const SubmissionsPage            = lazy(() => import('../pages/submissions/SubmissionsPage'))
const SubmissionHistoryPage      = lazy(() => import('../pages/submissions/SubmissionHistoryPage'))
const BranchSubmissionsPage      = lazy(() => import('../pages/submissions/BranchSubmissionsPage'))
const ProfilePage                = lazy(() => import('../pages/profile/ProfilePage'))
const ChatPage                   = lazy(() => import('../pages/chat/ChatPage'))
const AuditLogPage               = lazy(() => import('../pages/audit/AuditLogPage'))
const ExcelImportPage            = lazy(() => import('../pages/submissions/ExcelImportPage'))

// Page loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">লোড হচ্ছে...</p>
    </div>
  </div>
)

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return user ? children : <Navigate to="/login" />
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return !user ? children : <Navigate to="/dashboard" />
}

const RoleRoute = ({ children, roles }) => {
  const { profile, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!roles.includes(profile?.role)) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500">403</h1>
        <p className="text-gray-600 mt-2">Access Denied</p>
        <a href="/dashboard" className="text-primary-600 hover:underline mt-4 block">Go to Dashboard</a>
      </div>
    </div>
  )
  return children
}

const DashboardRouter = () => {
  const { profile } = useAuth()
  switch (profile?.role) {
    case ROLES.ADMIN: return <AdminDashboard />
    case ROLES.CENTRAL_CHECKER: return <CentralCheckerDashboard />
    case ROLES.DIVISIONAL_CHECKER: return <DivisionalCheckerDashboard />
    case ROLES.REGIONAL_CHECKER: return <RegionalCheckerDashboard />
    case ROLES.BRANCH_MANAGER:
    case ROLES.BRANCH_EMPLOYEE: return <BranchDashboard />
    default: return <PageLoader />
  }
}

const ADMIN_ONLY  = [ROLES.ADMIN]
const CHECKERS    = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER]
const BRANCH_USERS = [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE]
const ALL_ROLES   = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER, ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE]
const EXCEL_ROLES = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER]

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login"          element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register"       element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

          <Route path="/dashboard" element={
            <PrivateRoute>
              <DashboardLayout><DashboardRouter /></DashboardLayout>
            </PrivateRoute>
          } />

          <Route path="/branches" element={
            <PrivateRoute>
              <RoleRoute roles={ADMIN_ONLY}>
                <DashboardLayout><BranchManagement /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/users" element={
            <PrivateRoute>
              <RoleRoute roles={ADMIN_ONLY}>
                <DashboardLayout><UserManagement /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/forms" element={
            <PrivateRoute>
              <RoleRoute roles={ALL_ROLES}>
                <DashboardLayout><FormListPage /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/forms/builder" element={
            <PrivateRoute>
              <RoleRoute roles={ADMIN_ONLY}>
                <DashboardLayout><FormBuilderPage /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/forms/submit/:formId" element={
            <PrivateRoute>
              <RoleRoute roles={ALL_ROLES}>
                <DashboardLayout><FormSubmitPage /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/reports"         element={<Navigate to="/advanced-reports" replace />} />
          <Route path="/reports/builder" element={<Navigate to="/advanced-reports/builder" replace />} />

          <Route path="/permissions" element={
            <PrivateRoute>
              <RoleRoute roles={[ROLES.ADMIN, ROLES.REGIONAL_CHECKER]}>
                <DashboardLayout><PermissionManagement /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/profile" element={
            <PrivateRoute>
              <DashboardLayout><ProfilePage /></DashboardLayout>
            </PrivateRoute>
          } />

          <Route path="/chat" element={
            <PrivateRoute>
              <DashboardLayout><ChatPage /></DashboardLayout>
            </PrivateRoute>
          } />

          <Route path="/submissions/history" element={
            <PrivateRoute>
              <DashboardLayout><SubmissionHistoryPage /></DashboardLayout>
            </PrivateRoute>
          } />

          <Route path="/my-submissions" element={
            <PrivateRoute>
              <DashboardLayout><BranchSubmissionsPage /></DashboardLayout>
            </PrivateRoute>
          } />

          <Route path="/submissions" element={
            <PrivateRoute>
              <RoleRoute roles={CHECKERS}>
                <DashboardLayout><SubmissionsPage /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/settings" element={
            <PrivateRoute>
              <RoleRoute roles={ADMIN_ONLY}>
                <DashboardLayout><Settings /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/excel-import" element={
            <PrivateRoute>
              <RoleRoute roles={EXCEL_ROLES}>
                <DashboardLayout><ExcelImportPage /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/audit-log" element={
            <PrivateRoute>
              <DashboardLayout><AuditLogPage /></DashboardLayout>
            </PrivateRoute>
          } />

          <Route path="/advanced-reports" element={
            <PrivateRoute>
              <RoleRoute roles={ALL_ROLES}>
                <DashboardLayout><AdvancedReportViewer /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/advanced-reports/builder" element={
            <PrivateRoute>
              <RoleRoute roles={[ROLES.ADMIN, ROLES.CENTRAL_CHECKER]}>
                <DashboardLayout><AdvancedReportBuilder /></DashboardLayout>
              </RoleRoute>
            </PrivateRoute>
          } />

          <Route path="/"  element={<Navigate to="/login" />} />
          <Route path="*"  element={<Navigate to="/dashboard" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}