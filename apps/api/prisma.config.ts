import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 owns the datasource URL here instead of in `schema.prisma`.
 *
 * The CLI (validate/generate/migrate) must use the DIRECT session-pooler URL
 * (port 5432), never the pooled one (port 6543): that pooled URL is only for
 * the runtime client and is wired through the driver adapter in
 * `prisma-client.ts`.
 *
 * The URL is read from `process.env` rather than the `env()` helper because
 * `env()` throws when the variable is empty, which breaks `prisma generate`
 * in a fresh clone that has no `.env` yet. Generate does not need a database
 * connection; only the migrate commands fail when the value is absent, and
 * they fail for the right reason (no target database to reach).
 */
export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: process.env.DIRECT_URL,
	},
});
