"use client";

import { type FormEvent, useRef, useState } from "react";
import { Alert, TextareaField, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import type { Customer } from "@/lib/api/schemas";
import { useActiveCompany } from "../../company/store/company-selectors";
import { useCreateCustomer } from "../api/use-create-customer";
import { useUpdateCustomer } from "../api/use-update-customer";
import {
	normalizeCustomerEmail,
	normalizeCustomerName,
	toNullableContact,
	validateCustomer,
} from "../lib/validate-customer";

const FALLBACK_ERROR = "No pudimos guardar el cliente. Probá de nuevo.";

/**
 * Turns the API's machine-readable `code` into something a person can act on.
 *
 * `customer_not_found` is the case the form can actually explain: the row was
 * deleted — here or in another tab — while the form was open. Every other code
 * falls back to the server's message, which is already user-facing Spanish.
 */
function saveErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		if (error.code === "customer_not_found") {
			return "Ese cliente ya no existe en esta empresa.";
		}
		return error.message;
	}
	return error ? FALLBACK_ERROR : undefined;
}

/**
 * The customer form (MI-11), in create and edit mode.
 *
 * One component for both because the fields, the validation and the layout are
 * the same: what changes is the customer it starts from and the mutation it
 * calls. A customer passed in means edit; nothing means create. It lives inside
 * the list page — there is no route for it — so both outcomes (saved or
 * cancelled) are reported to the parent through `onSaved` / `onCancel`.
 *
 * Validation mirrors the API (name 1..120; email optional, valid, ≤254; phone
 * optional, ≤40, only digits and `+ - ( ) .` and spaces; address optional
 * ≤300), so an invalid body never reaches the server. The values are normalized
 * before sending — trimmed name, lowercased email, `null` for a blank contact
 * field — because that is the shape the contract stores.
 */
export function CustomerForm({
	customer,
	onSaved,
	onCancel,
}: {
	customer?: Customer;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const company = useActiveCompany();
	const isEdit = customer !== undefined;

	const [name, setName] = useState(customer?.name ?? "");
	const [email, setEmail] = useState(customer?.email ?? "");
	const [phone, setPhone] = useState(customer?.phone ?? "");
	const [address, setAddress] = useState(customer?.address ?? "");
	const [attempted, setAttempted] = useState(false);
	const nameRef = useRef<HTMLInputElement>(null);

	const companyId = company?.id;
	const create = useCreateCustomer(companyId);
	const update = useUpdateCustomer(companyId);

	const isPending = create.isPending || update.isPending;
	const errors = attempted
		? validateCustomer({ name, email, phone, address })
		: {};
	const saveError = saveErrorMessage(create.error ?? update.error);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAttempted(true);

		const nextErrors = validateCustomer({ name, email, phone, address });
		if (Object.keys(nextErrors).length > 0) {
			nameRef.current?.focus();
			return;
		}

		const body = {
			name: normalizeCustomerName(name),
			email: normalizeCustomerEmail(email),
			phone: toNullableContact(phone),
			address: toNullableContact(address),
		};

		if (customer) {
			update.mutate(
				{ customerId: customer.id, ...body },
				{ onSuccess: onSaved },
			);
			return;
		}

		create.mutate(body, { onSuccess: onSaved });
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			data-slot="customer-form"
			aria-label={isEdit ? "Editar cliente" : "Crear cliente"}
			className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
		>
			<TextField
				ref={nameRef}
				label="Nombre del cliente"
				name="name"
				placeholder="Distribuidora Pérez"
				autoComplete="off"
				className="sm:col-span-2"
				value={name}
				onChange={(event) => setName(event.target.value)}
				error={errors.name}
				disabled={isPending}
			/>
			<TextField
				label="Email"
				name="email"
				type="email"
				placeholder="ventas@perez.com"
				autoComplete="off"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				error={errors.email}
				hint="Opcional. Se guarda en minúsculas."
				disabled={isPending}
			/>
			<TextField
				label="Teléfono"
				name="phone"
				type="tel"
				placeholder="+54 11 4321-9876"
				autoComplete="off"
				value={phone}
				onChange={(event) => setPhone(event.target.value)}
				error={errors.phone}
				hint="Opcional. Sólo números y los signos + - ( ) ."
				disabled={isPending}
			/>
			<TextareaField
				label="Dirección"
				name="address"
				placeholder="Av. Siempre Viva 742"
				className="sm:col-span-full"
				size="h-24"
				value={address}
				onChange={(event) => setAddress(event.target.value)}
				error={errors.address}
				hint="Opcional."
				disabled={isPending}
			/>

			{saveError ? (
				<div className="sm:col-span-full">
					<Alert variant="danger" title="No pudimos guardar el cliente">
						{saveError}
					</Alert>
				</div>
			) : null}

			<div className="col-span-full flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
				<Button
					type="button"
					variant="outline"
					className="h-10 w-full sm:w-30"
					onClick={onCancel}
				>
					Cancelar
				</Button>
				<Button
					className="h-10 w-full sm:w-40"
					type="submit"
					disabled={isPending}
				>
					{isPending ? (
						<>
							<SpinnerMotion size={20} className="mr-2" />
							{isEdit ? "Guardando..." : "Creando..."}
						</>
					) : isEdit ? (
						"Guardar cambios"
					) : (
						"Crear cliente"
					)}
				</Button>
			</div>
		</form>
	);
}
