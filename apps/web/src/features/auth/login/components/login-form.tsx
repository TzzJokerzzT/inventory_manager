"use client";

import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Checkbox, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { SpinnerMotion } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { type LoginErrors, validateLogin } from "@/lib/auth/validation";
import { AlertMessage } from "@/src/shared/components/AlertMessage";
import { AlertToast } from "@/src/shared/components/AlertToast";
import { useLogin } from "../hook/use-login";
import { FALLBACK_ERROR } from "../utils/constants";

export function LoginForm() {
	const [values, setValues] = useState({ email: "", password: "" });
	const [errors, setErrors] = useState<LoginErrors>({});
	// `submitted` only decides when validation errors show; `isPending` alone
	// decides when the fields lock, so a finished request never leaves the
	// form disabled for good.
	const [submitted, setSubmitted] = useState(false);
	const [showRecovery, setShowRecovery] = useState(false);
	const emailRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);

	const router = useRouter();
	const login = useLogin();
	const { error, isError, isPending, isSuccess, mutate } = login;

	const apiError =
		error instanceof ApiError
			? error.message
			: isError
				? FALLBACK_ERROR
				: undefined;

	// `replace` so the browser Back button never returns to a form that is
	// already authenticated.
	useEffect(() => {
		if (!isSuccess) return;

		router.replace("/sin-empresas");
	}, [isSuccess, router]);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextErrors = validateLogin(values);

		if (nextErrors.email || nextErrors.password) {
			setErrors(nextErrors);
			setSubmitted(true);
			setShowRecovery(false);
			(nextErrors.email ? emailRef : passwordRef).current?.focus();
			return;
		}

		setErrors({});
		setSubmitted(true);

		// Only the email is trimmed (the API trims it too); a password may
		// legitimately contain spaces and must reach the server unchanged.
		mutate(
			{ email: values.email.trim(), password: values.password },
			{
				onSuccess: () => {
					AlertToast({
						title: "¡Listo!",
						description: "Se ha iniciado sesión correctamente.",
						type: "success",
						delay: 3000,
					});
				},
			},
		);
	}

	function handleChange(field: "email" | "password", value: string) {
		const nextValues = { ...values, [field]: value };
		setValues(nextValues);
		// Only react to corrections after a submit attempt, so nothing shows
		// while the user is still filling the form for the first time.
		if (submitted) {
			setErrors(validateLogin(nextValues));
		}
	}

	return (
		<LazyMotion features={domAnimation}>
			<m.form
				initial={{ opacity: 0, x: 20 }}
				animate={{ opacity: 1, x: 0 }}
				transition={{ duration: 0.5 }}
				onSubmit={handleSubmit}
				noValidate
				className="flex w-full max-w-[640px] flex-col gap-6"
				data-slot="login-form"
			>
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold text-text-primary">
						Iniciar sesión
					</h1>
					<p className="text-base text-text-secondary">
						Ingresá con tu cuenta para continuar.
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
						error={errors.email}
						disabled={isPending}
					/>
					<TextField
						ref={passwordRef}
						label="Contraseña"
						type="password"
						name="password"
						autoComplete="current-password"
						value={values.password}
						onChange={(event) => handleChange("password", event.target.value)}
						error={errors.password}
						disabled={isPending}
					/>
				</div>

				<div className="flex items-center justify-between gap-4">
					<Checkbox label="Recordarme" name="remember" />
					<button
						type="button"
						onClick={() => setShowRecovery(true)}
						className="text-sm text-link hover:underline"
					>
						¿Olvidaste tu contraseña?
					</button>
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
							Ingresando al panel...
						</>
					) : (
						"Ingresar al panel"
					)}
				</Button>

				{apiError ? (
					<AlertMessage
						variant="danger"
						title="No pudimos iniciar sesión"
						message={apiError}
					/>
				) : null}

				{showRecovery ? (
					// Password recovery has no endpoint yet, so the control can
					// only be honest about that instead of pretending it works.
					<AlertMessage
						variant="warning"
						title="La recuperación de contraseña aún no está disponible"
						message="Todavía no podés restablecer tu contraseña desde acá. Vuelve a intentarlo más adelante."
					/>
				) : null}

				<p className="text-center text-sm text-text-secondary">
					¿No tenés cuenta?{" "}
					<Link href="/registro" className="text-link hover:underline">
						Crear cuenta
					</Link>
				</p>
			</m.form>
		</LazyMotion>
	);
}
