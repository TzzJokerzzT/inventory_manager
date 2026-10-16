import { resolveDatabaseUrl } from "../src/infrastructure/database/database-url.js";

const pooledUrl =
	"postgresql://user:password@pooler.example.com:6543/postgres?pgbouncer=true";

describe("resolveDatabaseUrl", () => {
	it("returns the pooled URL when it is present", () => {
		expect(resolveDatabaseUrl({ DATABASE_URL: pooledUrl })).toBe(pooledUrl);
	});

	it("throws naming the variable when it is missing", () => {
		expect(() => resolveDatabaseUrl({})).toThrow(
			/Missing required environment variable: DATABASE_URL/,
		);
	});

	it("treats a blank value as absent", () => {
		expect(() => resolveDatabaseUrl({ DATABASE_URL: "   " })).toThrow(
			/Missing required environment variable: DATABASE_URL/,
		);
	});

	it("never includes the connection string in the error message", () => {
		// The only error path is a missing value, so the message must be a
		// fixed string that names the variable and never echoes a URL.
		try {
			resolveDatabaseUrl({ DATABASE_URL: "   " });
			throw new Error("expected resolveDatabaseUrl to throw");
		} catch (error) {
			const message = String(error);
			expect(message).toContain("DATABASE_URL");
			expect(message).not.toContain("postgresql://");
			expect(message).not.toContain("pooler.example.com");
		}
	});
});
