/**
 * Minimal injectable environment source, mirroring the one in `config/env.ts`.
 * Keeping it local keeps this resolver pure and free of any import that would
 * load `dotenv` or the generated Prisma client.
 */
export type EnvSource = Record<string, string | undefined>;

/**
 * Name of the variable that holds the pooled connection URL (port 6543). It
 * is the one the Prisma runtime client uses; migrations use `DIRECT_URL`.
 */
const DATABASE_URL = "DATABASE_URL";

/**
 * Resolves the pooled database URL from an environment source.
 *
 * A blank or whitespace-only value counts as absent. When the variable is
 * missing the error names the variable and never echoes the value: the URL is
 * a credential and must not end up in logs or crash reports.
 */
export function resolveDatabaseUrl(source: EnvSource = process.env): string {
	const value = source[DATABASE_URL];
	if (value === undefined || value.trim() === "") {
		throw new Error(`Missing required environment variable: ${DATABASE_URL}`);
	}

	return value;
}
