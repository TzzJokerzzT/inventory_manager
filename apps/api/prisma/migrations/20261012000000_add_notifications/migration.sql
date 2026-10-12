-- Notifications are *events* ("X accepted your invitation"), kept separate from
-- `memberships`, which is the *state* of an access relation. The table was
-- written by hand (like the initial migration): `prisma migrate dev` needs a
-- live database to diff, and this migration is authored by inspection.

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    -- The payload is the reader's context (the membership/company the event is
    -- about); the enum-like `type` is text so a new event kind needs no
    -- migration. The default keeps the column non-null with no special-casing
    -- for events that carry no payload.
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- The dedupe key is derived from the event, so the UNIQUE index is what
    -- makes a retried accept idempotent instead of a duplicate notification.
    "dedupe_key" TEXT NOT NULL,
    -- NULL means unread; there is no `is_read` boolean to drift from it.
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
-- The read is always "this user's notifications, newest first": the index
-- matches the WHERE and the ORDER BY so it never has to sort in memory.
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- AddForeignKey
-- RESTRICT like every other relation: users are never hard-deleted, so a
-- notification can never be orphaned.
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
