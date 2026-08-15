import { Request, Response } from 'express';
import * as ticketService from '../services/ticket.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await ticketService.listTickets({
    ...parsePaginationQuery(req.query),
    status: req.query.status as never,
    priority: req.query.priority as never,
    assignedToId: req.query.assignedToId as string | undefined,
    departmentId: req.query.departmentId as string | undefined,
  });
  sendSuccess(res, items, 200, meta);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.getTicketById((req.params.id as string));
  sendSuccess(res, ticket);
}

export async function create(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.createTicket(req.user!.id, req.body);
  sendSuccess(res, ticket, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.updateTicket((req.params.id as string), req.body);
  sendSuccess(res, ticket);
}

export async function assign(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.assignTicket((req.params.id as string), req.body.assignedToId ?? null);
  sendSuccess(res, ticket);
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.updateTicketStatus(req.user!.id, req.user!.role, (req.params.id as string), req.body.status);
  sendSuccess(res, ticket);
}
