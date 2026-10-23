"use client";

import { useMutation } from "@tanstack/react-query";
import { ApiError, getApiClient } from "@/lib/api/client";
import {
	type MediaUploadSignature,
	parseMediaUploadSignature,
} from "@/lib/api/schemas";
import { getAccessToken } from "@/src/features/auth/api/get-access-token";
import { formatMegabytes, matchesAllowedFormat } from "../lib/product-photo";

/** Cloudinary's direct-upload endpoint; the cloud name is signed by our API. */
const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";

const UPLOAD_FAILED = "No pudimos subir la foto. Probá de nuevo.";
const UNEXPECTED_RESPONSE =
	"El servidor devolvió una respuesta inesperada. Probá de nuevo.";

/**
 * Validates the file against the limits **the server signed**, not against the
 * client's own copies: if the signature allows fewer formats or a smaller file,
 * the browser refuses before spending a request the storage would reject.
 */
function fileError(
	file: File,
	signature: MediaUploadSignature,
): ApiError | undefined {
	if (!matchesAllowedFormat(file, signature.allowedFormats)) {
		return new ApiError(
			`La foto debe ser ${signature.allowedFormats.join(", ")}.`,
		);
	}
	if (file.size > signature.maxFileSizeBytes) {
		return new ApiError(
			`La foto no puede superar los ${formatMegabytes(signature.maxFileSizeBytes)}.`,
		);
	}
	return undefined;
}

/**
 * Reads the delivery URL the storage answers, accepting only `http`/`https`.
 *
 * Anything else — a missing field, a number, or a `javascript:` URL — is a shape
 * the app cannot render as an image, so it fails as a data error instead of
 * being stored in `photoUrl`.
 */
function readSecureUrl(payload: unknown): string | undefined {
	if (typeof payload !== "object" || payload === null) {
		return undefined;
	}
	const secureUrl = (payload as { secure_url?: unknown }).secure_url;
	if (typeof secureUrl !== "string" || !/^https?:\/\//i.test(secureUrl)) {
		return undefined;
	}
	return secureUrl;
}

/**
 * Uploads a product photo directly to Cloudinary and returns its delivery URL.
 *
 * Two steps, in this order: the API signs the upload contract for the company
 * (folder, formats, size limit, signature), then the file travels straight to
 * the storage provider — never through our API — and only the resulting
 * `secure_url` is saved on the product. The optimization is Cloudinary's
 * delivery, not a step of our own.
 *
 * `fetchImpl` is injectable so tests never reach the network; app code keeps the
 * default, which is read at call time rather than baked in at import time.
 */
export function useUploadProductPhoto(
	companyId: string | undefined,
	fetchImpl: typeof globalThis.fetch = globalThis.fetch,
) {
	return useMutation<string, unknown, File>({
		mutationFn: async (file) => {
			if (!companyId) {
				throw new Error("No active company");
			}

			const signatureResponse = await getApiClient({
				getAccessToken,
			}).post(`/companies/${companyId}/media/signature`);
			const signature = parseMediaUploadSignature(signatureResponse.data);

			const invalid = fileError(file, signature);
			if (invalid) {
				throw invalid;
			}

			const body = new FormData();
			body.append("file", file);
			body.append("api_key", signature.apiKey);
			body.append("timestamp", String(signature.timestamp));
			body.append("signature", signature.signature);
			body.append("folder", signature.folder);
			body.append("allowed_formats", signature.allowedFormats.join(","));

			const uploadResponse = await fetchImpl(
				`${CLOUDINARY_UPLOAD_URL}/${signature.cloudName}/image/upload`,
				{ method: "POST", body },
			);
			if (!uploadResponse.ok) {
				throw new ApiError(UPLOAD_FAILED);
			}

			let payload: unknown;
			try {
				payload = await uploadResponse.json();
			} catch {
				throw new ApiError(UNEXPECTED_RESPONSE);
			}

			const secureUrl = readSecureUrl(payload);
			if (!secureUrl) {
				throw new ApiError(UNEXPECTED_RESPONSE);
			}

			return secureUrl;
		},
	});
}
