"use client";

import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { Alert, Checkbox, TextField } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { type LoginErrors, validateLogin } from "@/lib/auth/validation";

export function LoginForm() {
	const [values, setValues] = useState({ email: "", password: "" });
	const [errors, setErrors] = useState<LoginErrors>({});
	const [submitted, setSubmitted] = useState(false);
	const [notice, setNotice] = useState(false);
	const emailRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextErrors = validateLogin(values);

		if (nextErrors.email || nextErrors.password) {
			setErrors(nextErrors);
			setSubmitted(true);
			setNotice(false);
			(nextErrors.email ? emailRef : passwordRef).current?.focus();
			return;
		}

		setErrors({});
		setSubmitted(true);
		setNotice(true);
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
					/>
				</div>

				<div className="flex items-center justify-between gap-4">
					<Checkbox label="Recordarme" name="remember" />
					<button
						type="button"
						onClick={() => setNotice(true)}
						className="text-sm text-link hover:underline"
					>
						¿Olvidaste tu contraseña?
					</button>
				</div>

				<Button size="ds" variant="primary" type="submit" className="w-full">
					Ingresar al panel
				</Button>

				{notice ? (
					// Provisional until MI-39 (Auth0 setup) lands: a valid submit has
					// no other observable response yet.
					<Alert
						variant="warning"
						title="La autenticación aún no está disponible"
					>
						<p>
							Todavía no podés iniciar sesión ni recuperar tu contraseña. Volvé
							a intentarlo más adelante.
						</p>
					</Alert>
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
