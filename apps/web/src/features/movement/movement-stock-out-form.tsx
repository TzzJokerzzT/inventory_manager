"use client";

import { MovementStockForm } from "./movement-stock-form";

/**
 * The exit form (MOV-02): the shared movement form with `type: "OUT"`, so the
 * server subtracts the quantity with the guarded update that refuses to leave the
 * stock below zero (`409 insufficient_stock`).
 */
export function MovementOutStockForm({
	companyId,
}: {
	companyId: string | undefined;
}) {
	return <MovementStockForm companyId={companyId} type="OUT" />;
}
