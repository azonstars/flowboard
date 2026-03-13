import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import ResetPassword from '../pages/auth/ResetPassword'
import DashboardLayout from '../components/layout/DashboardLayout'
import AdminDashboard from '../pages/dashboard/AdminDashboard'
import BranchDashboard from '../pages/dashboard/BranchDashboard'
import CentralCheckerDashboard from '../pages/dashboard/CentralCheckerDashboard'
import DivisionalCheckerDashboard from '../pages/dashboard/DivisionalCheckerDashboard'
import RegionalCheckerDashboard from '../pages/dashboard/RegionalCheckerDashboard'
import BranchManagement from '../pages/branches/BranchManagement'
import UserManagement from '../pages/users/UserManagement'
import FormListPage from '../pages/forms/FormListPage'
import FormBuilderPage from '../pages/forms/FormBuilderPage'
import FormSubmitPage from '../pages/forms/FormSubmitPage'
import AdvancedReportViewer from '../pages/reports/AdvancedReportViewer'
import AdvancedReportBuilder from '../pages/reports/AdvancedReportBuilder'
import PermissionManagement from '../pages/permissions/PermissionManagement'
import Settings from '../pages/settings/Settings'
import SubmissionsPage from '../pages/submissions/SubmissionsPage'
import SubmissionHistoryPage from '../pages/submissions/SubmissionHistoryPage'
import BranchSubmissionsPage from '../pages/submissions/BranchSubmissionsPage'
import ProfilePage from '../pages/profile/ProfilePage'
import ChatPage from '../pages/chat/ChatPage'
import AuditLogPage from '../pages/audit/AuditLogPage'
import ExcelImportPage from '../pages/submissions/ExcelImportPage'

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-blue-600 text-xl">Loading...</div>
    </div>
  )
  return user ? children : <Navigate to="/login" />
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-blue-600 text-xl">Loading...</div>
    </div>
  )
  return !user ? children : <Navigate to="/dashboard" />
}

const RoleRoute = ({ children, roles }) => {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-blue-600 text-xl">Loading...</div>
    </div>
  )
  if (!roles.includes(profile?.role)) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500">403</h1>
        <p className="text-gray-600 mt-2">Access Denied</p>
        <a href="/dashboard" className="text-blue-600 hover:underline mt-4 block">Go to Dashboard</a>
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
    default: return <div className="text-center py-8 text-gray-500">Loading...</div>
  }
}

const ADMIN_ONLY = [ROLES.ADMIN]
const CHECKERS = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER]
const BRANCH_USERS = [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE]
const ALL_ROLES = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER, ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE]

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
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

        <Route path="/reports" element={<Navigate to="/advanced-reports" replace />} />
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
          <PrivateRoute roles={[ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER]}>
            <ExcelImportPage />
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

        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}