"use client";

import { MovementStockForm } from "./movement-stock-form";

/**
 * The entry form (MOV-01): the shared movement form with `type: "IN"`, so the
 * server adds the quantity to the stock in the same transaction.
 */
export function MovementEntryStockForm({
	companyId,
}: {
	companyId: string | undefined;
}) {
	return <MovementStockForm companyId={companyId} type="IN" />;
}
