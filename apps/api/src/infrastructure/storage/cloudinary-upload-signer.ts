import type {
	MediaUploadSignature,
	MediaUploadSigner,
} from "../../application/ports/media-upload-signer.js";

/**
 * Formats a product photo may be uploaded as. Decided here, on the server:
 * a caller can never widen this list, because it is part of the signed
 * parameters the browser has to send back verbatim.
 */
const ALLOWED_FORMATS = Object.freeze(["jpg", "png", "webp"] as const);

/**
 * Size ceiling for a direct upload, in bytes (5 MiB). It is not part of the
 * signed parameters, so the server neither signs nor enforces it: it travels
 * in the returned contract for the browser's friendly pre-upload check, and
 * the provider is what actually rejects an oversized upload, according to how
 * the account is configured.
 */
const MAX_FILE_SIZE_BYTES = 5_242_880;

/**
 * The folder every upload of this project lands in. The account already has it
 * provisioned, so it is a constant and never a caller input.
 */
const UPLOAD_ROOT = "inventory-manager/products";

/** Longest company-name slug, so a pathological name cannot bloat the path. */
const COMPANY_SLUG_MAX_LENGTH = 60;

/** Label used when a company name has no usable characters at all. */
const FALLBACK_COMPANY_SLUG = "company";

/**
 * Turns a company name into one safe path segment: lowercased, accents
 * stripped, every run of non-alphanumerics collapsed to a dash.
 *
 * Cloudinary reads `/` as a folder separator, so sanitizing is not cosmetic:
 * without it a company named `A/B` would create a nested folder, and `..` could
 * climb out of the company's folder. The output is always `[a-z0-9-]`, so the
 * folder layout is exactly `<root>/<companyId>-<slug>`.
 */
function companySlug(name: string): string {
	const slug = name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, COMPANY_SLUG_MAX_LENGTH)
		.replace(/-+$/g, "");

	return slug.length > 0 ? slug : FALLBACK_COMPANY_SLUG;
}

/**
 * Signs the server-decided upload parameters. Injected so the adapter stays
 * pure and the test suite can drive it with a fake: the production binding is
 * Cloudinary's `api_sign_request`, and no test ever calls the real account.
 */
export type CloudinarySignFunction = (
	paramsToSign: Record<string, unknown>,
	apiSecret: string,
) => string;

export interface CloudinaryUploadSignerDependencies {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
	sign: CloudinarySignFunction;
	/** Clock, in milliseconds, injected so tests get a deterministic timestamp. */
	now?: () => number;
}

/**
 * Cloudinary-backed adapter for the {@link MediaUploadSigner} port.
 *
 * Configuration is constructor-injected (mirroring the Auth0 adapter): the
 * composition root owns the credentials and the SDK binding, and `env` is never
 * read here. The signed parameters are built from the company id alone —
 * `folder`, the allowed formats and the size limit are server constants, never
 * caller inputs.
 */
export class CloudinaryUploadSigner implements MediaUploadSigner {
	private readonly cloudName: string;
	private readonly apiKey: string;
	private readonly apiSecret: string;
	private readonly sign: CloudinarySignFunction;
	private readonly now: () => number;

	constructor(dependencies: CloudinaryUploadSignerDependencies) {
		this.cloudName = dependencies.cloudName;
		this.apiKey = dependencies.apiKey;
		this.apiSecret = dependencies.apiSecret;
		this.sign = dependencies.sign;
		this.now = dependencies.now ?? (() => Date.now());
	}

	createUploadSignature({
		companyId,
		companyName,
	}: {
		companyId: string;
		companyName: string;
	}): MediaUploadSignature {
		const timestamp = Math.floor(this.now() / 1000);
		// One folder per company, named after its id and its name, nested inside
		// the workspace folder the Cloudinary account already has.
		const folder = `${UPLOAD_ROOT}/${companyId}-${companySlug(companyName)}`;

		// The exact parameters Cloudinary signs: the client has to send these
		// back untouched, and any tampering breaks the signature. `folder` ties
		// the upload to one company; `allowed_formats` pins the formats.
		const paramsToSign = {
			folder,
			timestamp,
			allowed_formats: ALLOWED_FORMATS.join(","),
		};

		const signature = this.sign(paramsToSign, this.apiSecret);

		return {
			cloudName: this.cloudName,
			apiKey: this.apiKey,
			timestamp,
			signature,
			folder,
			allowedFormats: [...ALLOWED_FORMATS],
			maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
		};
	}
}
