import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "./database-url.js";
import { PrismaClient } from "./generated/prisma/client.js";

/**
 * Builds a Prisma client wired to the Supabase pooler through the `pg` driver
 * adapter.
 *
 * The runtime client must use the POOLED URL (port 6543): a serverless
 * function cannot hold direct (port 5432) connections, and the pooler keeps
 * the connection count inside Supabase's limits. `PrismaClient` is generated
 * by `db:generate` into `generated/prisma`, which is outside version control,
 * so this factory is the single seam that lets tests pass an explicit
 * connection string without loading the generated code.
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
	return new PrismaClient({
		adapter: new PrismaPg({
			connectionString: connectionString ?? resolveDatabaseUrl(),
		}),
	});
}
