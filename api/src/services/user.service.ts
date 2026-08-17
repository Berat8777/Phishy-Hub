import { Op, WhereOptions } from 'sequelize';
import bcrypt from 'bcrypt';
import { User, Department } from '../models';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../utils/errors';
import { env } from '../config/env';
import { paginate, PaginationParams } from './pagination.service';
import { getManagedDepartmentIds } from './authz.service';
import type { UserRole, UserStatus } from '../utils/constants';

export interface UserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId: string | null;
  status: UserStatus;
  avatarFileId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Department ids where this user is `Department.managerId` — lets the client show an approvals view without "manager" being a role it can check (see leaveRequest.service.ts). Only populated by toUserDTOWithManagement(); plain toUserDTO() calls leave it `[]`. */
  managedDepartmentIds: string[];
}

export function toUserDTO(user: InstanceType<typeof User>, managedDepartmentIds: string[] = []): UserDTO {
  const json = user.toJSON();
  return {
    id: json.id,
    email: json.email,
    firstName: json.firstName,
    lastName: json.lastName,
    role: json.role,
    departmentId: json.departmentId ?? null,
    status: json.status,
    avatarFileId: json.avatarFileId ?? null,
    lastSeenAt: json.lastSeenAt ? new Date(json.lastSeenAt).toISOString() : null,
    createdAt: new Date(json.createdAt).toISOString(),
    updatedAt: new Date(json.updatedAt).toISOString(),
    managedDepartmentIds,
  };
}

/** `toUserDTO()` + a live lookup of `managedDepartmentIds` — used only where the client needs it (GET /auth/me, login, register) to avoid an extra query per row on list endpoints. */
export async function toUserDTOWithManagement(user: InstanceType<typeof User>): Promise<UserDTO> {
  const managedDepartmentIds = await getManagedDepartmentIds(user.id);
  return toUserDTO(user, managedDepartmentIds);
}

export async function getUserById(id: string): Promise<InstanceType<typeof User>> {
  const user = await User.findByPk(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function listUsers(
  params: PaginationParams & { role?: UserRole; departmentId?: string; status?: UserStatus },
) {
  const where: WhereOptions = {};
  if (params.role) where.role = params.role;
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.status) where.status = params.status;
  if (params.q) {
    where[Op.or as unknown as string] = [
      { firstName: { [Op.iLike]: `%${params.q}%` } },
      { lastName: { [Op.iLike]: `%${params.q}%` } },
      { email: { [Op.iLike]: `%${params.q}%` } },
    ];
  }

  return paginate(User, params, { where });
}

export async function updateOwnProfile(
  userId: string,
  input: { firstName?: string; lastName?: string; avatarFileId?: string | null },
): Promise<InstanceType<typeof User>> {
  const user = await getUserById(userId);
  if (input.firstName !== undefined) user.firstName = input.firstName;
  if (input.lastName !== undefined) user.lastName = input.lastName;
  if (input.avatarFileId !== undefined) user.avatarFileId = input.avatarFileId;
  await user.save();
  return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw new NotFoundError('User not found');
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new BadRequestError('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await user.save();
}

/**
 * `callerRole` gates one thing specifically: granting `role: 'admin'`.
 * `PATCH /users/:id` is reachable by `admin` OR `hr` (see user.routes.ts),
 * but only an existing admin may hand out the admin role — otherwise an
 * `hr` account could grant itself (or anyone) full admin via this endpoint,
 * defeating the RBAC model entirely.
 */
export async function adminUpdateUser(
  id: string,
  input: { role?: UserRole; status?: UserStatus; departmentId?: string | null },
  callerRole: UserRole,
): Promise<InstanceType<typeof User>> {
  if (input.role === 'admin' && callerRole !== 'admin') {
    throw new ForbiddenError('Only an admin can grant the admin role');
  }

  const user = await getUserById(id);
  if (user.isBot) {
    throw new ForbiddenError('The @ai bot user cannot be modified');
  }
  if (input.departmentId) {
    const department = await Department.findByPk(input.departmentId);
    if (!department) throw new BadRequestError('departmentId does not reference an existing department');
  }
  if (input.role !== undefined) user.role = input.role;
  if (input.status !== undefined) user.status = input.status;
  if (input.departmentId !== undefined) user.departmentId = input.departmentId;
  await user.save();
  return user;
}

export async function adminCreateUser(
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    departmentId?: string | null;
  },
  callerRole: UserRole,
): Promise<InstanceType<typeof User>> {
  if (input.role === 'admin' && callerRole !== 'admin') {
    throw new ForbiddenError('Only an admin can grant the admin role');
  }

  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new ConflictError('Email is already registered');

  if (input.departmentId) {
    const department = await Department.findByPk(input.departmentId);
    if (!department) throw new BadRequestError('departmentId does not reference an existing department');
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);
  return User.create({
    email,
    passwordHash,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: input.role ?? 'employee',
    status: 'active',
    departmentId: input.departmentId ?? null,
  });
}

export async function softDeleteUser(id: string): Promise<void> {
  const user = await getUserById(id);
  if (user.isBot) {
    throw new ForbiddenError('The @ai bot user cannot be deleted');
  }
  await user.destroy();
}
