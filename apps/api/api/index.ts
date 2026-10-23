import { createApplication } from "../src/create-application";

/**
 * Vercel function entry for the API.
 *
 * The platform owns the socket, so this module exports the Express app instead
 * of listening on a port; `vercel.json` routes every path to it, which is what
 * keeps the session cookies on their `/auth` path.
 *
 * The import has no `.js` suffix on purpose. This package compiles with
 * NodeNext, which demands the suffix, but the bundler Vercel uses for functions
 * resolves the TypeScript file from the bare specifier and cannot follow a
 * `.js` one. That is also why this file is not part of `tsconfig.check.json`:
 * `tsc` would reject the import the bundler needs. Its whole contract is "export
 * the app", and a mistake here fails the deploy, not a request.
 */
export default createApplication();
