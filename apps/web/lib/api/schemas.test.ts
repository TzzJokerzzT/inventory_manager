import { ApiError } from "./client";
import {
	parseCompaniesResponse,
	parseCompany,
	parseLoginResponse,
	parseMediaUploadSignature,
	parseMembership,
	parseMembershipsResponse,
	parseMeResponse,
	parseMovements,
	parseNotifications,
	parsePendingInvitations,
	parseProduct,
	parseProducts,
	parseRegisterMovementResponse,
} from "./schemas";

describe("parseLoginResponse", () => {
	it("returns the access token and its lifetime", () => {
		const parsed = parseLoginResponse({
			accessToken: "token-value",
			expiresIn: 3600,
		});

		expect(parsed).toEqual({ accessToken: "token-value", expiresIn: 3600 });
	});

	it("rejects a response missing the token", () => {
		expect(() => parseLoginResponse({ expiresIn: 3600 })).toThrow(ApiError);
	});

	it("rejects a response whose fields have the wrong type", () => {
		expect(() =>
			parseLoginResponse({ accessToken: "token-value", expiresIn: "3600" }),
		).toThrow(/respuesta inesperada/);
	});

	it("does not leak the provider payload when the shape is wrong", () => {
		let message = "";
		try {
			parseLoginResponse({ id_token: "secret-id-token", refresh_token: "x" });
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).not.toContain("secret-id-token");
	});
});

describe("parseCompaniesResponse", () => {
	it("returns the companies exactly as the API serializes them", () => {
		const parsed = parseCompaniesResponse([
			{ id: "c1", name: "Primera", createdAt: "2026-10-06T00:00:00.000Z" },
			{ id: "c2", name: "Segunda", createdAt: "2026-10-06T01:00:00.000Z" },
		]);

		expect(parsed).toEqual([
			{ id: "c1", name: "Primera", createdAt: "2026-10-06T00:00:00.000Z" },
			{ id: "c2", name: "Segunda", createdAt: "2026-10-06T01:00:00.000Z" },
		]);
	});

	it("accepts an empty list", () => {
		expect(parseCompaniesResponse([])).toEqual([]);
	});

	it("rejects a non-array response", () => {
		expect(() => parseCompaniesResponse({ companies: [] })).toThrow(ApiError);
	});

	it("rejects an entry whose fields are missing or mistyped", () => {
		expect(() =>
			parseCompaniesResponse([{ id: "c1", name: "Primera" }]),
		).toThrow(/respuesta inesperada/);

		expect(() =>
			parseCompaniesResponse([{ id: "c1", name: "Primera", createdAt: 123 }]),
		).toThrow(/respuesta inesperada/);
	});
});

describe("parseCompany", () => {
	it("returns the created company", () => {
		const parsed = parseCompany({
			id: "company-1",
			name: "Acme",
			createdAt: "2026-10-06T00:00:00.000Z",
		});

		expect(parsed.name).toBe("Acme");
	});

	it("rejects a company whose shape changed", () => {
		expect(() => parseCompany({ id: "company-1" })).toThrow(ApiError);
	});
});

function meResponse(overrides: Record<string, unknown> = {}) {
	return {
		id: "user-1",
		email: "ana@empresa.com",
		fullName: "Ana Pérez",
		createdAt: "2026-10-06T00:00:00.000Z",
		memberships: [
			{
				companyId: "c1",
				role: "OWNER",
				company: {
					id: "c1",
					name: "Primera",
					createdAt: "2026-10-06T00:00:00.000Z",
				},
			},
		],
		...overrides,
	};
}

describe("parseMeResponse", () => {
	it("returns the identity and each membership with its company", () => {
		const parsed = parseMeResponse(meResponse());

		expect(parsed).toEqual(meResponse());
		expect(parsed.memberships[0].role).toBe("OWNER");
		expect(parsed.memberships[0].company.name).toBe("Primera");
	});

	it("accepts a user with no full name", () => {
		const parsed = parseMeResponse(meResponse({ fullName: null }));

		expect(parsed.fullName).toBeNull();
	});

	it("accepts a user with no memberships", () => {
		expect(
			parseMeResponse(meResponse({ memberships: [] })).memberships,
		).toEqual([]);
	});

	it("rejects a response missing the identity", () => {
		const { id: _id, ...withoutId } = meResponse();

		expect(() => parseMeResponse(withoutId)).toThrow(ApiError);
	});

	it("rejects a membership with a role outside the contract", () => {
		const response = meResponse({
			memberships: [
				{
					companyId: "c1",
					role: "SUPERUSER",
					company: {
						id: "c1",
						name: "Primera",
						createdAt: "2026-10-06T00:00:00.000Z",
					},
				},
			],
		});

		expect(() => parseMeResponse(response)).toThrow(/respuesta inesperada/);
	});

	it("rejects a membership whose company has the wrong shape", () => {
		const response = meResponse({
			memberships: [{ companyId: "c1", role: "MEMBER", company: { id: "c1" } }],
		});

		expect(() => parseMeResponse(response)).toThrow(/respuesta inesperada/);
	});
});

function membership(overrides: Record<string, unknown> = {}) {
	return {
		id: "m1",
		userId: "user-1",
		invitedEmail: "ana@empresa.com",
		companyId: "c1",
		role: "OWNER",
		status: "ACTIVE",
		invitedBy: "user-1",
		acceptedAt: "2026-10-06T00:00:00.000Z",
		createdAt: "2026-10-06T00:00:00.000Z",
		updatedAt: "2026-10-06T00:00:00.000Z",
		...overrides,
	};
}

describe("parseMembershipsResponse", () => {
	it("returns the roster exactly as the API serializes it", () => {
		const roster = [
			membership(),
			membership({
				id: "m2",
				userId: null,
				status: "INVITED",
				acceptedAt: null,
				role: "MEMBER",
			}),
		];

		expect(parseMembershipsResponse(roster)).toEqual(roster);
	});

	it("accepts an empty list, the normal case when nothing is pending", () => {
		expect(parseMembershipsResponse([])).toEqual([]);
	});

	it("accepts an invitation with no user yet", () => {
		const parsed = parseMembershipsResponse([
			membership({ userId: null, status: "INVITED", acceptedAt: null }),
		]);

		expect(parsed[0].userId).toBeNull();
		expect(parsed[0].acceptedAt).toBeNull();
	});

	it("rejects a non-array response", () => {
		expect(() => parseMembershipsResponse({ members: [] })).toThrow(ApiError);
	});

	it("rejects a membership with a role outside the contract", () => {
		expect(() =>
			parseMembershipsResponse([membership({ role: "SUPERUSER" })]),
		).toThrow(/respuesta inesperada/);
	});

	it("rejects a membership with a status outside the contract", () => {
		expect(() =>
			parseMembershipsResponse([membership({ status: "PENDING" })]),
		).toThrow(/respuesta inesperada/);
	});

	it("rejects an entry whose fields are missing or mistyped", () => {
		expect(() =>
			parseMembershipsResponse([{ id: "m1", invitedEmail: "ana@empresa.com" }]),
		).toThrow(/respuesta inesperada/);

		expect(() =>
			parseMembershipsResponse([membership({ invitedEmail: 123 })]),
		).toThrow(/respuesta inesperada/);
	});
});

describe("parseMembership", () => {
	it("returns the created or updated membership", () => {
		const parsed = parseMembership(membership({ role: "MEMBER" }));

		expect(parsed.role).toBe("MEMBER");
		expect(parsed.invitedEmail).toBe("ana@empresa.com");
	});

	it("returns a REVOKED membership from a revoke response", () => {
		const parsed = parseMembership(membership({ status: "REVOKED" }));

		expect(parsed.status).toBe("REVOKED");
	});

	it("rejects a membership whose shape changed", () => {
		expect(() => parseMembership({ id: "m1" })).toThrow(ApiError);
	});

	it("rejects a role or status outside the contract", () => {
		expect(() => parseMembership(membership({ role: "ROOT" }))).toThrow(
			/respuesta inesperada/,
		);
		expect(() => parseMembership(membership({ status: "GONE" }))).toThrow(
			/respuesta inesperada/,
		);
	});
});

function pendingInvitation(overrides: Record<string, unknown> = {}) {
	return {
		membershipId: "m1",
		companyId: "c1",
		role: "MEMBER",
		invitedAt: "2026-10-06T00:00:00.000Z",
		company: {
			id: "c1",
			name: "Primera",
			createdAt: "2026-10-06T00:00:00.000Z",
		},
		inviter: {
			id: "user-1",
			fullName: "Ana Pérez",
			email: "ana@empresa.com",
		},
		...overrides,
	};
}

function notification(overrides: Record<string, unknown> = {}) {
	return {
		id: "n1",
		type: "membership.accepted",
		createdAt: "2026-10-06T00:00:00.000Z",
		readAt: null,
		company: {
			id: "c1",
			name: "Acme",
			createdAt: "2026-10-01T00:00:00.000Z",
		},
		actor: null,
		...overrides,
	};
}

describe("parseNotifications", () => {
	it("returns the notifications exactly as the API serializes them", () => {
		const list = [notification()];

		expect(parseNotifications(list)).toEqual(list);
	});

	it("accepts an empty list, the normal case when there is no news", () => {
		expect(parseNotifications([])).toEqual([]);
	});

	it("accepts a read notification", () => {
		const parsed = parseNotifications([
			notification({ readAt: "2026-10-07T00:00:00.000Z" }),
		]);

		expect(parsed[0].readAt).toBe("2026-10-07T00:00:00.000Z");
	});

	it("accepts a null company without dropping the notification", () => {
		const parsed = parseNotifications([notification({ company: null })]);

		expect(parsed).toHaveLength(1);
		expect(parsed[0].company).toBeNull();
	});

	it("accepts an actor with a full name", () => {
		const parsed = parseNotifications([
			notification({
				actor: { id: "u1", fullName: "Ana Pérez", email: "ana@empresa.com" },
			}),
		]);

		expect(parsed[0].actor).toEqual({
			id: "u1",
			fullName: "Ana Pérez",
			email: "ana@empresa.com",
		});
	});

	it("accepts an actor without a full name", () => {
		const parsed = parseNotifications([
			notification({
				actor: { id: "u1", fullName: null, email: "ana@empresa.com" },
			}),
		]);

		expect(parsed[0].actor?.fullName).toBeNull();
	});

	it("accepts a null actor without dropping the event", () => {
		// Rows written before the actor was recorded still read fine.
		const parsed = parseNotifications([notification({ actor: null })]);

		expect(parsed).toHaveLength(1);
		expect(parsed[0].actor).toBeNull();
	});

	it("rejects an actor with the wrong shape", () => {
		expect(() =>
			parseNotifications([notification({ actor: { id: "u1" } })]),
		).toThrow(/respuesta inesperada/);
	});

	it("accepts an unknown event type so the UI can degrade to neutral copy", () => {
		const parsed = parseNotifications([
			notification({ type: "company.renamed" }),
		]);

		expect(parsed[0].type).toBe("company.renamed");
	});

	it("rejects a non-array response", () => {
		expect(() => parseNotifications({ notifications: [] })).toThrow(ApiError);
	});

	it("rejects an entry whose fields are missing or mistyped", () => {
		expect(() => parseNotifications([{ id: "n1" }])).toThrow(
			/respuesta inesperada/,
		);

		expect(() => parseNotifications([notification({ readAt: 123 })])).toThrow(
			/respuesta inesperada/,
		);
	});
});

describe("parsePendingInvitations", () => {
	it("returns the pending invitations exactly as the API serializes them", () => {
		const list = [pendingInvitation()];

		expect(parsePendingInvitations(list)).toEqual(list);
	});

	it("accepts an empty list, the normal case when nothing is pending", () => {
		expect(parsePendingInvitations([])).toEqual([]);
	});

	it("accepts an inviter without a full name", () => {
		const parsed = parsePendingInvitations([
			pendingInvitation({
				inviter: { id: "user-1", fullName: null, email: "ana@empresa.com" },
			}),
		]);

		expect(parsed[0].inviter?.fullName).toBeNull();
	});

	it("accepts a null inviter without dropping the invitation", () => {
		const parsed = parsePendingInvitations([
			pendingInvitation({ inviter: null }),
		]);

		expect(parsed).toHaveLength(1);
		expect(parsed[0].inviter).toBeNull();
	});

	it("rejects a non-array response", () => {
		expect(() => parsePendingInvitations({ invitations: [] })).toThrow(
			ApiError,
		);
	});

	it("rejects an invitation whose role is outside the contract", () => {
		expect(() =>
			parsePendingInvitations([pendingInvitation({ role: "SUPERUSER" })]),
		).toThrow(/respuesta inesperada/);
	});

	it("rejects an invitation missing the inviter field", () => {
		const { inviter: _inviter, ...withoutInviter } = pendingInvitation();

		expect(() => parsePendingInvitations([withoutInviter])).toThrow(ApiError);
	});

	it("rejects an entry whose fields are missing or mistyped", () => {
		expect(() =>
			parsePendingInvitations([{ membershipId: "m1", companyId: "c1" }]),
		).toThrow(/respuesta inesperada/);

		expect(() =>
			parsePendingInvitations([pendingInvitation({ invitedAt: 123 })]),
		).toThrow(/respuesta inesperada/);
	});
});

function product(overrides: Record<string, unknown> = {}) {
	return {
		id: "p1",
		companyId: "c1",
		name: "Café molido 500g",
		description: "Molido medio",
		sku: "CAF-500",
		price: "1500.00",
		photoUrl: null,
		stockQuantity: 0,
		lowStockThreshold: 0,
		categoryId: null,
		createdAt: "2026-10-20T12:00:00.000Z",
		updatedAt: "2026-10-20T12:00:00.000Z",
		...overrides,
	};
}

describe("parseProducts", () => {
	it("returns the catalogue exactly as the API serializes it", () => {
		const catalogue = [product()];

		expect(parseProducts(catalogue)).toEqual(catalogue);
	});

	it("accepts an empty catalogue", () => {
		expect(parseProducts([])).toEqual([]);
	});

	it("keeps the price as the decimal string the contract promises", () => {
		const parsed = parseProducts([product({ price: "1500.00" })]);

		expect(parsed[0].price).toBe("1500.00");
	});

	it("rejects a price sent as a JSON number", () => {
		// The column is Decimal(12,2): a float in the contract would lose
		// precision at the first rounding, so the boundary refuses it.
		expect(() => parseProducts([product({ price: 1500 })])).toThrow(
			/respuesta inesperada/,
		);
	});

	it("accepts the nullable fields the contract allows to be null", () => {
		const parsed = parseProducts([
			product({ description: null, photoUrl: null, categoryId: null }),
		]);

		expect(parsed[0].description).toBeNull();
		expect(parsed[0].photoUrl).toBeNull();
		expect(parsed[0].categoryId).toBeNull();
	});

	it("keeps a photo url and a description when the product has them", () => {
		const parsed = parseProducts([
			product({
				description: "Molido medio",
				photoUrl: "https://res.cloudinary.com/demo/image/upload/cafe.jpg",
				categoryId: "cat-1",
			}),
		]);

		expect(parsed[0].photoUrl).toBe(
			"https://res.cloudinary.com/demo/image/upload/cafe.jpg",
		);
		expect(parsed[0].categoryId).toBe("cat-1");
	});

	it("rejects a null where the contract requires a value", () => {
		expect(() => parseProducts([product({ sku: null })])).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects stock counters that are not numbers", () => {
		expect(() => parseProducts([product({ stockQuantity: "0" })])).toThrow(
			/respuesta inesperada/,
		);
		expect(() => parseProducts([product({ lowStockThreshold: "0" })])).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects a non-array response", () => {
		expect(() => parseProducts({ products: [] })).toThrow(ApiError);
	});

	it("rejects an entry whose fields are missing", () => {
		expect(() => parseProducts([{ id: "p1", name: "Café" }])).toThrow(
			/respuesta inesperada/,
		);
	});
});

describe("parseProduct", () => {
	it("returns the product of a read, a creation or an update", () => {
		const parsed = parseProduct(product());

		expect(parsed.id).toBe("p1");
		expect(parsed.sku).toBe("CAF-500");
		expect(parsed.stockQuantity).toBe(0);
	});

	it("rejects a product whose shape changed", () => {
		expect(() => parseProduct({ id: "p1" })).toThrow(ApiError);
	});
});

function movement(overrides: Record<string, unknown> = {}) {
	return {
		id: "m1",
		companyId: "c1",
		productId: "p1",
		type: "IN",
		quantity: 10,
		reason: "Compra a proveedor",
		createdAt: "2026-10-21T12:00:00.000Z",
		product: { id: "p1", name: "Café molido 500g", sku: "CAF-500" },
		actor: { id: "user-1", fullName: "Ana", email: "ana@empresa.com" },
		...overrides,
	};
}

describe("parseMovements", () => {
	it("returns the history exactly as the API serializes it", () => {
		const history = [movement()];

		expect(parseMovements(history)).toEqual(history);
	});

	it("accepts an empty history", () => {
		expect(parseMovements([])).toEqual([]);
	});

	it("accepts a movement whose actor could not be resolved", () => {
		// El actor ausente nunca oculta el movimiento: es la traza del stock.
		const parsed = parseMovements([movement({ actor: null })]);

		expect(parsed).toHaveLength(1);
		expect(parsed[0].actor).toBeNull();
	});

	it("accepts a movement without a reason", () => {
		const parsed = parseMovements([movement({ reason: null })]);

		expect(parsed[0].reason).toBeNull();
	});

	it("keeps the direction of the movement", () => {
		expect(parseMovements([movement({ type: "OUT" })])[0].type).toBe("OUT");
	});

	it("rejects a quantity that is not a number", () => {
		// `quantity` es un conteo en el contrato, no el string decimal del precio.
		expect(() => parseMovements([movement({ quantity: "10" })])).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects a type outside IN and OUT", () => {
		expect(() => parseMovements([movement({ type: "ENTRADA" })])).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects a movement without its resolved product", () => {
		const { product: _product, ...withoutProduct } = movement();

		expect(() => parseMovements([withoutProduct])).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects an entry whose fields are missing or mistyped", () => {
		expect(() => parseMovements([{ id: "m1" }])).toThrow(
			/respuesta inesperada/,
		);

		expect(() => parseMovements([movement({ createdAt: 123 })])).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects a non-array response", () => {
		expect(() => parseMovements({ movements: [] })).toThrow(ApiError);
	});
});

describe("parseRegisterMovementResponse", () => {
	it("returns the movement plus the stock left after it", () => {
		const parsed = parseRegisterMovementResponse({
			...movement(),
			stockQuantity: 10,
		});

		expect(parsed.id).toBe("m1");
		expect(parsed.stockQuantity).toBe(10);
	});

	it("rejects a response that does not carry the resulting stock", () => {
		// Sin ese campo la UI no puede mostrar el stock real, así que el límite
		// lo rechaza en vez de dejar que una vista lo invente.
		expect(() => parseRegisterMovementResponse(movement())).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects a response whose movement shape changed", () => {
		expect(() =>
			parseRegisterMovementResponse({ id: "m1", stockQuantity: 10 }),
		).toThrow(ApiError);
	});
});

function mediaSignature(overrides: Record<string, unknown> = {}) {
	return {
		cloudName: "demo-cloud",
		apiKey: "123456789",
		timestamp: 1760000000,
		signature: "abc123deadbeef",
		folder: "companies/c1/products",
		allowedFormats: ["jpg", "png", "webp"],
		maxFileSizeBytes: 5 * 1024 * 1024,
		...overrides,
	};
}

describe("parseMediaUploadSignature", () => {
	it("returns the signed upload parameters", () => {
		const signature = mediaSignature();

		expect(parseMediaUploadSignature(signature)).toEqual(signature);
	});

	it("rejects a signature missing the upload limits", () => {
		const { maxFileSizeBytes: _bytes, ...withoutLimit } = mediaSignature();

		expect(() => parseMediaUploadSignature(withoutLimit)).toThrow(
			/respuesta inesperada/,
		);
	});

	it("rejects a signature whose formats are not a list of strings", () => {
		expect(() =>
			parseMediaUploadSignature(mediaSignature({ allowedFormats: "jpg" })),
		).toThrow(/respuesta inesperada/);
	});
});
