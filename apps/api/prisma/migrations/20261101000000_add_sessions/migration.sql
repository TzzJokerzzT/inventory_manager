-- Sessions are what make the refresh cookie revocable and idle-limited. The
-- cookie itself cannot be un-issued: the refresh token stays valid at the
-- identity provider until its own expiry, so the only authority over "this
-- browser may no longer renew the token" is a row the API owns.
--
-- Written by hand (like the initial and notifications migrations):
-- `prisma migrate dev` needs a live database to diff, and this migration is
-- authored by inspection.
--
-- `last_activity_at` is moved forward by every successful refresh and is the
-- value the idle window (SESSION_IDLE_TIMEOUT_MINUTES) is applied to.
-- `revoked_at` is the logout tombstone; NULL means the session is still
-- usable. The window itself is never stored: it is policy, not state.
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Logout and "list this user's sessions" both filter by user, so the foreign
-- key gets its index like every other relation in this schema.
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
-- RESTRICT like every other relation: users are never hard-deleted, so a
-- session can never be orphaned.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
