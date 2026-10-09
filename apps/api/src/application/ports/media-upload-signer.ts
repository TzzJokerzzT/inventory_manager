/**
 * The parameters a browser needs to upload a file directly to the storage
 * provider, without the bytes ever travelling through the API
 * (`docs/stack.md` §5.2: a server-side upload would hit the serverless
 * payload ceiling and the ephemeral filesystem).
 *
 * The signature authorizes exactly one upload into one server-decided folder,
 * so the endpoint that produces it is a write permission, not a free-for-all.
 *
 * It lives under `application/ports` (like the identity provider) and not under
 * `domain/repositories` because the domain has no concept of a storage
 * provider: only the media flow needs these parameters, and the concrete
 * Cloudinary adapter lives in `infrastructure/storage/`.
 */
export interface MediaUploadSignature {
	/** Account identifier the browser uses to build the upload endpoint URL. */
	cloudName: string;
	/** Public API key, sent verbatim by the browser. It is not a secret. */
	apiKey: string;
	/** Unix timestamp in seconds, part of the signed parameters. */
	timestamp: number;
	/** Signature over the server-decided parameters. */
	signature: string;
	/** Server-decided folder the upload lands in. */
	folder: string;
	/** Formats the server allows; the browser must not widen them. */
	allowedFormats: readonly string[];
	/**
	 * Size limit in bytes, part of the contract the client must honour: the
	 * server does not enforce it; the provider rejects an oversized upload by
	 * account configuration.
	 */
	maxFileSizeBytes: number;
}

/**
 * Produces the parameters the browser needs for a direct upload.
 *
 * The only caller input is the company the upload belongs to; every other
 * parameter (folder layout, allowed formats, size limit) is decided by the
 * adapter. Signing "whatever the caller asks for" would turn the endpoint into
 * a proxy for arbitrary uploads.
 */
export interface MediaUploadSigner {
	createUploadSignature(request: { companyId: string }): MediaUploadSignature;
}
