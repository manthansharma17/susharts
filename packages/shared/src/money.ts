/**
 * All monetary values cross the wire and live in the database as integer paise
 * (1 INR = 100 paise) to avoid floating-point drift in pricing and payments.
 */
export type Paise = number;

export const RUPEE_IN_PAISE = 100;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * RUPEE_IN_PAISE);
}

export function paiseToRupees(paise: Paise): number {
  return paise / RUPEE_IN_PAISE;
}

export function formatInr(paise: Paise): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % RUPEE_IN_PAISE === 0 ? 0 : 2,
  }).format(paiseToRupees(paise));
}
