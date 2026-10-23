"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export interface ModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children?: ReactNode;
	footer?: ReactNode;
	/** Accessible label of the close control; default "Cerrar". */
	closeLabel?: string;
}

/**
 * Controlled, accessible modal built on Base UI `Dialog`.
 *
 * The primitive owns the behaviour that is easy to get wrong: the `role="dialog"`
 * with `aria-labelledby`/`aria-describedby`, the focus trap, closing on Escape
 * and on an outside press, and locking the page scroll while it is open. Only
 * the visuals live here, and they come from the design tokens.
 *
 * It is deliberately controlled (`open` + `onOpenChange`): the caller decides
 * what closing means, which is what lets a confirmation keep its mutation out of
 * the render until the user actually confirms.
 */
export function Modal({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	closeLabel = "Cerrar",
}: ModalProps) {
	return (
		<DialogPrimitive.Root
			open={open}
			onOpenChange={(next) => onOpenChange(next)}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Backdrop
					data-slot="modal-backdrop"
					className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none"
				/>
				<DialogPrimitive.Popup
					data-slot="modal"
					className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-lg transition-[opacity,scale] duration-200 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none"
				>
					<DialogPrimitive.Close
						data-slot="modal-close"
						aria-label={closeLabel}
						className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<X aria-hidden="true" className="size-4" />
					</DialogPrimitive.Close>
					<DialogPrimitive.Title className="pr-10 text-lg font-bold text-text-primary">
						{title}
					</DialogPrimitive.Title>
					{description ? (
						<DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">
							{description}
						</DialogPrimitive.Description>
					) : null}
					{children ? <div className="mt-4">{children}</div> : null}
					{footer ? (
						<div className="mt-6 flex justify-end gap-2">{footer}</div>
					) : null}
				</DialogPrimitive.Popup>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
