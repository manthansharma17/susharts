import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'Invalid request', details: err.issues },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Prisma unique-constraint violation (e.g. duplicate slug or SKU).
  if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002') {
    const target = (err as { meta?: { target?: unknown } }).meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : [];
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: fields.length
          ? `A record with this ${fields.join(', ')} already exists`
          : 'A record with these values already exists',
        details: { fields },
      },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
