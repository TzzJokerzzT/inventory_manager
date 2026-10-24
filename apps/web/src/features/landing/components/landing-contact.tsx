import { Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The address a person writes to.
 *
 * It is the real mailbox of the person who runs the product, not a form that
 * posts nowhere: there is no contact backend, so a `mailto:` link is the honest
 * implementation — it opens the mail client the visitor already has, and the
 * message reaches a human.
 */
export const CONTACT_EMAIL = "alexjesus-4856@hotmail.com";

/**
 * The contact area, at the end of the landing before the footer.
 *
 * Kept server-rendered like the rest of the page: no form, no client bundle, no
 * spinner. The email is also shown as plain text, not hidden behind the button,
 * so it can be copied or read on a device without a mail client.
 */
export function LandingContact() {
	return (
		<section id="contacto" className="pb-16 lg:pb-20">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="grid gap-8 rounded-3xl border border-border bg-surface-muted p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-12">
					<div className="min-w-0">
						<h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
							¿Hablamos?
						</h2>
						<p className="mt-3 max-w-xl text-base text-text-secondary">
							Dudas, sugerencias o algo que no funciona como esperabas:
							escribime y te contesto yo.
						</p>
						{/*
						 * The address is selectable text, not only a link: on a phone
						 * without a configured mail app the button does nothing, and the
						 * person still needs to be able to read or copy it.
						 */}
						<p className="mt-4 text-sm text-text-secondary">
							<span className="font-medium text-text-primary">Correo: </span>
							<a
								href={`mailto:${CONTACT_EMAIL}`}
								className="break-all underline underline-offset-4 hover:text-text-primary"
							>
								{CONTACT_EMAIL}
							</a>
						</p>
					</div>

					<a
						href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Inventory Manager")}`}
						className={cn(
							buttonVariants({ size: "lg" }),
							"h-12 w-full justify-center sm:w-auto",
						)}
					>
						<Mail aria-hidden="true" className="mr-2 size-5" />
						Escribime
					</a>
				</div>
			</div>
		</section>
	);
}
