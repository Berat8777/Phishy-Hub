import { Request, Response } from 'express';
import * as fileService from '../services/file.service';
import { BadRequestError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

export async function upload(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new BadRequestError('No file provided (expected multipart field "file")');
  }

  const file = await fileService.uploadFile({
    uploaderId: req.user!.id,
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    declaredMimeType: req.file.mimetype,
  });

  const dto = fileService.toFileDTO(file);

  // Optional same-request attach — lets callers skip a second round trip.
  if (req.body.attachableType && req.body.attachableId) {
    await fileService.attachFile(req.user!.id, req.user!.role, file.id, req.body.attachableType, req.body.attachableId);
  }

  sendSuccess(res, dto, 201);
}

export async function attach(req: Request, res: Response): Promise<void> {
  const attachment = await fileService.attachFile(
    req.user!.id,
    req.user!.role,
    (req.params.id as string),
    req.body.attachableType,
    req.body.attachableId,
  );
  sendSuccess(res, attachment, 201);
}

export async function getDownloadUrl(req: Request, res: Response): Promise<void> {
  const result = await fileService.getDownloadUrl(req.user!.id, req.user!.role, (req.params.id as string));
  sendSuccess(res, result);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await fileService.deleteFile(req.user!.id, req.user!.role, (req.params.id as string));
  sendSuccess(res, { deleted: true });
}
