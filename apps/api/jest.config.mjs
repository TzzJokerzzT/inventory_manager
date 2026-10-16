/**
 * Jest runs the TypeScript sources through `@swc/jest`, which emits CommonJS.
 * The `.js` extension that the sources use for NodeNext resolution has to be
 * stripped so Jest resolves the `.ts` file instead.
 */
export default {
	testEnvironment: "node",
	roots: ["<rootDir>/tests"],
	transform: {
		"^.+\\.(t|j)sx?$": "@swc/jest",
	},
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
};
