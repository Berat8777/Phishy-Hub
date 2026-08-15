import { Request, Response } from 'express';
import * as meetingService from '../services/meeting.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await meetingService.listMeetings(req.user!.id, {
    ...parsePaginationQuery(req.query),
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  sendSuccess(res, items, 200, meta);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const meeting = await meetingService.getMeetingById((req.params.id as string));
  sendSuccess(res, meeting);
}

export async function create(req: Request, res: Response): Promise<void> {
  const meeting = await meetingService.createMeeting(req.user!.id, req.body);
  sendSuccess(res, meeting, 201);
}

export async function respond(req: Request, res: Response): Promise<void> {
  const meeting = await meetingService.respondToMeeting(req.user!.id, (req.params.id as string), req.body.rsvpStatus);
  sendSuccess(res, meeting);
}
