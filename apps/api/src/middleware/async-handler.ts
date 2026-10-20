import type { RequestHandler } from 'express';

/** Forwards rejected promises to the Express error handler (Express 4 needs this). */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
