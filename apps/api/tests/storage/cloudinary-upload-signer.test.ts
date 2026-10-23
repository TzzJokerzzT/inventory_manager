import type { MediaUploadSigner } from "../../src/application/ports/media-upload-signer.js";
import { CloudinaryUploadSigner } from "../../src/infrastructure/storage/cloudinary-upload-signer.js";

const CONFIG = {
	cloudName: "demo-cloud",
	apiKey: "123456789012345",
	apiSecret: "SUPERSECRET-API-SECRET",
};

const COMPANY_ID = "11111111-2222-3333-4444-555555555555";
const COMPANY_NAME = "Acme Café S.A.";
/** Lowercased, accents stripped, non-alphanumerics collapsed to a dash. */
const COMPANY_SLUG = "acme-cafe-s-a";
const WORKSPACE_FOLDER = "inventory-manager/products";
const FIXED_TIMESTAMP_MS = 1_700_000_000_000;

/**
 * The Cloudinary SDK's signing function is injected, so the test suite never
 * imports (or calls) the real account. This fake records what the adapter
 * asked it to sign and returns a fixed signature.
 */
type Sign = (
	paramsToSign: Record<string, unknown>,
	apiSecret: string,
) => string;

/**
 * `@types/jest` declares the sign function's argument tuple as a second type
 * parameter, so the one-argument `jest.fn<Sign>()` from `@jest/globals` is not
 * an accepted overload here. This keeps the mock typed to `Sign`.
 */
function fakeSign() {
	return jest.fn<ReturnType<Sign>, Parameters<Sign>>();
}

function buildSigner(sign: Sign): MediaUploadSigner {
	return new CloudinaryUploadSigner({
		...CONFIG,
		sign,
		now: () => FIXED_TIMESTAMP_MS,
	});
}

function request(
	companyId = COMPANY_ID,
	companyName = COMPANY_NAME,
): { companyId: string; companyName: string } {
	return { companyId, companyName };
}

describe("CloudinaryUploadSigner", () => {
	it("signs the server-decided parameters and never the caller's inputs", () => {
		const sign = fakeSign().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		signer.createUploadSignature(request());

		expect(sign).toHaveBeenCalledTimes(1);
		expect(sign).toHaveBeenCalledWith(
			{
				folder: `${WORKSPACE_FOLDER}/${COMPANY_ID}-${COMPANY_SLUG}`,
				timestamp: Math.floor(FIXED_TIMESTAMP_MS / 1000),
				allowed_formats: "jpg,png,webp",
			},
			CONFIG.apiSecret,
		);
	});

	it("returns every parameter the browser needs to upload directly", () => {
		const sign = fakeSign().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		const result = signer.createUploadSignature(request());

		expect(result).toEqual({
			cloudName: CONFIG.cloudName,
			apiKey: CONFIG.apiKey,
			timestamp: Math.floor(FIXED_TIMESTAMP_MS / 1000),
			signature: "fixed-signature",
			folder: `${WORKSPACE_FOLDER}/${COMPANY_ID}-${COMPANY_SLUG}`,
			allowedFormats: ["jpg", "png", "webp"],
			maxFileSizeBytes: 5_242_880,
		});
	});

	it("gives each company its own subfolder named after its id and its name", () => {
		const sign = fakeSign().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		const first = signer.createUploadSignature(request("company-1", "Acme"));
		const second = signer.createUploadSignature(request("company-2", "Globex"));

		expect(first.folder).toBe(`${WORKSPACE_FOLDER}/company-1-acme`);
		expect(second.folder).toBe(`${WORKSPACE_FOLDER}/company-2-globex`);
	});

	it("sanitizes the company name so it can never add a folder level", () => {
		const sign = fakeSign().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		const result = signer.createUploadSignature(
			request(COMPANY_ID, "../ Otra/Carpeta"),
		);

		// One slash after the workspace folder: the name is a label inside the
		// company folder, never a path the caller can traverse.
		expect(result.folder).toBe(
			`${WORKSPACE_FOLDER}/${COMPANY_ID}-otra-carpeta`,
		);
		expect(result.folder.split("/")).toHaveLength(3);
	});

	it("falls back to a generic label when the name has no usable characters", () => {
		const signer = buildSigner(fakeSign().mockReturnValue("fixed-signature"));

		const result = signer.createUploadSignature(request(COMPANY_ID, "···"));

		expect(result.folder).toBe(`${WORKSPACE_FOLDER}/${COMPANY_ID}-company`);
	});

	it("keeps the allowed formats and the size limit server-side constants", () => {
		const signer = buildSigner(fakeSign().mockReturnValue("fixed-signature"));

		const result = signer.createUploadSignature(request());

		// The only caller inputs are the company ids: the formats and the size
		// limit are constants owned by the adapter, so a caller can never widen
		// them.
		expect(result.allowedFormats).toEqual(["jpg", "png", "webp"]);
		expect(result.maxFileSizeBytes).toBe(5_242_880);
	});

	it("returns a copy of the allowed formats, so a caller cannot widen later signatures", () => {
		const sign = fakeSign().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		const first = signer.createUploadSignature(request());
		// Mutating the returned array must not touch the module constant that
		// every later signature is built from.
		(first.allowedFormats as string[]).push("svg");

		const second = signer.createUploadSignature(request());

		expect(second.allowedFormats).toEqual(["jpg", "png", "webp"]);
		expect(sign).toHaveBeenLastCalledWith(
			expect.objectContaining({ allowed_formats: "jpg,png,webp" }),
			CONFIG.apiSecret,
		);
	});
});
