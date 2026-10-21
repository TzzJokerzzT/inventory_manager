import {
	ALLOWED_PHOTO_FORMATS,
	formatMegabytes,
	MAX_PHOTO_BYTES,
	matchesAllowedFormat,
} from "../product-photo";

function image(name: string, type: string, size = 1024) {
	const file = new File([new Uint8Array(size)], name, { type });
	return file;
}

describe("matchesAllowedFormat", () => {
	it("accepts a JPEG by extension", () => {
		expect(
			matchesAllowedFormat(image("foto.jpg", "image/jpeg"), [
				"jpg",
				"png",
				"webp",
			]),
		).toBe(true);
	});

	it("accepts a .jpeg name by its MIME type", () => {
		expect(
			matchesAllowedFormat(image("foto.jpeg", "image/jpeg"), [
				"jpg",
				"png",
				"webp",
			]),
		).toBe(true);
	});

	it("accepts a PNG and a WebP", () => {
		expect(matchesAllowedFormat(image("foto.png", "image/png"), ["png"])).toBe(
			true,
		);
		expect(
			matchesAllowedFormat(image("foto.webp", "image/webp"), ["webp"]),
		).toBe(true);
	});

	it("rejects a format the signature does not allow", () => {
		expect(
			matchesAllowedFormat(image("foto.gif", "image/gif"), [
				"jpg",
				"png",
				"webp",
			]),
		).toBe(false);
	});

	it("rejects a non-image file", () => {
		expect(
			matchesAllowedFormat(image("contrato.pdf", "application/pdf"), [
				"jpg",
				"png",
				"webp",
			]),
		).toBe(false);
	});

	it("does not invent a rule when the signature lists no formats", () => {
		expect(matchesAllowedFormat(image("foto.bmp", "image/bmp"), [])).toBe(true);
	});
});

describe("formatMegabytes", () => {
	it("renders a whole number of megabytes without decimals", () => {
		expect(formatMegabytes(5 * 1024 * 1024)).toBe("5 MB");
	});

	it("keeps one decimal for a fractional limit", () => {
		expect(formatMegabytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
	});
});

describe("photo limits", () => {
	it("mirrors the signature the API promises", () => {
		expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024);
		expect(ALLOWED_PHOTO_FORMATS).toEqual(["jpg", "png", "webp"]);
	});
});
