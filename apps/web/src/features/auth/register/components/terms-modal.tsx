"use client";

import { Modal } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_VERSION } from "../utils/terms";

export interface TermsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * The terms and conditions, read before creating an account.
 *
 * It is a reading surface, not a form: no scroll trap, no "accept" button
 * competing with the form's own checkbox. Closing it is the only action, and
 * accepting stays where the decision belongs, next to the submit.
 *
 * The text comes from `utils/terms.ts`, and the version is shown so a person can
 * tell which text they accepted (the file explains why).
 */
export function TermsModal({ open, onOpenChange }: TermsModalProps) {
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="Términos y Condiciones de Uso – App de Gestión de Inventarios"
			description={`Versión ${TERMS_VERSION}`}
			footer={
				<Button
					type="button"
					size="lg"
					variant="primary"
					onClick={() => onOpenChange(false)}
				>
					Entendido
				</Button>
			}
		>
			<p className="text-sm text-text-secondary">{TERMS_INTRO}</p>

			{/* The body scrolls inside the dialog: the modal itself keeps the page
			    put, and a long legal text must not push the window off screen. */}
			<div className="mt-4 flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
				{TERMS_SECTIONS.map((section) => (
					<section key={section.heading}>
						<h3 className="text-sm font-bold text-text-primary">
							{section.heading}
						</h3>
						<p className="mt-1 text-sm text-text-secondary">{section.body}</p>
					</section>
				))}
			</div>
		</Modal>
	);
}
