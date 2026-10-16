import { defineConfig } from "cypress";

/**
 * The end-to-end suite drives the running application, so it needs the dev
 * server up. `bun run dev` in `apps/web` before `bun run test:e2e`.
 */
export default defineConfig({
	e2e: {
		baseUrl: "http://localhost:3000",
		supportFile: false,
		video: false,
		// Capturing on failure hangs in this environment and hides the real
		// assertion error behind a 30s screenshot timeout.
		screenshotOnRunFailure: false,
		// The login layout splits into two columns from `lg` up; the default
		// Cypress viewport is narrower, which hides the brand panel.
		viewportWidth: 1440,
		viewportHeight: 900,
	},
});
