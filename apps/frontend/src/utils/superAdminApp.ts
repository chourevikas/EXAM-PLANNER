import { User, UserRole } from '../types/auth';

/**
 * Super Admin runs as its own app on its own origin so its session never shares
 * browser storage with the student/staff app. Set VITE_SUPERADMIN_URL per environment.
 */
export const SUPERADMIN_APP_URL: string =
  (import.meta.env.VITE_SUPERADMIN_URL as string | undefined) || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function isSuperAdmin(user?: Pick<User, 'role'> | null): boolean {
  return user?.role === UserRole.SUPER_ADMIN;
}
