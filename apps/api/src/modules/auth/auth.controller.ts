import type { Request, Response } from 'express';

export async function getMeController(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}
