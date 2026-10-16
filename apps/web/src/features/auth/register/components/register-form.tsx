"use client";

import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Checkbox, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
	type RegisterErrors,
	type RegisterValues,
	validateRegister,
} from "@/lib/auth/validation";
import { AlertMessage } from "@/src/shared/components/AlertMessage";
import { useRegister } from "../hooks/use-register";
import { FALLBACK_ERROR } from "../utils/constants";

export function RegisterForm() {
	const [values, setValues] = useState<RegisterValues>({
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [touched, setTouched] = useState<
		Partial<Record<keyof RegisterValues, boolean>>
	>({});
	// Errors only show after a submit attempt, so nothing appears while the
	// person is still filling the form for the first time.
	const [attempted, setAttempted] = useState(false);
	const emailRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const confirmPasswordRef = useRef<HTMLInputElement>(null);

	const register = useRegister();
	const { error, reset, mutate, isError, isPending, isSuccess } = register;
	const allErrors = validateRegister(values);
	const errors: RegisterErrors = {};
	for (const field of Object.keys(allErrors) as (keyof RegisterValues)[]) {
		if (attempted || touched[field]) {
			errors[field] = allErrors[field];
		}
	}

	const apiError =
		error instanceof ApiError
			? error.message
			: isError
				? FALLBACK_ERROR
				: undefined;

	useEffect(() => {
		if (!isSuccess) return;

		const id = setTimeout(() => {
			reset();
		}, 10000);

		return () => clearTimeout(id);
	}, [isSuccess, reset]);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAttempted(true);

		// `allErrors` is derived on render from the same `values`, so validating
		// again here would only repeat the work.
		if (Object.keys(allErrors).length > 0) {
			focusFirstError(allErrors);
			return;
		}

		mutate(
			{ email: values.email.trim(), password: values.password },
			{
				onSuccess: () => {
					setValues({ email: "", password: "", confirmPassword: "" });
					// Sin esto, al vaciar los campos aparecerían todos los errores.
					setAttempted(false);
					setTouched({});
				},
			},
		);
	}

	function focusFirstError(nextErrors: RegisterErrors) {
		const refs = {
			email: emailRef,
			password: passwordRef,
			confirmPassword: confirmPasswordRef,
		} as const;

		for (const field of ["email", "password", "confirmPassword"] as const) {
			if (nextErrors[field]) {
				refs[field].current?.focus();
				return;
			}
		}
	}

	function handleChange(field: keyof RegisterValues, value: string) {
		setValues((prev) => ({ ...prev, [field]: value }));
	}

	function handleBlur(field: keyof RegisterValues) {
		setTouched((prev) => ({ ...prev, [field]: true }));
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
						ref={emailRef}
						label="Correo electrónico"
						type="email"
						name="email"
						placeholder="ana@empresa.com"
						autoComplete="email"
						value={values.email}
						onChange={(event) => handleChange("email", event.target.value)}
						onBlur={() => handleBlur("email")}
						error={errors.email}
						disabled={isPending}
						required
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
						onBlur={() => handleBlur("password")}
						error={errors.password}
						disabled={isPending}
						required
					/>
					<TextField
						ref={confirmPasswordRef}
						label="Confirme la contraseña"
						type="password"
						name="confirmPassword"
						placeholder="*************"
						autoComplete="new-password"
						value={values.confirmPassword}
						onChange={(event) =>
							handleChange("confirmPassword", event.target.value)
						}
						onBlur={() => handleBlur("confirmPassword")}
						error={errors.confirmPassword}
						disabled={isPending}
						required
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
					disabled={isPending}
				>
					{isPending ? (
						<>
							<SpinnerMotion size={20} className="mr-2" />
							Registrando...
						</>
					) : (
						"Registrarme"
					)}
				</Button>

				{isSuccess ? (
					<AlertMessage
						title="Revisá tu correo"
						message="Te enviamos un correo para verificar tu cuenta. Abrelo desde el mismo dispositivo y después iniciá sesión."
					/>
				) : null}

				{apiError ? (
					<AlertMessage
						title="No pudimos crear tu cuenta"
						message={apiError}
						variant="danger"
					/>
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
