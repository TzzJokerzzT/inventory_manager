import {
	MAX_CUSTOMER_ADDRESS_LENGTH,
	MAX_CUSTOMER_EMAIL_LENGTH,
	MAX_CUSTOMER_NAME_LENGTH,
	MAX_CUSTOMER_PHONE_LENGTH,
	normalizeCustomerEmail,
	normalizeCustomerName,
	toNullableContact,
	validateCustomer,
} from "../validate-customer";

function values(overrides: Record<string, string> = {}) {
	return {
		name: "Distribuidora Pérez",
		email: "",
		phone: "",
		address: "",
		...overrides,
	};
}

describe("validateCustomer", () => {
	it("accepts a name with no contact data at all", () => {
		expect(validateCustomer(values())).toEqual({});
	});

	it("requires a name that is not only whitespace", () => {
		expect(validateCustomer(values({ name: "   " })).name).toBe(
			"Ingresá el nombre del cliente.",
		);
	});

	it("measures the name on the trimmed value, up to 120 characters", () => {
		const longest = "a".repeat(MAX_CUSTOMER_NAME_LENGTH);

		expect(validateCustomer(values({ name: `  ${longest}  ` })).name).toBe(
			undefined,
		);
		expect(validateCustomer(values({ name: `${longest}b` })).name).toBe(
			`Usá ${MAX_CUSTOMER_NAME_LENGTH} caracteres como máximo en el nombre.`,
		);
	});

	it("rejects an email that is not an address", () => {
		expect(validateCustomer(values({ email: "cliente@" })).email).toBe(
			"Ingresá un email válido, por ejemplo cliente@empresa.com.",
		);
		expect(
			validateCustomer(values({ email: "cliente@empresa.com" })).email,
		).toBe(undefined);
	});

	it("accepts an email up to 254 characters and rejects a longer one", () => {
		const domain = "@empresa.com";
		const longest = `${"a".repeat(MAX_CUSTOMER_EMAIL_LENGTH - domain.length)}${domain}`;

		expect(validateCustomer(values({ email: longest })).email).toBe(undefined);
		expect(validateCustomer(values({ email: `x${longest}` })).email).toBe(
			`Usá ${MAX_CUSTOMER_EMAIL_LENGTH} caracteres como máximo en el email.`,
		);
	});

	it("accepts a phone made of digits and + - ( ) . and spaces", () => {
		expect(
			validateCustomer(values({ phone: "+54 (11) 4321-9876" })).phone,
		).toBe(undefined);
	});

	it("rejects a phone with any other character", () => {
		expect(validateCustomer(values({ phone: "4321-ABCD" })).phone).toBe(
			"Usá sólo números y los signos + - ( ) . en el teléfono.",
		);
	});

	it("rejects a phone longer than 40 characters", () => {
		const longest = "1".repeat(MAX_CUSTOMER_PHONE_LENGTH);

		expect(validateCustomer(values({ phone: longest })).phone).toBe(undefined);
		expect(validateCustomer(values({ phone: `${longest}1` })).phone).toBe(
			`Usá ${MAX_CUSTOMER_PHONE_LENGTH} caracteres como máximo en el teléfono.`,
		);
	});

	it("rejects an address longer than 300 characters", () => {
		const longest = "a".repeat(MAX_CUSTOMER_ADDRESS_LENGTH);

		expect(validateCustomer(values({ address: longest })).address).toBe(
			undefined,
		);
		expect(validateCustomer(values({ address: `${longest}a` })).address).toBe(
			`Usá ${MAX_CUSTOMER_ADDRESS_LENGTH} caracteres como máximo en la dirección.`,
		);
	});

	it("reports every invalid field at once", () => {
		const errors = validateCustomer(
			values({ name: "", email: "no-es-email", phone: "1234-ABC" }),
		);

		expect(Object.keys(errors).sort()).toEqual(["email", "name", "phone"]);
	});
});

describe("normalization", () => {
	it("trims the name, which is the value the server stores", () => {
		expect(normalizeCustomerName("  Distribuidora Pérez  ")).toBe(
			"Distribuidora Pérez",
		);
	});

	it("lowercases and trims the email, or nulls a blank one", () => {
		expect(normalizeCustomerEmail("  Ventas@Perez.COM  ")).toBe(
			"ventas@perez.com",
		);
		expect(normalizeCustomerEmail("   ")).toBeNull();
	});

	it("sends a blank contact field as null, which is how the API clears it", () => {
		expect(toNullableContact("  Av. Siempre Viva 742 ")).toBe(
			"Av. Siempre Viva 742",
		);
		expect(toNullableContact("   ")).toBeNull();
	});
});
