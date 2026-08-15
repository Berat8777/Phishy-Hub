import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { toUserDTO, getUserById } from '../services/user.service';
import { sendSuccess } from '../utils/response';

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ip: req.ip ?? null,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const user = await authService.registerUser(req.body);
  sendSuccess(res, { user: toUserDTO(user) }, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const { user, tokens } = await authService.login(email, password, requestMeta(req));
  sendSuccess(res, { user: toUserDTO(user), ...tokens });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const tokens = await authService.refresh(req.body.refreshToken, requestMeta(req));
  sendSuccess(res, tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.body.refreshToken);
  sendSuccess(res, { loggedOut: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.user!.id);
  sendSuccess(res, { user: toUserDTO(user) });
}
