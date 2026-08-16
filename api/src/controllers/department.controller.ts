import { Request, Response } from 'express';
import * as departmentService from '../services/department.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await departmentService.listDepartments(parsePaginationQuery(req.query));
  sendSuccess(res, items, 200, meta);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const department = await departmentService.getDepartmentById((req.params.id as string));
  sendSuccess(res, department);
}

export async function create(req: Request, res: Response): Promise<void> {
  const department = await departmentService.createDepartment(req.body);
  sendSuccess(res, department, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const department = await departmentService.updateDepartment((req.params.id as string), req.body);
  sendSuccess(res, department);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await departmentService.deleteDepartment((req.params.id as string));
  sendSuccess(res, { deleted: true });
}
