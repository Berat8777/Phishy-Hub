import { Department, User } from '../models';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { getDefaultOrganizationId } from './auth.service';
import { paginate, PaginationParams } from './pagination.service';

export async function listDepartments(params: PaginationParams) {
  return paginate(Department, params, {}, 'name');
}

export async function getDepartmentById(id: string): Promise<InstanceType<typeof Department>> {
  const department = await Department.findByPk(id);
  if (!department) throw new NotFoundError('Department not found');
  return department;
}

async function assertValidManagerId(managerId: string | null | undefined): Promise<void> {
  if (!managerId) return;
  const manager = await User.findByPk(managerId);
  if (!manager) throw new BadRequestError('managerId does not reference an existing user');
}

export async function createDepartment(input: { name: string; managerId?: string | null }): Promise<InstanceType<typeof Department>> {
  await assertValidManagerId(input.managerId);
  const organizationId = await getDefaultOrganizationId();
  return Department.create({ organizationId, name: input.name.trim(), managerId: input.managerId ?? null });
}

export async function updateDepartment(
  id: string,
  input: { name?: string; managerId?: string | null },
): Promise<InstanceType<typeof Department>> {
  const department = await getDepartmentById(id);
  if (input.managerId !== undefined) {
    await assertValidManagerId(input.managerId);
    department.managerId = input.managerId;
  }
  if (input.name !== undefined) department.name = input.name.trim();
  await department.save();
  return department;
}

export async function deleteDepartment(id: string): Promise<void> {
  const department = await getDepartmentById(id);
  await department.destroy();
}
