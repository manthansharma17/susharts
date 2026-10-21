import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const mockVerifyIdToken = vi.fn();
const mockSyncUser = vi.fn();

vi.mock('../lib/firebase-admin.js', () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
}));

vi.mock('../modules/auth/auth.service.js', () => ({
  syncUser: mockSyncUser,
}));

const { authenticate, requireAuth, requireRole } = await import('./auth.js');

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers, user: undefined } as unknown as Request;
}
function mockRes(): Response {
  return {} as Response;
}

describe('authenticate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next without setting user when no Authorization header', async () => {
    const req = mockReq();
    const next = vi.fn();
    await (authenticate as (req: Request, res: Response, next: NextFunction) => Promise<void>)(
      req,
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('calls next without setting user when header is not Bearer', async () => {
    const req = mockReq({ authorization: 'Basic abc' });
    const next = vi.fn();
    await (authenticate as (req: Request, res: Response, next: NextFunction) => Promise<void>)(
      req,
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('sets req.user for a valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-1',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
    });
    mockSyncUser.mockResolvedValue({
      id: 'db-uuid-1',
      firebaseUid: 'firebase-uid-1',
      email: 'test@example.com',
      role: 'CUSTOMER',
      isDisabled: false,
    });

    const req = mockReq({ authorization: 'Bearer valid-token' });
    const next = vi.fn();
    await (authenticate as (req: Request, res: Response, next: NextFunction) => Promise<void>)(
      req,
      mockRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: 'db-uuid-1',
      firebaseUid: 'firebase-uid-1',
      email: 'test@example.com',
      role: 'CUSTOMER',
    });
  });

  it('passes 401 error for an invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));

    const req = mockReq({ authorization: 'Bearer bad-token' });
    const next = vi.fn();
    await (authenticate as (req: Request, res: Response, next: NextFunction) => Promise<void>)(
      req,
      mockRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(req.user).toBeUndefined();
  });

  it('passes 403 error for a disabled user', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-2',
      email: 'disabled@example.com',
    });
    mockSyncUser.mockResolvedValue({
      id: 'db-uuid-2',
      firebaseUid: 'firebase-uid-2',
      email: 'disabled@example.com',
      role: 'CUSTOMER',
      isDisabled: true,
    });

    const req = mockReq({ authorization: 'Bearer valid-disabled-token' });
    const next = vi.fn();
    await (authenticate as (req: Request, res: Response, next: NextFunction) => Promise<void>)(
      req,
      mockRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});

describe('requireAuth', () => {
  it('passes 401 when no user is set', () => {
    const req = mockReq();
    const next = vi.fn();
    requireAuth()(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('calls next when user is set', () => {
    const req = mockReq();
    req.user = { id: '1', firebaseUid: 'f1', email: 'a@b.com', role: 'CUSTOMER' };
    const next = vi.fn();
    requireAuth()(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireRole', () => {
  it('passes 401 when no user is set', () => {
    const req = mockReq();
    const next = vi.fn();
    requireRole('ADMIN')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('passes 403 when user role is not in allowed list', () => {
    const req = mockReq();
    req.user = { id: '1', firebaseUid: 'f1', email: 'a@b.com', role: 'CUSTOMER' };
    const next = vi.fn();
    requireRole('ADMIN', 'STAFF')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('calls next when user role is allowed', () => {
    const req = mockReq();
    req.user = { id: '1', firebaseUid: 'f1', email: 'a@b.com', role: 'ADMIN' };
    const next = vi.fn();
    requireRole('ADMIN', 'STAFF')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});
