"use client";

import { useState } from "react";
import { Alert } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useLeaveCompany } from "../api/use-leave-company";

function leaveErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "last_active_owner") {
			return "No podés salir: sos el último propietario activo de la empresa.";
		}
		return error.message;
	}
	return error ? "No pudimos salir de la empresa. Probá de nuevo." : undefined;
}

/**
 * "Salir de la empresa" for the active company.
 *
 * The button is disabled when the caller is the last active OWNER — the case
 * the server rejects with `last_active_owner` — and the 409 is still rendered
 * if it arrives, so a hypothetical race shows the error instead of failing
 * silently. Leaving is not offered to a caller with no membership.
 */
export function LeaveCompanyAction({
	companyId,
	disabled,
}: {
	companyId: string;
	disabled: boolean;
}) {
	const [confirming, setConfirming] = useState(false);
	const leave = useLeaveCompany(companyId);
	const error = leaveErrorMessage(leave.error);

	return (
		<div className="flex flex-col items-start gap-2">
			{confirming ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm text-text-secondary">
						¿Seguro que querés salir de la empresa?
					</span>
					<Button
						type="button"
						size="sm"
						variant="danger"
						disabled={leave.isPending}
						onClick={() => leave.mutate()}
					>
						Sí, salir
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => setConfirming(false)}
					>
						Cancelar
					</Button>
				</div>
			) : (
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={disabled}
					onClick={() => setConfirming(true)}
				>
					Salir de la empresa
				</Button>
			)}

			{disabled ? (
				<p className="text-xs text-text-muted">
					No podés salir: sos el último propietario activo.
				</p>
			) : null}

			{error ? (
				<Alert variant="danger" title="No pudimos salir de la empresa">
					{error}
				</Alert>
			) : null}
		</div>
	);
}
