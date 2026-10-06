import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cssPath = fileURLToPath(
	new URL("../../../app/globals.css", import.meta.url),
);
const css = readFileSync(cssPath, "utf-8");

function extractBlock(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
	if (!match) {
		throw new Error(`Could not find the "${selector}" block in globals.css`);
	}
	return match[1];
}

function tokenValue(block: string, name: string): string | null {
	const match = block.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
	return match ? match[1].trim() : null;
}

function requireToken(block: string, name: string): string {
	const value = tokenValue(block, name);
	if (!value) {
		throw new Error(`Token --${name} is not declared in the expected block`);
	}
	return value;
}

function hexToRgb(hex: string): [number, number, number] {
	const value = hex.replace("#", "");
	const full =
		value.length === 3
			? value
					.split("")
					.map((char) => char + char)
					.join("")
			: value;
	return [
		Number.parseInt(full.slice(0, 2), 16),
		Number.parseInt(full.slice(2, 4), 16),
		Number.parseInt(full.slice(4, 6), 16),
	];
}

function relativeLuminance(hex: string): number {
	const [r8, g8, b8] = hexToRgb(hex);
	const channels = [r8, g8, b8].map((channel) => {
		const s = channel / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const lighter = Math.max(la, lb);
	const darker = Math.min(la, lb);
	return (lighter + 0.05) / (darker + 0.05);
}

const light = extractBlock(":root");
const dark = extractBlock(".dark");

const requiredTokens = [
	"success-text",
	"warning-text",
	"danger-text",
	"info-text",
	"text-muted",
];

describe("AA semantic text tokens", () => {
	for (const token of requiredTokens) {
		it(`declares --${token} in both :root and .dark`, () => {
			expect(tokenValue(light, token)).toBeTruthy();
			expect(tokenValue(dark, token)).toBeTruthy();
		});
	}
});

const contrastPairs = [
	{
		text: "success-text",
		background: "success-soft",
		label: "success-text on success-soft",
	},
	{
		text: "warning-text",
		background: "warning-soft",
		label: "warning-text on warning-soft",
	},
	{
		text: "danger-text",
		background: "danger-soft",
		label: "danger-text on danger-soft",
	},
	{
		text: "info-text",
		background: "info-soft",
		label: "info-text on info-soft",
	},
	{
		text: "text-secondary",
		background: "surface-muted",
		label: "text-secondary on surface-muted (discontinued badge)",
	},
	{ text: "text-muted", background: "surface", label: "text-muted on surface" },
	{
		text: "text-muted",
		background: "surface-muted",
		label: "text-muted on surface-muted",
	},
	{ text: "text-muted", background: "background", label: "text-muted on bg" },
	{
		text: "primary-foreground",
		background: "primary",
		label: "primary-foreground on primary",
	},
	{
		text: "destructive-foreground",
		background: "destructive",
		label: "destructive-foreground on destructive",
	},
	{ text: "link", background: "background", label: "link on bg" },
	{
		text: "accent-foreground",
		background: "accent",
		label: "accent-foreground on accent",
	},
];

function contrastRatioFor(
	block: string,
	pair: (typeof contrastPairs)[number],
): number {
	const text = requireToken(block, pair.text);
	const background = requireToken(block, pair.background);
	return contrastRatio(text, background);
}

function describeContrastFor(mode: string, block: string) {
	describe(`WCAG AA contrast (${mode})`, () => {
		for (const pair of contrastPairs) {
			it(`${pair.label} is >= 4.5:1`, () => {
				expect(contrastRatioFor(block, pair)).toBeGreaterThanOrEqual(4.5);
			});
		}
	});
}

describeContrastFor("light mode", light);
describeContrastFor("dark mode", dark);
