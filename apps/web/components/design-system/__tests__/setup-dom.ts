import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Makes `document`, `window` and the rest of the DOM available to every test
// file, which is what `@testing-library/react` needs to render components.
GlobalRegistrator.register();

// Import `@testing-library/react` only after the DOM globals exist so its
// `screen` helper binds to a real `document.body`, then register cleanup
// manually: Bun does not run `@testing-library/react`'s auto-cleanup.
const { cleanup } = await import("@testing-library/react");
afterEach(cleanup);
