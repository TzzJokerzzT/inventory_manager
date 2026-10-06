import nextJest from "next/jest.js";

/**
 * `next/jest` supplies the SWC transform, the CSS handling and the path aliases
 * from `tsconfig.json`. The tests render components with
 * `@testing-library/react`, so they need a DOM.
 */
const createJestConfig = nextJest({ dir: "./" });

export default createJestConfig({
	testEnvironment: "jsdom",
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
	},
});
