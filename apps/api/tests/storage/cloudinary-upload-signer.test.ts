import type { MediaUploadSigner } from "../../src/application/ports/media-upload-signer.js";
import { CloudinaryUploadSigner } from "../../src/infrastructure/storage/cloudinary-upload-signer.js";

const CONFIG = {
	cloudName: "demo-cloud",
	apiKey: "123456789012345",
	apiSecret: "SUPERSECRET-API-SECRET",
};

const COMPANY_ID = "11111111-2222-3333-4444-555555555555";
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

function buildSigner(sign: Sign): MediaUploadSigner {
	return new CloudinaryUploadSigner({
		...CONFIG,
		sign,
		now: () => FIXED_TIMESTAMP_MS,
	});
}

describe("CloudinaryUploadSigner", () => {
	it("signs the server-decided parameters and never the caller's inputs", () => {
		const sign = jest.fn<Sign>().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		signer.createUploadSignature({ companyId: COMPANY_ID });

		expect(sign).toHaveBeenCalledTimes(1);
		expect(sign).toHaveBeenCalledWith(
			{
				folder: `companies/${COMPANY_ID}`,
				timestamp: Math.floor(FIXED_TIMESTAMP_MS / 1000),
				allowed_formats: "jpg,png,webp",
			},
			CONFIG.apiSecret,
		);
	});

	it("returns every parameter the browser needs to upload directly", () => {
		const sign = jest.fn<Sign>().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		const result = signer.createUploadSignature({ companyId: COMPANY_ID });

		expect(result).toEqual({
			cloudName: CONFIG.cloudName,
			apiKey: CONFIG.apiKey,
			timestamp: Math.floor(FIXED_TIMESTAMP_MS / 1000),
			signature: "fixed-signature",
			folder: `companies/${COMPANY_ID}`,
			allowedFormats: ["jpg", "png", "webp"],
			maxFileSizeBytes: 5_242_880,
		});
	});

	it("derives the folder from the company id, which is the only caller input", () => {
		const sign = jest.fn<Sign>().mockReturnValue("fixed-signature");
		const signer = buildSigner(sign);

		const result = signer.createUploadSignature({
			companyId: "another-company",
		});

		expect(result.folder).toBe("companies/another-company");
		expect(sign).toHaveBeenCalledWith(
			expect.objectContaining({ folder: "companies/another-company" }),
			CONFIG.apiSecret,
		);
	});

	it("keeps the allowed formats and the size limit server-side constants", () => {
		const signer = buildSigner(
			jest.fn<Sign>().mockReturnValue("fixed-signature"),
		);

		const result = signer.createUploadSignature({ companyId: COMPANY_ID });

		// The method takes only `companyId`: the formats and the size limit are
		// constants owned by the adapter, so a caller can never widen them.
		expect(result.allowedFormats).toEqual(["jpg", "png", "webp"]);
		expect(result.maxFileSizeBytes).toBe(5_242_880);
	});
});
