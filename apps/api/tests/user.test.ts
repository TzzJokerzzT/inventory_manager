import { User } from "../src/domain/entities/user.js";
import { DomainError } from "../src/domain/errors/domain-error.js";

describe("User", () => {
	it("lowercases the email so a mixed-case input is not representable", () => {
		const user = User.create({
			auth0Sub: "auth0|abc123",
			email: "SOMEONE@Example.com",
		});

		expect(user.email).toBe("someone@example.com");
	});

	it("rejects an empty auth0 sub", () => {
		expect(() =>
			User.create({ auth0Sub: "   ", email: "a@example.com" }),
		).toThrow(DomainError);
	});

	it("rejects an empty email", () => {
		expect(() =>
			User.create({ auth0Sub: "auth0|abc123", email: "   " }),
		).toThrow(DomainError);
	});

	it("generates an id and createdAt when they are not provided", () => {
		const user = User.create({
			auth0Sub: "auth0|abc123",
			email: "a@example.com",
		});

		expect(user.id).toEqual(expect.any(String));
		expect(user.createdAt).toBeInstanceOf(Date);
	});

	it("preserves an explicitly provided id and createdAt", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const user = User.create({
			id: "user-1",
			auth0Sub: "auth0|abc123",
			email: "a@example.com",
			createdAt,
		});

		expect(user.id).toBe("user-1");
		expect(user.createdAt).toBe(createdAt);
	});

	describe("fullName", () => {
		it("defaults to null when it is not provided", () => {
			const user = User.create({
				auth0Sub: "auth0|abc123",
				email: "a@example.com",
			});

			expect(user.fullName).toBeNull();
		});

		it("preserves a real name verbatim", () => {
			const user = User.create({
				auth0Sub: "auth0|abc123",
				email: "a@example.com",
				fullName: "Alexis Buelvas",
			});

			expect(user.fullName).toBe("Alexis Buelvas");
		});

		it("trims the surrounding whitespace on create", () => {
			const user = User.create({
				auth0Sub: "auth0|abc123",
				email: "a@example.com",
				fullName: "  Alexis Buelvas  ",
			});

			expect(user.fullName).toBe("Alexis Buelvas");
		});

		it("collapses an empty or whitespace-only value to null on create", () => {
			const empty = User.create({
				auth0Sub: "auth0|abc123",
				email: "a@example.com",
				fullName: "",
			});
			const blank = User.create({
				auth0Sub: "auth0|abc123",
				email: "a@example.com",
				fullName: "   ",
			});

			expect(empty.fullName).toBeNull();
			expect(blank.fullName).toBeNull();
		});

		it("includes fullName in toJSON", () => {
			const user = User.create({
				auth0Sub: "auth0|abc123",
				email: "a@example.com",
				fullName: "Alexis Buelvas",
			});

			expect(user.toJSON()).toEqual({
				id: expect.any(String),
				auth0Sub: "auth0|abc123",
				email: "a@example.com",
				fullName: "Alexis Buelvas",
				createdAt: expect.any(String),
			});
		});
	});

	describe("normalizeFullName", () => {
		it("trims the surrounding whitespace and preserves the inner name", () => {
			expect(User.normalizeFullName("  Alexis Buelvas  ")).toBe(
				"Alexis Buelvas",
			);
			expect(User.normalizeFullName("Alexis  Buelvas")).toBe("Alexis  Buelvas");
		});

		it("maps an empty or whitespace-only string to null", () => {
			expect(User.normalizeFullName("")).toBeNull();
			expect(User.normalizeFullName("   ")).toBeNull();
		});

		it("keeps null as null", () => {
			expect(User.normalizeFullName(null)).toBeNull();
		});
	});
});
