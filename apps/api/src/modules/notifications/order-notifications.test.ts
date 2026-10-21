import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = {
  order: { findUnique: vi.fn() },
  emailNotification: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};
vi.mock('@susharts/db', () => ({ prisma: db }));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
const email = {
  sendEmail: vi.fn(),
  publicWebUrl: () => 'https://shop.example',
};
vi.mock('../../lib/email.js', () => email);

const { buildOrderEmail, retryOrderNotifications, sendOrderNotification, MAX_EMAIL_ATTEMPTS } =
  await import('./order-notifications.js');

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const order = {
  id: ORDER_ID,
  orderNumber: 'SUS-20261021-ABCD1234',
  customerName: 'Asha <script>',
  email: 'asha@example.com',
  totalInPaise: 69900,
  subtotalInPaise: 69900,
  shippingInPaise: 0,
  addressLine1: '1 MG Road',
  addressLine2: null,
  city: 'Pune',
  state: 'Maharashtra',
  postalCode: '411001',
  shippingCarrier: 'Delhivery',
  trackingNumber: 'DL123',
  items: [
    {
      productName: 'Tulip "Bouquet"',
      variantLabel: 'Default',
      quantity: 1,
      lineTotalInPaise: 69900,
    },
  ],
};
const row = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  orderId: ORDER_ID,
  type: 'ORDER_CONFIRMED',
  status: 'PENDING',
  recipient: 'asha@example.com',
  attempts: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.order.findUnique.mockResolvedValue(order);
  db.emailNotification.findUnique.mockResolvedValue(null);
  db.emailNotification.create.mockResolvedValue(row());
  db.emailNotification.updateMany.mockResolvedValue({ count: 1 });
  email.sendEmail.mockResolvedValue({ id: 'resend_1' });
});

describe('buildOrderEmail', () => {
  it('escapes customer and catalog text in HTML', () => {
    const { html, text } = buildOrderEmail('ORDER_CONFIRMED', order);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Tulip &quot;Bouquet&quot;');
    expect(text).toContain('https://shop.example/orders/' + ORDER_ID);
  });

  it('includes tracking details in the shipment email', () => {
    expect(buildOrderEmail('ORDER_SHIPPED', order).text).toContain(
      'Delhivery · Tracking number: DL123',
    );
  });

  it('omits the item list from the payment-failed email', () => {
    expect(buildOrderEmail('PAYMENT_FAILED', order).text).not.toContain('Total:');
  });
});

describe('sendOrderNotification', () => {
  it('sends once and records SENT, using the notification id as the idempotency key', async () => {
    expect(await sendOrderNotification(ORDER_ID, 'ORDER_CONFIRMED')).toBe('sent');
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'asha@example.com', idempotencyKey: 'n1' }),
    );
    expect(db.emailNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({ status: 'SENT', providerId: 'resend_1' }),
    });
  });

  it('does not resend an email that was already sent (repeated callbacks/status updates)', async () => {
    db.emailNotification.findUnique.mockResolvedValue(row({ status: 'SENT', attempts: 1 }));
    expect(await sendOrderNotification(ORDER_ID, 'ORDER_CONFIRMED')).toBe('skipped');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('handles a concurrent creator: the unique conflict reuses the existing row', async () => {
    db.emailNotification.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );
    db.emailNotification.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row({ status: 'SENT' }));
    expect(await sendOrderNotification(ORDER_ID, 'ORDER_CONFIRMED')).toBe('skipped');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('does not send when another caller already claimed this attempt', async () => {
    db.emailNotification.updateMany.mockResolvedValue({ count: 0 });
    expect(await sendOrderNotification(ORDER_ID, 'ORDER_CONFIRMED')).toBe('skipped');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('records a provider failure as FAILED and never throws', async () => {
    email.sendEmail.mockRejectedValue(new Error('Resend error 500'));
    await expect(sendOrderNotification(ORDER_ID, 'ORDER_SHIPPED')).resolves.toBe('failed');
    expect(db.emailNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'FAILED', lastError: 'Resend error 500' },
    });
  });

  it('never throws even if the database is unavailable', async () => {
    db.order.findUnique.mockRejectedValue(new Error('db down'));
    await expect(sendOrderNotification(ORDER_ID, 'ORDER_CONFIRMED')).resolves.toBe('failed');
  });

  it('retries a FAILED email with the same idempotency key', async () => {
    db.emailNotification.findUnique.mockResolvedValue(row({ status: 'FAILED', attempts: 2 }));
    expect(await sendOrderNotification(ORDER_ID, 'ORDER_CONFIRMED')).toBe('sent');
    expect(db.emailNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', status: { not: 'SENT' }, attempts: 2 },
      data: { attempts: { increment: 1 }, status: 'PENDING' },
    });
    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'n1' }));
  });

  it('stops after the maximum number of attempts', async () => {
    db.emailNotification.findUnique.mockResolvedValue(
      row({ status: 'FAILED', attempts: MAX_EMAIL_ATTEMPTS }),
    );
    expect(await sendOrderNotification(ORDER_ID, 'ORDER_CONFIRMED')).toBe('skipped');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });
});

describe('retryOrderNotifications', () => {
  it('retries only unsent emails under the attempt limit', async () => {
    db.emailNotification.findMany.mockResolvedValue([{ type: 'ORDER_SHIPPED' }]);
    db.emailNotification.findUnique.mockResolvedValue(
      row({ type: 'ORDER_SHIPPED', status: 'FAILED', attempts: 1 }),
    );
    expect(await retryOrderNotifications(ORDER_ID)).toBe(1);
    expect(db.emailNotification.findMany).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID, status: { not: 'SENT' }, attempts: { lt: MAX_EMAIL_ATTEMPTS } },
      select: { type: true },
    });
  });
});
