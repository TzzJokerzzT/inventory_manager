import { readFileSync } from "node:fs";
import { join } from "node:path";
import { designTokens } from "../tokens";

const cssPath = join(__dirname, "../../../app/globals.css");
const css = readFileSync(cssPath, "utf-8");

function extractRootBlock(): string {
	const match = css.match(/:root\s*\{([\s\S]*?)\}/);
	if (!match) {
		throw new Error("Could not find the :root block in globals.css");
	}
	return match[1];
}

const rootBlock = extractRootBlock();

describe("designTokens match the globals.css :root custom properties", () => {
	for (const [name, hex] of Object.entries(designTokens)) {
		it(`--${name} resolves to ${hex}`, () => {
			const match = rootBlock.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
			expect(match).toBeTruthy();
			expect(match?.[1].trim().toLowerCase()).toBe(hex.toLowerCase());
		});
	}
});
