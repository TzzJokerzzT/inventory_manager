"use client";

import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { Alert, Checkbox, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
	type RegisterErrors,
	type RegisterValues,
	validateRegister,
} from "@/lib/auth/validation";
import { useRegister } from "@/src/features/auth/api/use-register";

const FALLBACK_ERROR =
	"No pudimos completar el registro. Probá de nuevo en unos minutos.";

export function RegisterForm() {
	const [values, setValues] = useState<RegisterValues>({
		name: "",
		email: "",
		companyName: "",
		password: "",
	});
	const [errors, setErrors] = useState<RegisterErrors>({});
	// Errors only show after a submit attempt, so nothing appears while the
	// person is still filling the form for the first time.
	const [attempted, setAttempted] = useState(false);
	const nameRef = useRef<HTMLInputElement>(null);
	const emailRef = useRef<HTMLInputElement>(null);
	const companyRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);

	const register = useRegister();
	const busy = register.isPending || register.isSuccess;
	const apiError =
		register.error instanceof ApiError
			? register.error.message
			: register.isError
				? FALLBACK_ERROR
				: undefined;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextErrors = validateRegister(values);

		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors);
			setAttempted(true);
			focusFirstError(nextErrors);
			return;
		}

		setErrors({});
		setAttempted(true);

		// Only what the API accepts today. The name and the company stay in the
		// form because the design asks for them, and the company is created by
		// the bootstrap MI-44 owns: until that exists, they are not sent
		// anywhere, and that is a known gap rather than an oversight.
		register.mutate({ email: values.email.trim(), password: values.password });
	}

	function focusFirstError(nextErrors: RegisterErrors) {
		const refs = {
			name: nameRef,
			email: emailRef,
			companyName: companyRef,
			password: passwordRef,
		} as const;

		for (const field of ["name", "email", "companyName", "password"] as const) {
			if (nextErrors[field]) {
				refs[field].current?.focus();
				return;
			}
		}
	}

	function handleChange(field: keyof RegisterValues, value: string) {
		const nextValues = { ...values, [field]: value };
		setValues(nextValues);
		if (attempted) {
			setErrors(validateRegister(nextValues));
		}
	}

	return (
		<LazyMotion features={domAnimation}>
			<m.form
				initial={{ opacity: 0, x: -20 }}
				animate={{ opacity: 1, x: 0 }}
				transition={{ duration: 0.5 }}
				onSubmit={handleSubmit}
				noValidate
				className="flex w-full max-w-[640px] flex-col gap-6"
				data-slot="register-form"
			>
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold text-text-primary">Crear cuenta</h1>
					<p className="text-base text-text-secondary">
						Completá tus datos para empezar.
					</p>
				</div>

				<div className="flex flex-col gap-4">
					<TextField
						ref={nameRef}
						label="Nombre y apellido"
						type="text"
						name="name"
						placeholder="Carlos Mario Garcia Cabellero"
						autoComplete="name"
						value={values.name}
						onChange={(event) => handleChange("name", event.target.value)}
						error={errors.name}
						disabled={busy}
					/>
					<TextField
						ref={emailRef}
						label="Correo electrónico"
						type="email"
						name="email"
						placeholder="ana@empresa.com"
						autoComplete="email"
						value={values.email}
						onChange={(event) => handleChange("email", event.target.value)}
						error={errors.email}
						disabled={busy}
					/>
					<TextField
						ref={companyRef}
						label="Nombre de la empresa"
						type="text"
						name="companyName"
						placeholder="Empresa comercializadora S.A.S"
						autoComplete="organization"
						value={values.companyName}
						onChange={(event) =>
							handleChange("companyName", event.target.value)
						}
						error={errors.companyName}
						disabled={busy}
					/>
					<TextField
						ref={passwordRef}
						label="Contraseña"
						type="password"
						name="password"
						placeholder="*************"
						// `new-password` and not `current-password`: this is where a
						// browser should offer to generate one.
						autoComplete="new-password"
						minLength={8}
						value={values.password}
						onChange={(event) => handleChange("password", event.target.value)}
						error={errors.password}
						disabled={busy}
					/>
				</div>

				<div className="flex items-center justify-between gap-4">
					<Checkbox
						label="Acepto los términos y politicas de privacidad"
						name="terms"
					/>
				</div>

				<Button
					size="ds"
					variant="primary"
					type="submit"
					className="w-full"
					disabled={busy}
				>
					{register.isPending ? (
						<>
							<SpinnerMotion size={20} className="mr-2" />
							Registrando...
						</>
					) : (
						"Registrarme"
					)}
				</Button>

				{register.isSuccess ? (
					<Alert variant="success" title="Revisá tu correo">
						<p>
							Te enviamos un correo para verificar tu cuenta. Abrilo desde el
							mismo dispositivo y después iniciá sesión.
						</p>
						{/* The API answers the same thing whether the address was new or
						    already registered, on purpose: saying which one it was would
						    reveal whether an account exists. */}
					</Alert>
				) : null}

				{apiError ? (
					<Alert variant="danger" title="No pudimos crear tu cuenta">
						<p>{apiError}</p>
					</Alert>
				) : null}

				<p className="text-center text-sm text-text-secondary">
					¿Ya tienes cuenta?{" "}
					<Link href="/login" className="text-link hover:underline">
						Iniciar sesión
					</Link>
				</p>
			</m.form>
		</LazyMotion>
	);
}
