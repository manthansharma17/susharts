import type { RequestHandler } from 'express';
import type { UserRole } from '@susharts/shared';
import { HttpError } from '../lib/http-error.js';
import { getFirebaseAuth } from '../lib/firebase-admin.js';
import { syncUser } from '../modules/auth/auth.service.js';

export interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const idToken = header.slice(7);
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    const dbUser = await syncUser({
      firebaseUid: decoded.uid,
      email: decoded.email ?? '',
      displayName: decoded.name as string | undefined,
      photoUrl: decoded.picture as string | undefined,
    });

    if (dbUser.isDisabled) {
      next(HttpError.forbidden('Account is disabled'));
      return;
    }

    req.user = {
      id: dbUser.id,
      firebaseUid: dbUser.firebaseUid,
      email: dbUser.email,
      role: dbUser.role as UserRole,
    };
  } catch {
    next(HttpError.unauthorized('Invalid or expired token'));
    return;
  }

  next();
};

export function requireAuth(): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(HttpError.unauthorized());
      return;
    }
    next();
  };
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(HttpError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(HttpError.forbidden('Insufficient permissions'));
      return;
    }
    next();
  };
}
