import { ROLES } from './roles'

export const MENU_ITEMS = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    roles: [
      ROLES.ADMIN,
      ROLES.CENTRAL_CHECKER,
      ROLES.DIVISIONAL_CHECKER,
      ROLES.REGIONAL_CHECKER,
      ROLES.BRANCH_MANAGER,
      ROLES.BRANCH_EMPLOYEE,
    ],
  },
  {
    label: 'Form Builder',
    path: '/forms/builder',
    icon: 'FormInput',
    roles: [ROLES.ADMIN],
  },
  {
    label: 'Report Builder',
    path: '/reports/builder',
    icon: 'BarChart2',
    roles: [ROLES.ADMIN],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: 'BarChart',
    roles: [
      ROLES.ADMIN,
      ROLES.CENTRAL_CHECKER,
      ROLES.DIVISIONAL_CHECKER,
      ROLES.REGIONAL_CHECKER,
    ],
  },
  {
    label: 'Users',
    path: '/users',
    icon: 'Users',
    roles: [ROLES.ADMIN],
  },
  {
    label: 'Branches',
    path: '/branches',
    icon: 'GitBranch',
    roles: [ROLES.ADMIN],
  },
  {
    label: 'Permissions',
    path: '/permissions',
    icon: 'Shield',
    roles: [ROLES.ADMIN, ROLES.REGIONAL_CHECKER],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: 'Settings',
    roles: [ROLES.ADMIN],
  },
]