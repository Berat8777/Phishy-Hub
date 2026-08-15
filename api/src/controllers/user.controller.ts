import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await userService.listUsers({
    ...parsePaginationQuery(req.query),
    role: req.query.role as never,
    status: req.query.status as never,
    departmentId: req.query.departmentId as string | undefined,
  });
  sendSuccess(
    res,
    items.map((u) => userService.toUserDTO(u)),
    200,
    meta,
  );
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = await userService.getUserById((req.params.id as string));
  sendSuccess(res, userService.toUserDTO(user));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await userService.updateOwnProfile(req.user!.id, req.body);
  sendSuccess(res, userService.toUserDTO(user));
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  await userService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  sendSuccess(res, { changed: true });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const user = await userService.adminCreateUser(req.body, req.user!.role);
  sendSuccess(res, userService.toUserDTO(user), 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const user = await userService.adminUpdateUser((req.params.id as string), req.body, req.user!.role);
  sendSuccess(res, userService.toUserDTO(user));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await userService.softDeleteUser((req.params.id as string));
  sendSuccess(res, { deleted: true });
}
