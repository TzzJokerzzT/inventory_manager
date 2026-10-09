import { loadEnv } from "../src/config/env.js";

const validSource = {
	DATABASE_URL: "postgresql://user:pw@pooler.example.com:6543/postgres",
	DIRECT_URL: "postgresql://user:pw@db.example.com:5432/postgres",
	WEB_ORIGIN: "http://localhost:3000",
	AUTH0_DOMAIN: "tenant.us.auth0.com",
	AUTH0_AUDIENCE: "https://inventory-manager-api",
	AUTH0_CLIENT_ID: "client-id-value",
	AUTH0_CLIENT_SECRET: "client-secret-value",
	AUTH0_CONNECTION: "Username-Password-Authentication",
	CLOUDINARY_CLOUD_NAME: "demo-cloud",
	CLOUDINARY_API_KEY: "123456789012345",
	CLOUDINARY_API_SECRET: "cloudinary-secret-value",
};

describe("loadEnv defaults", () => {
	it("falls back to the default port and development environment", () => {
		const env = loadEnv({});

		expect(env.port).toBe(3001);
		expect(env.nodeEnv).toBe("development");
	});

	it("leaves the credentials undefined outside production", () => {
		const env = loadEnv({});

		expect(env.databaseUrl).toBeUndefined();
		expect(env.directUrl).toBeUndefined();
		expect(env.webOrigin).toBeUndefined();
		expect(env.auth0.domain).toBeUndefined();
		expect(env.auth0.audience).toBeUndefined();
		expect(env.auth0.clientId).toBeUndefined();
		expect(env.auth0.clientSecret).toBeUndefined();
		expect(env.auth0.connection).toBeUndefined();
		expect(env.cloudinary.cloudName).toBeUndefined();
		expect(env.cloudinary.apiKey).toBeUndefined();
		expect(env.cloudinary.apiSecret).toBeUndefined();
	});

	it("treats a blank value as absent", () => {
		const env = loadEnv({ AUTH0_DOMAIN: "   " });

		expect(env.auth0.domain).toBeUndefined();
	});

	it("reads every value when the source is complete", () => {
		const env = loadEnv(validSource);

		expect(env.databaseUrl).toBe(validSource.DATABASE_URL);
		expect(env.directUrl).toBe(validSource.DIRECT_URL);
		expect(env.webOrigin).toBe(validSource.WEB_ORIGIN);
		expect(env.auth0).toEqual({
			domain: validSource.AUTH0_DOMAIN,
			audience: validSource.AUTH0_AUDIENCE,
			clientId: validSource.AUTH0_CLIENT_ID,
			clientSecret: validSource.AUTH0_CLIENT_SECRET,
			connection: validSource.AUTH0_CONNECTION,
		});
		expect(env.cloudinary).toEqual({
			cloudName: validSource.CLOUDINARY_CLOUD_NAME,
			apiKey: validSource.CLOUDINARY_API_KEY,
			apiSecret: validSource.CLOUDINARY_API_SECRET,
		});
	});

	it("accepts the postgres:// scheme as well as postgresql://", () => {
		const env = loadEnv({ ...validSource, DIRECT_URL: "postgres://db/x" });

		expect(env.directUrl).toBe("postgres://db/x");
	});

	it("rejects an invalid port", () => {
		expect(() => loadEnv({ PORT: "70000" })).toThrow(/Invalid PORT/);
		expect(() => loadEnv({ PORT: "not-a-number" })).toThrow(/Invalid PORT/);
	});

	it("rejects an unknown NODE_ENV", () => {
		expect(() => loadEnv({ NODE_ENV: "staging" })).toThrow(/Invalid NODE_ENV/);
	});
});

describe("production requires the credentials", () => {
	it("throws naming the missing variable", () => {
		expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(
			/Missing required environment variable in production: DATABASE_URL/,
		);
	});

	it("throws for a missing Auth0 variable once the database ones are present", () => {
		expect(() =>
			loadEnv({
				NODE_ENV: "production",
				DATABASE_URL: validSource.DATABASE_URL,
				DIRECT_URL: validSource.DIRECT_URL,
				WEB_ORIGIN: validSource.WEB_ORIGIN,
			}),
		).toThrow(
			/Missing required environment variable in production: AUTH0_DOMAIN/,
		);
	});

	it("throws for a missing WEB_ORIGIN once everything else is present", () => {
		expect(() =>
			loadEnv({
				NODE_ENV: "production",
				DATABASE_URL: validSource.DATABASE_URL,
				DIRECT_URL: validSource.DIRECT_URL,
				AUTH0_DOMAIN: validSource.AUTH0_DOMAIN,
				AUTH0_AUDIENCE: validSource.AUTH0_AUDIENCE,
				AUTH0_CLIENT_ID: validSource.AUTH0_CLIENT_ID,
				AUTH0_CLIENT_SECRET: validSource.AUTH0_CLIENT_SECRET,
				AUTH0_CONNECTION: validSource.AUTH0_CONNECTION,
			}),
		).toThrow(
			/Missing required environment variable in production: WEB_ORIGIN/,
		);
	});

	it("throws for a missing Cloudinary variable once Auth0 and the web origin are present", () => {
		expect(() =>
			loadEnv({
				NODE_ENV: "production",
				DATABASE_URL: validSource.DATABASE_URL,
				DIRECT_URL: validSource.DIRECT_URL,
				WEB_ORIGIN: validSource.WEB_ORIGIN,
				AUTH0_DOMAIN: validSource.AUTH0_DOMAIN,
				AUTH0_AUDIENCE: validSource.AUTH0_AUDIENCE,
				AUTH0_CLIENT_ID: validSource.AUTH0_CLIENT_ID,
				AUTH0_CLIENT_SECRET: validSource.AUTH0_CLIENT_SECRET,
				AUTH0_CONNECTION: validSource.AUTH0_CONNECTION,
			}),
		).toThrow(
			/Missing required environment variable in production: CLOUDINARY_CLOUD_NAME/,
		);
	});

	it("does not throw in test", () => {
		expect(() => loadEnv({ NODE_ENV: "test" })).not.toThrow();
	});

	it("does not throw in development", () => {
		expect(() => loadEnv({ NODE_ENV: "development" })).not.toThrow();
	});

	it("accepts a complete production source", () => {
		const env = loadEnv({ ...validSource, NODE_ENV: "production" });

		expect(env.nodeEnv).toBe("production");
		expect(env.auth0.domain).toBe(validSource.AUTH0_DOMAIN);
	});
});

describe("WEB_ORIGIN must be an http(s) origin", () => {
	it("rejects a value without a scheme", () => {
		expect(() => loadEnv({ WEB_ORIGIN: "localhost:3000" })).toThrow(
			/Invalid WEB_ORIGIN/,
		);
	});

	it("rejects an origin with a path", () => {
		expect(() => loadEnv({ WEB_ORIGIN: "http://localhost:3000/app" })).toThrow(
			/Invalid WEB_ORIGIN/,
		);
	});

	it("accepts an absolute origin", () => {
		const env = loadEnv({ WEB_ORIGIN: "https://app.example.com" });

		expect(env.webOrigin).toBe("https://app.example.com");
	});
});

describe("AUTH0_DOMAIN is a bare hostname", () => {
	it("rejects a value pasted with the scheme", () => {
		expect(() =>
			loadEnv({ AUTH0_DOMAIN: "https://tenant.us.auth0.com" }),
		).toThrow(/Invalid AUTH0_DOMAIN/);
	});

	it("rejects a trailing slash", () => {
		expect(() => loadEnv({ AUTH0_DOMAIN: "tenant.us.auth0.com/" })).toThrow(
			/Invalid AUTH0_DOMAIN/,
		);
	});

	it("rejects a value without a dot", () => {
		expect(() => loadEnv({ AUTH0_DOMAIN: "localhost" })).toThrow(
			/Invalid AUTH0_DOMAIN/,
		);
	});

	it("echoes the offending value, because the domain is not a credential", () => {
		expect(() =>
			loadEnv({ AUTH0_DOMAIN: "https://tenant.us.auth0.com" }),
		).toThrow(/got "https:\/\/tenant\.us\.auth0\.com"/);
	});
});

describe("AUTH0_AUDIENCE is an absolute URL", () => {
	it("rejects a bare identifier", () => {
		expect(() => loadEnv({ AUTH0_AUDIENCE: "inventory-manager-api" })).toThrow(
			/Invalid AUTH0_AUDIENCE/,
		);
	});
});

describe("database URLs must use a postgres scheme", () => {
	it("rejects a mysql URL", () => {
		expect(() =>
			loadEnv({ DATABASE_URL: "mysql://user:pw@host:3306/db" }),
		).toThrow(/Invalid DATABASE_URL/);
	});

	it("rejects a URL without a scheme", () => {
		expect(() =>
			loadEnv({ DIRECT_URL: "db.example.com:5432/postgres" }),
		).toThrow(/Invalid DIRECT_URL/);
	});
});

describe("secrets never reach an error message", () => {
	it("keeps the database password out of the message", () => {
		try {
			loadEnv({ DATABASE_URL: "mysql://user:SUPERSECRETPW@host:3306/db" });
			throw new Error("expected loadEnv to throw");
		} catch (error) {
			expect(String(error)).toMatch(/Invalid DATABASE_URL/);
			expect(String(error)).not.toContain("SUPERSECRETPW");
		}
	});

	it("keeps the direct URL password out of the message", () => {
		try {
			loadEnv({ DIRECT_URL: "mysql://user:SUPERSECRETPW@host:3306/db" });
			throw new Error("expected loadEnv to throw");
		} catch (error) {
			expect(String(error)).toMatch(/Invalid DIRECT_URL/);
			expect(String(error)).not.toContain("SUPERSECRETPW");
		}
	});

	it("names the missing client secret without any value", () => {
		try {
			loadEnv({
				NODE_ENV: "production",
				DATABASE_URL: validSource.DATABASE_URL,
				DIRECT_URL: validSource.DIRECT_URL,
				WEB_ORIGIN: validSource.WEB_ORIGIN,
				AUTH0_DOMAIN: validSource.AUTH0_DOMAIN,
				AUTH0_AUDIENCE: validSource.AUTH0_AUDIENCE,
				AUTH0_CLIENT_ID: validSource.AUTH0_CLIENT_ID,
				AUTH0_CONNECTION: validSource.AUTH0_CONNECTION,
			});
			throw new Error("expected loadEnv to throw");
		} catch (error) {
			expect(String(error)).toMatch(/AUTH0_CLIENT_SECRET/);
		}
	});

	it("names the missing Cloudinary secret without any value", () => {
		try {
			loadEnv({
				NODE_ENV: "production",
				DATABASE_URL: validSource.DATABASE_URL,
				DIRECT_URL: validSource.DIRECT_URL,
				WEB_ORIGIN: validSource.WEB_ORIGIN,
				AUTH0_DOMAIN: validSource.AUTH0_DOMAIN,
				AUTH0_AUDIENCE: validSource.AUTH0_AUDIENCE,
				AUTH0_CLIENT_ID: validSource.AUTH0_CLIENT_ID,
				AUTH0_CLIENT_SECRET: validSource.AUTH0_CLIENT_SECRET,
				AUTH0_CONNECTION: validSource.AUTH0_CONNECTION,
				CLOUDINARY_CLOUD_NAME: validSource.CLOUDINARY_CLOUD_NAME,
				CLOUDINARY_API_KEY: validSource.CLOUDINARY_API_KEY,
			});
			throw new Error("expected loadEnv to throw");
		} catch (error) {
			expect(String(error)).toMatch(/CLOUDINARY_API_SECRET/);
		}
	});
});
