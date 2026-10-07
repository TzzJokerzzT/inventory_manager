import { rateLimit } from "express-rate-limit";

/**
 * Global rate limiter.
 *
 * TODO(serverless): the default store keeps counters in memory, so on Vercel
 * each function instance has its own counter and the effective limit becomes
 * "limit x instances". Replace it with a shared store (Vercel KV / Upstash
 * Redis) before relying on it in production. See docs/stack.md §5.2.
 */
export const apiRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
});

/**
 * Attempts allowed against `POST /auth/login` per window. Credential stuffing
 * is exactly the abuse the dedicated limiter has to blunt, so it is far
 * stricter than the global limiter.
 */
export const AUTH_LOGIN_RATE_LIMIT = 5;

/**
 * Dedicated, stricter limiter for the credential-exchange endpoint.
 *
 * The shared store is MI-55: today this counter is in memory, so in a
 * serverless runtime it does not limit globally — each function instance has
 * its own counter. The stricter limit is still applied per instance, but the
 * real anti-abuse guarantee arrives with the shared store.
 */
export function createAuthLoginRateLimiter() {
	return rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: AUTH_LOGIN_RATE_LIMIT,
	});
}

/**
 * Attempts allowed against `POST /auth/register` per window. Registration is
 * open, so the endpoint needs the same dedicated, stricter family as login:
 * a bot can otherwise burn quota creating accounts. The limit is intentionally
 * independent from the login counter, so flooding one endpoint does not lock
 * out the other.
 */
export const AUTH_REGISTER_RATE_LIMIT = 5;

/**
 * Dedicated limiter for the registration endpoint, mirroring the login
 * limiter (same window, same strictness, separate counter).
 */
export function createAuthRegisterRateLimiter() {
	return rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: AUTH_REGISTER_RATE_LIMIT,
	});
}
