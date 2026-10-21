"use client";

import { ImageUp } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_PHOTO_TYPES } from "../lib/product-photo";

/**
 * Photo picker with a preview and an explicit removal.
 *
 * A plain file input instead of the drag-and-drop dropzone: the dropzone keeps
 * its own file list, and here the truth is the uploaded URL the product stores.
 * Removing the photo clears that URL, which is how a `PATCH` asks the API to
 * clear `photoUrl` (an explicit `null`).
 */
export function ProductPhotoField({
	photoUrl,
	onFileChange,
	onClear,
	error,
	hint,
	disabled,
}: {
	photoUrl: string | null;
	onFileChange: (file: File) => void;
	onClear: () => void;
	error?: string;
	hint?: string;
	disabled?: boolean;
}) {
	const id = useId();
	const hintId = hint ? `${id}-hint` : undefined;
	const errorId = error ? `${id}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={id} className="text-sm text-text-secondary">
				Foto del producto
			</label>

			<input
				id={id}
				name="photo"
				type="file"
				accept={ACCEPTED_PHOTO_TYPES}
				disabled={disabled}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) {
						onFileChange(file);
					}
				}}
				className="cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
			/>

			{photoUrl ? (
				<div className="flex items-center gap-3">
					{/* biome-ignore lint/performance/noImgElement: la entrega remota es de Cloudinary */}
					<img
						src={photoUrl}
						alt="Vista previa de la foto del producto"
						className="size-20 rounded-md border border-border object-cover"
					/>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						disabled={disabled}
						onClick={onClear}
					>
						Quitar foto
					</Button>
				</div>
			) : (
				<p className="flex items-center gap-2 text-xs text-text-muted">
					<ImageUp aria-hidden="true" className="size-4" />
					JPG, PNG o WebP de hasta 5 MB.
				</p>
			)}

			{hint ? (
				<p id={hintId} className="text-xs text-text-muted">
					{hint}
				</p>
			) : null}
			{error ? (
				<p id={errorId} className="text-xs text-danger-text">
					{error}
				</p>
			) : null}
		</div>
	);
}
