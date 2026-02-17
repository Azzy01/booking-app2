DROP TABLE IF EXISTS "Slot";

CREATE TYPE "ClubStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "UserRole" AS ENUM ('TECH_ADMIN', 'HOST_ADMIN', 'CLIENT', 'SYSTEM');
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'CONFIRMED');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "SeatType" AS ENUM ('PC', 'CONSOLE', 'VR', 'OTHER');

CREATE TABLE "Club" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "status" "ClubStatus" NOT NULL DEFAULT 'ACTIVE',
  "labelUniquenessScope" TEXT NOT NULL DEFAULT 'CLUB',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Slot" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClubMap" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "draftJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClubMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MapVersion" (
  "id" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "publishedJson" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedBy" TEXT,
  CONSTRAINT "MapVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeatIndex" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "mapVersionId" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "floorId" TEXT NOT NULL,
  "roomId" TEXT,
  "label" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "seatType" "SeatType" NOT NULL DEFAULT 'PC',
  "geometry" JSONB NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeatIndex_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Hold" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "activeKey" TEXT DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByRole" "UserRole" NOT NULL DEFAULT 'CLIENT',
  "createdByUserId" TEXT,
  "customerContext" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "activeKey" TEXT DEFAULT 'ACTIVE',
  "holdId" TEXT,
  "mapVersionId" TEXT,
  "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "customerId" TEXT,
  "customerName" TEXT,
  "price" DOUBLE PRECISION,
  "notes" TEXT,
  "createdByRole" "UserRole" NOT NULL DEFAULT 'CLIENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Slot_clubId_label_startsAt_key" ON "Slot"("clubId", "label", "startsAt");
CREATE INDEX "Slot_clubId_startsAt_idx" ON "Slot"("clubId", "startsAt");

CREATE UNIQUE INDEX "ClubMap_clubId_key" ON "ClubMap"("clubId");

CREATE UNIQUE INDEX "MapVersion_mapId_versionNumber_key" ON "MapVersion"("mapId", "versionNumber");
CREATE INDEX "MapVersion_mapId_publishedAt_idx" ON "MapVersion"("mapId", "publishedAt");

CREATE UNIQUE INDEX "SeatIndex_mapVersionId_seatId_key" ON "SeatIndex"("mapVersionId", "seatId");
CREATE INDEX "SeatIndex_clubId_floorId_idx" ON "SeatIndex"("clubId", "floorId");
CREATE INDEX "SeatIndex_clubId_mapVersionId_idx" ON "SeatIndex"("clubId", "mapVersionId");
CREATE INDEX "SeatIndex_clubId_seatId_idx" ON "SeatIndex"("clubId", "seatId");
CREATE INDEX "SeatIndex_clubId_label_idx" ON "SeatIndex"("clubId", "label");

CREATE INDEX "Hold_clubId_slotId_seatId_idx" ON "Hold"("clubId", "slotId", "seatId");
CREATE INDEX "Hold_status_expiresAt_idx" ON "Hold"("status", "expiresAt");
CREATE UNIQUE INDEX "Hold_clubId_slotId_seatId_activeKey_key" ON "Hold"("clubId", "slotId", "seatId", "activeKey");

CREATE UNIQUE INDEX "Booking_holdId_key" ON "Booking"("holdId");
CREATE UNIQUE INDEX "Booking_clubId_slotId_seatId_activeKey_key" ON "Booking"("clubId", "slotId", "seatId", "activeKey");
CREATE INDEX "Booking_clubId_slotId_idx" ON "Booking"("clubId", "slotId");

ALTER TABLE "Slot"
  ADD CONSTRAINT "Slot_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubMap"
  ADD CONSTRAINT "ClubMap_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MapVersion"
  ADD CONSTRAINT "MapVersion_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "ClubMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeatIndex"
  ADD CONSTRAINT "SeatIndex_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeatIndex"
  ADD CONSTRAINT "SeatIndex_mapVersionId_fkey" FOREIGN KEY ("mapVersionId") REFERENCES "MapVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Hold"
  ADD CONSTRAINT "Hold_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Hold"
  ADD CONSTRAINT "Hold_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "Hold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_mapVersionId_fkey" FOREIGN KEY ("mapVersionId") REFERENCES "MapVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
