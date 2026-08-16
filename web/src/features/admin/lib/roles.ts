import type { UserRole, UserStatus } from '../../../api/types';

/** Single source of truth for role display strings — reused by AdminUsersView, UserCreateDialog, UserEditDialog. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  employee: 'Employee',
  developer: 'Developer',
  sales: 'Sales',
  hr: 'HR',
  admin: 'Admin',
};

export const ALL_USER_ROLES: UserRole[] = ['employee', 'developer', 'sales', 'hr', 'admin'];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Pending',
};

export const ALL_USER_STATUSES: UserStatus[] = ['active', 'suspended', 'pending'];
