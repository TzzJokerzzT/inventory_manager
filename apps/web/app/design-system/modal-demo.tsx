"use client";

import { useState } from "react";
import { Modal } from "@/components/design-system";
import { Button } from "@/components/ui/button";

/**
 * Live demo for the Modal section of the design-system page.
 *
 * The page is a server component, so the `open` state of a controlled modal
 * needs its own client boundary. The footer closes the modal because a demo has
 * nothing to confirm — the real confirmation is in `ProductRowActions`.
 */
export function ModalDemo() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				type="button"
				size="ds"
				variant="secondary"
				onClick={() => setOpen(true)}
			>
				Abrir modal de confirmación
			</Button>
			<Modal
				open={open}
				onOpenChange={setOpen}
				title="Eliminar producto"
				description="Cable HDMI 2.1 · 3 m se quitará del catálogo. El producto no se borra de forma definitiva."
				footer={
					<>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => setOpen(false)}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							size="sm"
							variant="danger"
							onClick={() => setOpen(false)}
						>
							Eliminar
						</Button>
					</>
				}
			>
				<p className="text-sm text-text-secondary">
					Atrapa el foco, cierra con Escape, con el botón de cerrar o con un
					clic en el fondo, y bloquea el scroll de la página.
				</p>
			</Modal>
		</>
	);
}
