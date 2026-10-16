"use client";

import { cn } from "cn";
import { File as FileIcon, UploadCloud, X } from "lucide-react";
import {
	type ChangeEvent,
	type ComponentProps,
	type DragEvent,
	useId,
	useRef,
	useState,
} from "react";

type DropzoneFieldProps = Omit<
	ComponentProps<"input">,
	"type" | "value" | "defaultValue" | "onChange"
> & {
	label?: string;
	hint?: string;
	error?: string;
	/** Tamaño máximo por archivo en bytes */
	maxSize?: number;
	onFilesChange?: (files: File[]) => void;
};

function matchesAccept(file: File, accept?: string) {
	if (!accept) return true;
	const tokens = accept
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean);
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();

	return tokens.some((token) => {
		if (token.startsWith(".")) return name.endsWith(token);
		if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
		return type === token;
	});
}

function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropzoneField({
	label,
	hint,
	error,
	maxSize,
	onFilesChange,
	id,
	name,
	accept,
	multiple,
	disabled,
	className,
	...props
}: DropzoneFieldProps) {
	const autoId = useId();
	const controlId = id ?? name ?? autoId;
	const hintId = hint ? `${controlId}-hint` : undefined;
	const inputRef = useRef<HTMLInputElement>(null);

	const [files, setFiles] = useState<File[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const [rejection, setRejection] = useState<string>();

	const visibleError = error ?? rejection;
	const errorId = visibleError ? `${controlId}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

	function applyFiles(next: File[]) {
		// Sincroniza el input nativo para que funcione con <form> y FormData
		if (inputRef.current) {
			const transfer = new DataTransfer();
			for (const file of next) transfer.items.add(file);
			inputRef.current.files = transfer.files;
		}
		setFiles(next);
		onFilesChange?.(next);
	}

	function handleFiles(incoming: File[]) {
		if (incoming.length === 0) return;

		const accepted: File[] = [];
		let rejected = 0;

		for (const file of incoming) {
			const validType = matchesAccept(file, accept);
			const validSize = maxSize === undefined || file.size <= maxSize;
			if (validType && validSize) accepted.push(file);
			else rejected += 1;
		}

		setRejection(
			rejected > 0
				? `${rejected} archivo(s) rechazado(s)${
						maxSize ? ` (máximo ${formatSize(maxSize)})` : ""
					}`
				: undefined,
		);

		if (accepted.length === 0) return;
		applyFiles(multiple ? [...files, ...accepted] : accepted.slice(0, 1));
	}

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		handleFiles(Array.from(event.target.files ?? []));
	}

	function handleDragOver(event: DragEvent<HTMLLabelElement>) {
		if (disabled) return;
		event.preventDefault();
		setIsDragging(true);
	}

	function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
		if (event.currentTarget.contains(event.relatedTarget as Node | null))
			return;
		setIsDragging(false);
	}

	function handleDrop(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		setIsDragging(false);
		if (disabled) return;
		handleFiles(Array.from(event.dataTransfer.files));
	}

	function removeFile(index: number) {
		setRejection(undefined);
		applyFiles(files.filter((_, i) => i !== index));
	}

	return (
		<div
			data-slot="dropzone-field"
			className={cn("flex flex-col gap-2", className)}
		>
			{label ? (
				<label htmlFor={controlId} className="text-sm text-text-secondary">
					{label}
				</label>
			) : null}
			<div className="relative">
				<input
					ref={inputRef}
					id={controlId}
					name={name}
					type="file"
					accept={accept}
					multiple={multiple}
					disabled={disabled}
					aria-invalid={visibleError ? true : undefined}
					aria-describedby={describedBy}
					onChange={handleChange}
					className="peer sr-only"
					{...props}
				/>
				<label
					htmlFor={controlId}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					data-dragging={isDragging || undefined}
					className={cn(
						"flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center transition-colors",
						"hover:border-primary peer-focus-visible:border-primary peer-focus-visible:ring-1 peer-focus-visible:ring-primary",
						"data-[dragging]:border-primary data-[dragging]:bg-primary/5",
						"peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
						visibleError &&
							"border-danger hover:border-danger peer-focus-visible:border-danger peer-focus-visible:ring-danger",
					)}
				>
					<UploadCloud aria-hidden="true" className="size-8 text-text-muted" />
					<span className="text-base text-text-primary">
						Arrastra tus archivos aquí o{" "}
						<span className="text-primary underline">selecciónalos</span>
					</span>
					{accept || maxSize ? (
						<span className="text-xs text-text-muted">
							{[accept, maxSize ? `Máx. ${formatSize(maxSize)}` : null]
								.filter(Boolean)
								.join(" · ")}
						</span>
					) : null}
				</label>
			</div>
			{files.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{files.map((file, index) => (
						<li
							key={`${file.name}-${file.lastModified}`}
							className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
						>
							<FileIcon
								aria-hidden="true"
								className="size-5 shrink-0 text-text-muted"
							/>
							<span className="min-w-0 flex-1 truncate text-sm text-text-primary">
								{file.name}
							</span>
							<span className="shrink-0 text-xs text-text-muted">
								{formatSize(file.size)}
							</span>
							<button
								type="button"
								disabled={disabled}
								onClick={() => removeFile(index)}
								aria-label={`Quitar ${file.name}`}
								className="rounded-md p-1 text-text-muted hover:text-text-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50"
							>
								<X aria-hidden="true" className="size-4" />
							</button>
						</li>
					))}
				</ul>
			) : null}
			{hint ? (
				<p id={hintId} className="text-xs text-text-muted">
					{hint}
				</p>
			) : null}
			{visibleError ? (
				<p id={errorId} className="text-xs text-danger-text">
					{visibleError}
				</p>
			) : null}
		</div>
	);
}
