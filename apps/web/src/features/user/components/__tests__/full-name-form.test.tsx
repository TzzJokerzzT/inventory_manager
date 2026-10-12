import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { useMe } from "../../api/use-me";
import { useUpdateFullName } from "../../api/use-update-full-name";
import { FullNameForm } from "../full-name-form";
import { User } from "../user";

jest.mock("../../api/use-update-full-name", () => ({
	useUpdateFullName: jest.fn(),
}));

jest.mock("../../api/use-me", () => ({
	useMe: jest.fn(),
}));

// The profile test asserts the profile, not the members card (that section has
// its own test); the stub keeps the host's query tree out of this suite.
jest.mock("@/src/features/member/components/members-section", () => ({
	MembersSection: function MembersSectionStub() {
		return null;
	},
}));

// The pending-invitations section now owns the heading the profile test
// asserts and fetches its own data; the stub keeps that query tree out of this
// suite while still exposing the heading, so the existing mount assertion keeps
// proving `user.tsx` mounts the section.
jest.mock(
	"@/src/features/member/components/pending-invitations-section",
	() => ({
		PendingInvitationsSection: function PendingInvitationsSectionStub() {
			return <h2>Invitaciones pendientes</h2>;
		},
	}),
);

// Same reason: the accept action owns its own suite, and the profile test only
// needs to prove the section is mounted for a user who already has a company.
jest.mock("@/src/features/member/components/accept-invitations-action", () => ({
	AcceptInvitationsAction: function AcceptInvitationsActionStub() {
		return null;
	},
}));

const useMeMock = useMe as jest.MockedFunction<typeof useMe>;

const useUpdateFullNameMock = useUpdateFullName as jest.MockedFunction<
	typeof useUpdateFullName
>;
const mutate = jest.fn();
const refetch = jest.fn();

function mockMe(overrides: Partial<ReturnType<typeof useMe>> = {}) {
	useMeMock.mockReturnValue({
		data: {
			id: "user-1",
			email: "ana@example.com",
			fullName: "Ana Pérez",
			createdAt: "2026-01-01T00:00:00.000Z",
			memberships: [],
		},
		isPending: false,
		isError: false,
		refetch,
		...overrides,
	} as unknown as ReturnType<typeof useMe>);
}

function mockUpdate(state: Partial<ReturnType<typeof useUpdateFullName>> = {}) {
	useUpdateFullNameMock.mockReturnValue({
		mutate,
		isPending: false,
		isSuccess: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useUpdateFullName>);
}

function fillName(value: string) {
	fireEvent.change(screen.getByLabelText("Nombre completo"), {
		target: { value },
	});
}

function submit() {
	fireEvent.click(
		screen.getByRole("button", {
			name: /Guardar nombre|Guardando.../,
		}),
	);
}

describe("FullNameForm", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockUpdate();
	});

	it("renders the labeled field and the submit button", () => {
		render(<FullNameForm />);

		expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeTruthy();
	});

	it("reports an empty submit locally with aria wiring and focus, without calling the API", () => {
		render(<FullNameForm />);

		submit();

		const input = screen.getByLabelText("Nombre completo") as HTMLInputElement;
		const error = screen.getByText("Ingresá tu nombre completo.");
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toBe(error.id);
		expect(document.activeElement).toBe(input);
		expect(mutate).not.toHaveBeenCalled();
	});

	it("reports a too-long name locally without calling the API", () => {
		render(<FullNameForm />);
		fillName("a".repeat(121));

		submit();

		expect(screen.getByText("Usá 120 caracteres como máximo.")).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
	});

	it("clears the error while the user corrects the name", () => {
		render(<FullNameForm />);

		submit();
		fillName("Ana Pérez");

		expect(screen.queryByText("Ingresá tu nombre completo.")).toBeNull();
	});

	it("sends the trimmed name when submitted", () => {
		render(<FullNameForm />);
		fillName("  Ana Pérez  ");

		submit();

		// The component attaches mutation options (the success toast and the
		// field reset); the payload must stay exactly the trimmed name.
		expect(mutate).toHaveBeenCalledWith(
			{ fullName: "Ana Pérez" },
			expect.any(Object),
		);
	});

	it("shows the API message when the update fails", () => {
		mockUpdate({
			isError: true,
			error: new ApiError("El nombre es demasiado largo", 400),
		});
		render(<FullNameForm />);

		expect(screen.getByText("No pudimos guardar tu nombre")).toBeTruthy();
		expect(screen.getByText("El nombre es demasiado largo")).toBeTruthy();
	});

	it("shows a fallback message on a non-ApiError failure", () => {
		mockUpdate({ isError: true, error: new Error("network down") });
		render(<FullNameForm />);

		expect(
			screen.getByText("No pudimos guardar tu nombre. Probá de nuevo."),
		).toBeTruthy();
	});

	it("disables the field and the button while the update is in flight", () => {
		mockUpdate({ isPending: true });
		render(<FullNameForm />);

		expect(screen.getByLabelText("Nombre completo")).toHaveProperty(
			"disabled",
			true,
		);
		// The button also hosts SpinnerMotion, whose status label ("Cargando")
		// prefixes the accessible name, so the pending label is matched by
		// regex instead of the exact string.
		expect(
			screen.getByRole("button", { name: /Guardando\.\.\./ }),
		).toHaveProperty("disabled", true);
	});
});

describe("User", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockUpdate();
		mockMe();
	});

	it("shows the current user's name and the full-name form", () => {
		render(<User />);

		expect(screen.getByRole("heading", { name: "Ana Pérez" })).toBeTruthy();
		expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeTruthy();
	});

	it("mounts the pending-invitations section for a user who already has a company", () => {
		// The whole reason this mount exists: `/sin-empresas` is only reachable
		// with zero companies, so the panel is the only place where an existing
		// member can discover and accept the invitation to the next company.
		render(<User />);

		expect(
			screen.getByRole("heading", { name: "Invitaciones pendientes" }),
		).toBeTruthy();
	});
});
