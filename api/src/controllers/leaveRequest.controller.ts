import { Request, Response } from 'express';
import * as leaveRequestService from '../services/leaveRequest.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await leaveRequestService.listLeaveRequests(req.user!.id, req.user!.role, {
    ...parsePaginationQuery(req.query),
    status: req.query.status as never,
    userId: req.query.userId as string | undefined,
  });
  sendSuccess(res, items, 200, meta);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const leaveRequest = await leaveRequestService.getLeaveRequestById(req.user!.id, req.user!.role, (req.params.id as string));
  sendSuccess(res, leaveRequest);
}

export async function create(req: Request, res: Response): Promise<void> {
  const leaveRequest = await leaveRequestService.createLeaveRequest(req.user!.id, req.body);
  sendSuccess(res, leaveRequest, 201);
}

export async function review(req: Request, res: Response): Promise<void> {
  const leaveRequest = await leaveRequestService.reviewLeaveRequest(
    req.user!.id,
    req.user!.role,
    (req.params.id as string),
    req.body,
  );
  sendSuccess(res, leaveRequest);
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const leaveRequest = await leaveRequestService.cancelLeaveRequest(req.user!.id, req.user!.role, (req.params.id as string));
  sendSuccess(res, leaveRequest);
}

export async function getBalance(req: Request, res: Response): Promise<void> {
  const targetUserId = (req.query.userId as string | undefined) ?? req.user!.id;
  const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
  const balance = await leaveRequestService.getLeaveBalance(req.user!.id, req.user!.role, targetUserId, year);
  sendSuccess(res, balance);
}

export async function getCalendar(req: Request, res: Response): Promise<void> {
  const calendar = await leaveRequestService.getLeaveCalendar(req.user!.id, req.user!.role, {
    from: req.query.from as string,
    to: req.query.to as string,
    departmentId: req.query.departmentId as string | undefined,
  });
  sendSuccess(res, calendar);
}
