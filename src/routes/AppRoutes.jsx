import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import ResetPassword from '../pages/auth/ResetPassword'
import DashboardLayout from '../components/layout/DashboardLayout'
import AdminDashboard from '../pages/dashboard/AdminDashboard'
import BranchManagement from '../pages/branches/BranchManagement'
import UserManagement from '../pages/users/UserManagement'
import FormListPage from '../pages/forms/FormListPage'
import FormBuilderPage from '../pages/forms/FormBuilderPage'
import FormSubmitPage from '../pages/forms/FormSubmitPage'
import ReportViewPage from '../pages/reports/ReportViewPage'
import ReportBuilderPage from '../pages/reports/ReportBuilderPage'
import PermissionManagement from '../pages/permissions/PermissionManagement'

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

const ADMIN_ONLY = [ROLES.ADMIN]
const ADMIN_CENTRAL = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER]
const CHECKERS = [ROLES.ADMIN, ROLES.CENTRAL_CHECKER, ROLES.DIVISIONAL_CHECKER, ROLES.REGIONAL_CHECKER]
const BRANCH_USERS = [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.BRANCH_EMPLOYEE]
const ALL_ROLES = Object.values(ROLES)

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

        <Route path="/dashboard" element={
          <PrivateRoute>
            <DashboardLayout><AdminDashboard /></DashboardLayout>
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
            <RoleRoute roles={BRANCH_USERS}>
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
            <RoleRoute roles={BRANCH_USERS}>
              <DashboardLayout><FormSubmitPage /></DashboardLayout>
            </RoleRoute>
          </PrivateRoute>
        } />

        <Route path="/reports" element={
          <PrivateRoute>
            <RoleRoute roles={CHECKERS}>
              <DashboardLayout><ReportViewPage /></DashboardLayout>
            </RoleRoute>
          </PrivateRoute>
        } />

        <Route path="/reports/builder" element={
          <PrivateRoute>
            <RoleRoute roles={ADMIN_ONLY}>
              <DashboardLayout><ReportBuilderPage /></DashboardLayout>
            </RoleRoute>
          </PrivateRoute>
        } />

        <Route path="/permissions" element={
          <PrivateRoute>
            <RoleRoute roles={[ROLES.ADMIN, ROLES.REGIONAL_CHECKER]}>
              <DashboardLayout><PermissionManagement /></DashboardLayout>
            </RoleRoute>
          </PrivateRoute>
        } />

        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}