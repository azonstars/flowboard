import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
            <DashboardLayout><BranchManagement /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/users" element={
          <PrivateRoute>
            <DashboardLayout><UserManagement /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/forms" element={
          <PrivateRoute>
            <DashboardLayout><FormListPage /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/forms/builder" element={
          <PrivateRoute>
            <DashboardLayout><FormBuilderPage /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/forms/submit/:formId" element={
          <PrivateRoute>
            <DashboardLayout><FormSubmitPage /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/reports" element={
          <PrivateRoute>
            <DashboardLayout><ReportViewPage /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/reports/builder" element={
          <PrivateRoute>
            <DashboardLayout><ReportBuilderPage /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/permissions" element={
          <PrivateRoute>
            <DashboardLayout><PermissionManagement /></DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}