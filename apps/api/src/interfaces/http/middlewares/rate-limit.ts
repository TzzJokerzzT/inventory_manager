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
