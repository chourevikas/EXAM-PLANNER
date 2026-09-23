import { Permission, Role, User } from '../types/auth';
import { apiFetch } from './http';

const API_BASE_URL = '/api/v1/admin';

export async function fetchPermissions(): Promise<Permission[]> {
  const res = await apiFetch(`${API_BASE_URL}/permissions`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch permissions' }));
    throw new Error(errorData.detail || 'Could not fetch permission catalog.');
  }
  return await res.json();
}

export async function fetchRoles(): Promise<Role[]> {
  const res = await apiFetch(`${API_BASE_URL}/roles`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch roles' }));
    throw new Error(errorData.detail || 'Could not fetch roles.');
  }
  return await res.json();
}

export async function createRole(payload: {
  name: string;
  base_role_type: string;
  description?: string;
  permission_keys: string[];
}): Promise<Role> {
  const res = await apiFetch(`${API_BASE_URL}/roles`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to create role' }));
    throw new Error(errorData.detail || 'Could not create role.');
  }
  return await res.json();
}

export async function updateRole(
  roleId: number,
  payload: { name?: string; description?: string; permission_keys?: string[] }
): Promise<Role> {
  const res = await apiFetch(`${API_BASE_URL}/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update role' }));
    throw new Error(errorData.detail || 'Could not update role.');
  }
  return await res.json();
}

export async function deleteRole(roleId: number): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/roles/${roleId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to delete role' }));
    throw new Error(errorData.detail || 'Could not delete role.');
  }
}

export async function updateUserRoleAssignment(userId: number | string, roleId: number): Promise<User> {
  const res = await apiFetch(`${API_BASE_URL}/users/${userId}/role-assignment`, {
    method: 'PUT',
    body: JSON.stringify({ role_id: roleId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to assign role' }));
    throw new Error(errorData.detail || 'Could not assign role.');
  }
  return await res.json();
}
