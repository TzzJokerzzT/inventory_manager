import { readFileSync } from "node:fs";
import { join } from "node:path";

const cssPath = join(__dirname, "../../../app/globals.css");
const css = readFileSync(cssPath, "utf-8");

// Removes `/* ... */` comments so they cannot hide a declaration or fake a
// selector. globals.css contains no `/*` or `*/` inside string literals.
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

// A token block (like `:root` or `.dark`) declares only CSS custom properties
// (`--*`). It never sets real properties, so it cannot compete with a
// Tailwind utility. Any other top-level block is a style rule.
function isTokenOnlyBlock(body: string): boolean {
	const declarations = body
		.split(";")
		.map((part) => part.trim())
		.filter((part) => part.includes(":"));
	if (declarations.length === 0) return false;
	return declarations.every((part) =>
		part.split(":")[0].trim().startsWith("--"),
	);
}

type Block = { selector: string; body: string };

// Splits the stylesheet into the blocks whose `{` opens at brace depth 0.
// Selector text is the (whitespace-collapsed) text accumulated since the last
// depth-0 `}`, `;`, or `{`, so it works for multi-line selectors too.
function topLevelBlocks(source: string): Block[] {
	const blocks: Block[] = [];
	let depth = 0;
	let buffer = "";
	let current: Block | null = null;
	let bodyStart = 0;

	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		if (char === "{") {
			if (depth === 0) {
				current = { selector: buffer.trim(), body: "" };
				bodyStart = i + 1;
			}
			depth += 1;
			buffer = "";
		} else if (char === "}") {
			depth -= 1;
			if (depth === 0 && current !== null) {
				current.body = source.slice(bodyStart, i);
				blocks.push(current);
				current = null;
			}
			buffer = "";
		} else if (depth === 0) {
			if (char === ";") {
				buffer = "";
			} else {
				buffer += char;
			}
		}
	}
	return blocks;
}

// A non-at-rule selector found anywhere that is NOT lexically inside an
// `@layer` block is a violation: unlayered rules sit outside `@layer`, so they
// override Tailwind's layered utilities (padding/margin/color resets beat
// `p-4`, `px-2.5`, `text-primary`, etc.). At-rule bodies are recursed so an
// unlayered `@media { * { ... } }` is still caught.
function findUnlayeredViolations(
	source: string,
	insideLayer = false,
): string[] {
	const violations: string[] = [];
	for (const { selector, body } of topLevelBlocks(source)) {
		const normalized = selector.replace(/\s+/g, " ").trim();
		if (normalized.startsWith("@")) {
			const isLayer = /^@layer\b/.test(normalized);
			violations.push(...findUnlayeredViolations(body, insideLayer || isLayer));
		} else if (!insideLayer && !isTokenOnlyBlock(body)) {
			violations.push(normalized);
		}
	}
	return violations;
}

const violations = findUnlayeredViolations(stripComments(css));

describe("globals.css cascade layers", () => {
	it("declares no top-level unlayered style rules", () => {
		if (violations.length > 0) {
			throw new Error(
				`Unlayered top-level style rules found in globals.css: ${violations
					.map((selector) => `"${selector}"`)
					.join(
						", ",
					)}. Unlayered rules beat Tailwind's layered utilities, so these ` +
					"selectors override padding/margin/color utilities. Wrap them in @layer base.",
			);
		}
		expect(violations).toEqual([]);
	});
});

describe("unlayered selectors inside at-rules", () => {
	it("flags a style rule nested in an unlayered @media", () => {
		const found = findUnlayeredViolations(
			"@media (max-width: 600px) { * { padding: 0; } }",
		);
		expect(found).toContain("*");
	});
});
