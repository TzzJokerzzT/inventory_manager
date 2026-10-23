import { env } from "./config/env.js";
import { createApplication } from "./create-application.js";

/**
 * Process entry: the composition lives in `create-application.ts`, shared with
 * the serverless entry, and this file only owns the socket.
 *
 * Pending migrations are applied before this module runs (`bun run start` runs
 * `prisma migrate deploy` first), so a schema change can never reach a running
 * process as a missing table. A serverless deploy does not execute this file:
 * there the migration step is part of the build (see apps/api/vercel.json).
 */
const app = createApplication();

app.listen(env.port, () => {
	console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
