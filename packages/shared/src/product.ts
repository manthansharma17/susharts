export const PRODUCT_CATEGORIES = ['PIPE_CLEANER', 'CROCHET'] as const;

export type ProductCategorySlug = (typeof PRODUCT_CATEGORIES)[number];

export const USER_ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];
