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
});
