-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('READY_STOCK', 'MADE_TO_ORDER');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" VARCHAR(300),
    "categoryId" UUID NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'READY_STOCK',
    "productionDays" INTEGER,
    "metaTitle" VARCHAR(70),
    "metaDescription" VARCHAR(160),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Default',
    "sku" TEXT NOT NULL,
    "priceInPaise" INTEGER NOT NULL,
    "compareAtPriceInPaise" INTEGER,
    "stockQuantity" INTEGER,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_position_idx" ON "Product"("categoryId", "position");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_position_idx" ON "ProductVariant"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductVariant_isAvailable_idx" ON "ProductVariant"("isAvailable");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
