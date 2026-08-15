import { Department } from '../models';
import { NotFoundError } from '../utils/errors';
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

export async function createDepartment(name: string): Promise<InstanceType<typeof Department>> {
  const organizationId = await getDefaultOrganizationId();
  return Department.create({ organizationId, name: name.trim() });
}

export async function updateDepartment(id: string, name: string): Promise<InstanceType<typeof Department>> {
  const department = await getDepartmentById(id);
  department.name = name.trim();
  await department.save();
  return department;
}

export async function deleteDepartment(id: string): Promise<void> {
  const department = await getDepartmentById(id);
  await department.destroy();
}
