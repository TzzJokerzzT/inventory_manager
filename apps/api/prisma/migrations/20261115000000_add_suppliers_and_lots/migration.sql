-- Suppliers, purchase lots and the physical units of a lot.
--
-- The model exists because a product can be bought by weight and sold by unit:
-- the cost of a roll comes from the lot it belongs to (its weight times the
-- price per measure), while its sale price is written per sale. Structured in
-- four tables so no number is stored twice:
--
--   suppliers      who sold the bulk goods
--   stock_lots     one purchase: measure bought and price per measure
--   lot_units      one physical unit of that purchase, with its own weight
--   movement_units which units a movement took out
--
-- Written by hand (like every migration in this repository): `prisma migrate
-- dev` needs a live database to diff.
--
-- Invariants the database cannot express as a CHECK, enforced by the use case
-- and pinned by tests: the sum of `lot_units.cost` equals
-- `stock_lots.measure_total * stock_lots.cost_per_measure`, and
-- `stock_lots.unit_count` equals the number of rows created in `lot_units`.

-- CreateEnum
CREATE TYPE "MeasureUnit" AS ENUM ('KILOGRAM', 'LITRE', 'METRE');

-- CreateEnum
CREATE TYPE "LotUnitStatus" AS ENUM ('AVAILABLE', 'SOLD');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Soft delete, like products and customers: a supplier referenced by a lot
    -- can never be removed without erasing purchase history.
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_name_key" ON "suppliers"("company_id", "name");

-- CreateIndex
CREATE INDEX "suppliers_company_id_deleted_at_idx" ON "suppliers"("company_id", "deleted_at");

-- CreateTable
CREATE TABLE "stock_lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Three decimals: grams matter when you pay by the kilo.
    "measure_total" DECIMAL(12,3) NOT NULL,
    "cost_per_measure" DECIMAL(12,2) NOT NULL,
    "unit_count" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_lots_company_id_product_id_received_at_idx" ON "stock_lots"("company_id", "product_id", "received_at");

-- CreateIndex
CREATE INDEX "stock_lots_company_id_supplier_id_idx" ON "stock_lots"("company_id", "supplier_id");

-- CreateTable
CREATE TABLE "lot_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "measure" DECIMAL(12,3) NOT NULL,
    -- Snapshot of this unit's cost, so a later price change in the lot never
    -- rewrites history.
    "cost" DECIMAL(12,2) NOT NULL,
    "status" "LotUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lot_units_lot_id_code_key" ON "lot_units"("lot_id", "code");

-- CreateIndex
CREATE INDEX "lot_units_lot_id_status_idx" ON "lot_units"("lot_id", "status");

-- CreateTable
-- The join is a table, not an array column, because a sale that takes several
-- rolls needs to be readable per unit (which roll left, with which cost).
CREATE TABLE "movement_units" (
    "movement_id" UUID NOT NULL,
    "lot_unit_id" UUID NOT NULL,

    CONSTRAINT "movement_units_pkey" PRIMARY KEY ("movement_id", "lot_unit_id")
);

-- CreateIndex
CREATE INDEX "movement_units_lot_unit_id_idx" ON "movement_units"("lot_unit_id");

-- AlterTable
-- Default KILOGRAM keeps every existing product valid without a backfill: it is
-- only used to label the measure of future lots.
ALTER TABLE "products" ADD COLUMN "measure_unit" "MeasureUnit" NOT NULL DEFAULT 'KILOGRAM';

-- AlterTable
-- NULL on purpose (see the model comment): entries and historical movements have
-- no applied price, and inventing one would fabricate margin data.
ALTER TABLE "stock_movements" ADD COLUMN "unit_price" DECIMAL(12,2);
ALTER TABLE "stock_movements" ADD COLUMN "lot_id" UUID;

-- CreateIndex
CREATE INDEX "stock_movements_lot_id_idx" ON "stock_movements"("lot_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_units" ADD CONSTRAINT "lot_units_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_units" ADD CONSTRAINT "movement_units_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_units" ADD CONSTRAINT "movement_units_lot_unit_id_fkey" FOREIGN KEY ("lot_unit_id") REFERENCES "lot_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
