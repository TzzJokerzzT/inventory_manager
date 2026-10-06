import { describe, expect, it } from "bun:test";
import { validateLogin } from "./validation";

describe("validateLogin", () => {
	it("requires both email and password", () => {
		expect(validateLogin({ email: "", password: "" })).toEqual({
			email: "Ingresá tu correo electrónico.",
			password: "Ingresá tu contraseña.",
		});
	});

	it("treats whitespace-only values as required", () => {
		expect(validateLogin({ email: "   ", password: "\t " })).toEqual({
			email: "Ingresá tu correo electrónico.",
			password: "Ingresá tu contraseña.",
		});
	});

	it("rejects an email with an invalid format", () => {
		expect(
			validateLogin({ email: "ana@empresa", password: "password123" }),
		).toEqual({ email: "Ingresá un correo electrónico válido." });
	});

	it("rejects a password shorter than 8 characters", () => {
		expect(
			validateLogin({ email: "ana@empresa.com", password: "1234567" }),
		).toEqual({
			password: "Ingresá una contraseña de al menos 8 caracteres.",
		});
	});

	it("accepts a password of exactly 8 characters", () => {
		expect(
			validateLogin({ email: "ana@empresa.com", password: "12345678" }),
		).toEqual({});
	});

	it("returns no errors for a fully valid pair", () => {
		expect(
			validateLogin({
				email: "ana@empresa.com",
				password: "password123",
			}),
		).toEqual({});
	});
});
