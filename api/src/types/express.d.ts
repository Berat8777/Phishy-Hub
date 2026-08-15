import { UserRole } from '../utils/constants';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  orgId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
