import { Request, Response } from 'express';
import * as ticketCommentService from '../services/ticketComment.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await ticketCommentService.listComments((req.params.id as string), parsePaginationQuery(req.query));
  sendSuccess(res, items, 200, meta);
}

export async function create(req: Request, res: Response): Promise<void> {
  const comment = await ticketCommentService.createComment(req.user!.id, (req.params.id as string), req.body.body);
  sendSuccess(res, comment, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const comment = await ticketCommentService.updateComment(
    req.user!.id,
    req.user!.role,
    (req.params.id as string),
    (req.params.commentId as string),
    req.body.body,
  );
  sendSuccess(res, comment);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await ticketCommentService.deleteComment(req.user!.id, req.user!.role, (req.params.id as string), (req.params.commentId as string));
  sendSuccess(res, { deleted: true });
}
