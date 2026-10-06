import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const designSystemDir = fileURLToPath(new URL("../", import.meta.url));
const buttonPath = fileURLToPath(
	new URL("../../ui/button.tsx", import.meta.url),
);
const pagePath = fileURLToPath(
	new URL("../../../app/design-system/page.tsx", import.meta.url),
);
const loginPagePath = fileURLToPath(
	new URL("../../../app/login/page.tsx", import.meta.url),
);

const bannedPatterns: Array<{ name: string; pattern: RegExp }> = [
	{ name: "hex colour", pattern: /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i },
	{ name: "rgb()/rgba()", pattern: /rgba?\(/i },
	{ name: "hsl()", pattern: /hsl\(/i },
	{ name: "oklch()", pattern: /oklch\(/i },
];

// Test files are excluded: they legitimately hold the reference hex values and
// the regexes above. Only component source is checked for hardcoded colours.
// `tokens.ts` is data (the single source of truth for the palette's hex) and
// is checked for drift separately in tokens-palette.test.ts.
function collectSourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "__tests__") continue;
			out.push(...collectSourceFiles(full));
		} else if (/\.(ts|tsx)$/.test(entry.name)) {
			if (entry.name === "tokens.ts") continue;
			out.push(full);
		}
	}
	return out;
}

describe("no hardcoded colours in design-system components", () => {
	const violations: string[] = [];

	for (const file of [
		...collectSourceFiles(designSystemDir),
		buttonPath,
		loginPagePath,
	]) {
		const lines = readFileSync(file, "utf-8").split("\n");
		lines.forEach((line, index) => {
			for (const { name, pattern } of bannedPatterns) {
				if (pattern.test(line)) {
					violations.push(`${file}:${index + 1} (${name}): ${line.trim()}`);
				}
			}
		});
	}

	it("uses only token-based colours", () => {
		expect(violations).toEqual([]);
	});
});

describe("no colour styling in the design-system page", () => {
	const source = readFileSync(pagePath, "utf-8");
	const violations: string[] = [];

	// Inline colour styling: a `style={{...}}` block that sets a colour-related
	// property. A hex string rendered as palette text is not an inline style.
	const colourProperty =
		/\b(?:color|background(?:-color)?|border(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|text-decoration-color)\b\s*:/i;
	const styleBlocks = source.matchAll(/style=\{\{[\s\S]*?\}\}/g);
	for (const block of styleBlocks) {
		if (colourProperty.test(block[0])) {
			violations.push(`inline colour style: ${block[0].trim()}`);
		}
	}

	// Arbitrary colour classes like bg-[#4f46e5] or text-[#0f172a].
	const arbitraryColourClass =
		/\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|decoration)-\[#[0-9a-f]/i;
	source.split("\n").forEach((line, index) => {
		if (arbitraryColourClass.test(line)) {
			violations.push(
				`page.tsx:${index + 1} (arbitrary colour class): ${line.trim()}`,
			);
		}
	});

	it("applies colour only through token utilities", () => {
		expect(violations).toEqual([]);
	});
});
