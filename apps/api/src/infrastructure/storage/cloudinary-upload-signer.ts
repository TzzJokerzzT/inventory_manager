import type {
	MediaUploadSignature,
	MediaUploadSigner,
} from "../../application/ports/media-upload-signer.js";

/**
 * Formats a product photo may be uploaded as. Decided here, on the server:
 * a caller can never widen this list, because it is part of the signed
 * parameters the browser has to send back verbatim.
 */
const ALLOWED_FORMATS = ["jpg", "png", "webp"] as const;

/**
 * Size ceiling for a direct upload, in bytes (5 MiB). Enforced as a signed
 * contract and reported to the browser for a friendly pre-upload check; the
 * real rejection happens at the provider.
 */
const MAX_FILE_SIZE_BYTES = 5_242_880;

/** Root folder every company's uploads are nested under. */
const FOLDER_ROOT = "companies";

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
	}: {
		companyId: string;
	}): MediaUploadSignature {
		const timestamp = Math.floor(this.now() / 1000);
		const folder = `${FOLDER_ROOT}/${companyId}`;

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
			allowedFormats: ALLOWED_FORMATS,
			maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
		};
	}
}
