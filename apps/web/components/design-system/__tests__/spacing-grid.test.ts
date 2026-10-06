import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const designSystemDir = fileURLToPath(new URL("../", import.meta.url));

/*
 * Deliberate exceptions to the 4px spacing grid (see alert.tsx):
 * - `w-[3px]` — the design mandates a 3px accent bar. It is an arbitrary
 *   width, not a spacing utility, so the scanner below does not match it; it
 *   is listed here only so the exception stays documented.
 * - `mt-0.5`  — 2px optical nudge that aligns the icon with the first text
 *   line. This IS a fractional spacing utility and is allowlisted here.
 */
const allowed: Record<string, string[]> = {
	"alert.tsx": ["mt-0.5"],
};

/*
 * Spacing utilities whose numeric step must stay on the 4px grid. Integer
 * steps are always multiples of 4; only fractional steps (e.g. 2.5 = 10px)
 * break the grid, so only those are reported. Longest names come first so the
 * alternation cannot match `p` as the prefix of `px`.
 */
const spacingUtilities = [
	"space-x",
	"space-y",
	"gap-x",
	"gap-y",
	"px",
	"py",
	"pt",
	"pr",
	"pb",
	"pl",
	"mx",
	"my",
	"mt",
	"mr",
	"mb",
	"ml",
	"gap",
	"p",
	"m",
];

const fractionalSpacing = new RegExp(
	`\\b(${spacingUtilities.join("|")})-(\\d*\\.\\d+)`,
	"g",
);

function componentFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "__tests__") continue;
			out.push(...componentFiles(full));
		} else if (/\.(ts|tsx)$/.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

type Violation = { file: string; line: number; utility: string; px: number };

function fractionalSpacingViolations(files: string[]): Violation[] {
	const violations: Violation[] = [];
	for (const file of files) {
		const name = basename(file);
		const whitelist = allowed[name] ?? [];
		const lines = readFileSync(file, "utf-8").split("\n");
		lines.forEach((line, index) => {
			for (const match of line.matchAll(fractionalSpacing)) {
				const utility = `${match[1]}-${match[2]}`;
				if (whitelist.includes(utility)) continue;
				violations.push({
					file: name,
					line: index + 1,
					utility,
					px: Number.parseFloat(match[2]) * 4,
				});
			}
		});
	}
	return violations;
}

const violations = fractionalSpacingViolations(componentFiles(designSystemDir));

describe("design-system spacing stays on the 4px grid", () => {
	it("uses no fractional spacing utilities", () => {
		if (violations.length > 0) {
			const details = violations
				.map((v) => `${v.file}:${v.line} ${v.utility} (${v.px}px)`)
				.join("\n");
			throw new Error(
				`Fractional spacing utilities break the 4px grid:\n${details}`,
			);
		}
		expect(violations).toEqual([]);
	});
});
