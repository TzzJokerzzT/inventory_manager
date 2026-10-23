import { createApplication } from "api";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * The Express application, built once per server instance.
 *
 * It comes from the sibling workspace package, so the API keeps its own code,
 * its own tests and its own composition; this file only hands it the raw
 * request and lets it own the response.
 */
const app = createApplication();

/** Prefix Next adds to reach this catch-all; Express routes are declared without it. */
const INTERNAL_PREFIX = "/api";

/**
 * Single-origin entry for the API.
 *
 * Why a Pages API route and not an App Router handler: `app(req, res)` expects
 * Node's `IncomingMessage`/`ServerResponse`, which is exactly what the Pages
 * Router still provides. An App Router handler would receive a Web `Request`
 * and we would need a shim to translate it — more code, more surface, no gain.
 *
 * The rewrite in `next.config.js` maps the public prefixes (`/auth/*`,
 * `/companies/*`, `/me`, `/health`, `/docs/*`) onto `/api/*`, so the browser
 * keeps requesting the paths the session cookies are scoped to. The prefix is
 * stripped here because the Express routes are declared as `/auth/login` and
 * friends, exactly as they are when the API runs on its own.
 */
export default function handler(
	request: NextApiRequest,
	response: NextApiResponse,
): void {
	request.url = stripInternalPrefix(request.url);

	// Express owns the response (status, headers, cookies, body).
	app(request, response);
}

function stripInternalPrefix(url: string | undefined): string {
	if (url === undefined) {
		return "/";
	}

	if (!url.startsWith(INTERNAL_PREFIX)) {
		return url;
	}

	const stripped = url.slice(INTERNAL_PREFIX.length);

	// `/api` alone must not turn into an empty URL.
	return stripped.length === 0 ? "/" : stripped;
}

/**
 * Next must not parse the body: `express.json()` reads the stream itself, and a
 * request whose body was already consumed hangs the API instead of answering.
 */
export const config = {
	api: {
		bodyParser: false,
	},
};
