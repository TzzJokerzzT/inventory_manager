/**
 * The photo rules the API signs into every upload.
 *
 * The form uses them before asking for a signature (so the first feedback comes
 * without a round-trip) and the upload hook uses the signature's own values
 * before sending a byte, so a server-side change of limits moves the client too.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Formats the product form offers and validates locally. */
export const ALLOWED_PHOTO_FORMATS = ["jpg", "png", "webp"] as const;

/** `accept` for the file input, in MIME terms. */
export const ACCEPTED_PHOTO_TYPES = "image/jpeg,image/png,image/webp";

/**
 * MIME types accepted for each signed format. Browsers disagree on the name and
 * the type of the same image (`foto.jpeg` arrives as `image/jpeg`), so a file
 * matches if either its extension or its MIME type is allowed.
 */
const MIME_BY_FORMAT: Record<string, string[]> = {
	jpg: ["image/jpeg", "image/jpg"],
	jpeg: ["image/jpeg", "image/jpg"],
	png: ["image/png"],
	webp: ["image/webp"],
};

export function fileExtension(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Whether a file fits the formats the signature allows.
 *
 * An empty `allowedFormats` is treated as "no format rule": the signature is
 * the authority, and inventing a restriction it did not sign would reject
 * uploads the server would have accepted.
 */
export function matchesAllowedFormat(
	file: File,
	allowedFormats: readonly string[],
): boolean {
	const allowed = allowedFormats
		.map((format) => format.trim().toLowerCase())
		.filter(Boolean);

	if (allowed.length === 0) {
		return true;
	}

	if (allowed.includes(fileExtension(file.name))) {
		return true;
	}

	const mimeTypes = allowed.flatMap((format) => MIME_BY_FORMAT[format] ?? []);
	return mimeTypes.includes(file.type.toLowerCase());
}

/** `5242880` → `"5 MB"`, `1572864` → `"1.5 MB"`. */
export function formatMegabytes(bytes: number): string {
	const megabytes = bytes / (1024 * 1024);
	return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}
