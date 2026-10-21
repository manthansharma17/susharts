import { z } from 'zod';

/** Flat shipping fee. Business rule not yet decided; free shipping until it is. */
export const SHIPPING_FEE_IN_PAISE = 0;

/** How long stock stays reserved for an unpaid order. */
export const ORDER_RESERVATION_MINUTES = 30;

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

const text = (max: number) => z.string().trim().min(1).max(max);

export const checkoutSchema = z.object({
  customerName: text(100),
  email: z.string().trim().email().max(200),
  /** 10-digit Indian mobile, optionally prefixed with +91 / 91 / 0; stored as 10 digits. */
  phone: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')),
  addressLine1: text(200),
  addressLine2: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
  city: text(100),
  state: z.enum(INDIAN_STATES),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/i),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface CheckoutSession {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  /** Public key id for the Razorpay checkout modal. Never the secret. */
  razorpayKeyId: string;
  amountInPaise: number;
  currency: 'INR';
  customer: { name: string; email: string; phone: string };
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotalInPaise: number;
  shippingInPaise: number;
  totalInPaise: number;
  currency: string;
  customerName: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  items: Array<{
    productName: string;
    productSlug: string;
    variantLabel: string;
    unitPriceInPaise: number;
    quantity: number;
    lineTotalInPaise: number;
    fulfillmentType: 'READY_STOCK' | 'MADE_TO_ORDER';
    productionDays: number | null;
  }>;
  paidAt: string | null;
  createdAt: string;
  expiresAt: string;
}
