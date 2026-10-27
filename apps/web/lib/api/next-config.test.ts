import nextConfig from "../../next.config.js";

/** One rewrite rule of the single-origin proxy. */
type RewriteRule = { source: string; destination: string };

/**
 * The configured rules, narrowed to the array form.
 *
 * Next's type allows a `{ beforeFiles, afterFiles, fallback }` object, but this
 * config returns the flat array; failing loudly here keeps the assertions below
 * from silently reading nothing if that ever changes.
 */
async function rewriteRules(): Promise<RewriteRule[]> {
	const rewrites = await nextConfig.rewrites?.();

	if (!Array.isArray(rewrites)) {
		throw new Error("next.config.js must return a flat array of rewrites");
	}

	return rewrites as RewriteRule[];
}

/**
 * Regression pin for the single-origin rewrites used on Vercel.
 *
 * The browser requests the public API paths; Next forwards them to the
 * `pages/api/[...path]` catch-all, which strips the internal `/api` prefix. A
 * source without `:path*` matches only itself, so listing `/me` alone left
 * `/me/invitations` and `/me/invitations/accept` answering Next's own 404
 * instead of reaching the API. That is the deployment-only failure this test
 * exists to prevent.
 */
describe("single-origin API rewrites", () => {
	it("forwards the caller's invitation subpaths to the API", async () => {
		const rules = await rewriteRules();

		expect(rules.map((rule) => rule.source)).toEqual([
			"/auth/:path*",
			"/companies/:path*",
			"/me",
			"/me/:path*",
			"/health",
			"/docs/:path*",
		]);
	});

	it("sends every public prefix to the internal catch-all", async () => {
		const rules = await rewriteRules();

		for (const rule of rules) {
			expect(rule.destination).toBe(`/api${rule.source}`);
		}
	});
});
