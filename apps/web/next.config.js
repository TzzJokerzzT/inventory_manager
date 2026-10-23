/**
 * API prefixes served by the Express application.
 *
 * They are public paths, not internal ones: the session cookie is scoped to
 * `Path=/auth`, so the browser has to request `/auth/...` for the cookie to
 * travel. The rewrite sends those requests to the catch-all API route, which
 * strips the internal `/api` prefix again before Express sees them.
 */
const API_PREFIXES = [
	"/auth/:path*",
	"/companies/:path*",
	"/me",
	"/health",
	"/docs/:path*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	async rewrites() {
		return API_PREFIXES.map((source) => ({
			source,
			// `/auth/:path*` → `/api/auth/:path*`; the API route strips `/api`.
			destination: `/api${source}`,
		}));
	},
};

export default nextConfig;
