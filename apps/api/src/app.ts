import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { getEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { razorpayWebhook } from './modules/checkout/checkout.routes.js';
import { apiRouter } from './routes.js';

export function createApp(): Express {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  // Registered before express.json(): webhook signatures are computed over the raw body.
  app.post('/api/v1/webhooks/razorpay', ...razorpayWebhook);
  app.use(express.json({ limit: '1mb' }));
  app.use(authenticate);

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
