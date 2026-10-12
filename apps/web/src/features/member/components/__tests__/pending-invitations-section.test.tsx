import { render, screen } from "@testing-library/react";
import type { PendingInvitation } from "@/lib/api/schemas";
import { formatDate } from "@/src/features/dashboard/mock";
import { usePendingInvitations } from "../../api/use-pending-invitations";
import { AcceptInvitationsAction } from "../accept-invitations-action";
import { PendingInvitationsSection } from "../pending-invitations-section";

jest.mock("../../api/use-pending-invitations", () => ({
	usePendingInvitations: jest.fn(),
}));

jest.mock("../accept-invitations-action", () => ({
	AcceptInvitationsAction: jest.fn(() => null),
}));

const usePendingInvitationsMock = usePendingInvitations as jest.MockedFunction<
	typeof usePendingInvitations
>;
const acceptInvitationsActionMock =
	AcceptInvitationsAction as jest.MockedFunction<
		typeof AcceptInvitationsAction
	>;

function invitation(
	overrides: Partial<PendingInvitation> = {},
): PendingInvitation {
	return {
		membershipId: "m1",
		companyId: "c1",
		role: "MEMBER",
		invitedAt: "2026-01-02T03:04:05.000Z",
		company: {
			id: "c1",
			name: "Acme",
			createdAt: "2026-01-01T00:00:00.000Z",
		},
		inviter: { id: "u1", fullName: "Ana Pérez", email: "ana@empresa.com" },
		...overrides,
	};
}

function mockPending(
	data: PendingInvitation[] | undefined,
	state: Record<string, unknown> = {},
) {
	usePendingInvitationsMock.mockReturnValue({
		data,
		isPending: false,
		isError: false,
		refetch: jest.fn(),
		...state,
	} as unknown as ReturnType<typeof usePendingInvitations>);
}

describe("PendingInvitationsSection", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders nothing when there are no pending invitations", () => {
		mockPending([]);

		const { container } = render(<PendingInvitationsSection />);

		expect(container.firstChild).toBeNull();
		expect(
			screen.queryByRole("heading", { name: "Invitaciones pendientes" }),
		).toBeNull();
	});

	it("renders nothing while the read is still in flight", () => {
		// The section is conditional, so an unresolved read must not flash an
		// empty card: it stays hidden until there is something to show.
		mockPending(undefined, { isPending: true });

		const { container } = render(<PendingInvitationsSection />);

		expect(container.firstChild).toBeNull();
	});

	it("lists each invitation with its company, role and date", () => {
		mockPending([invitation({ role: "ADMIN" })]);

		render(<PendingInvitationsSection />);

		expect(
			screen.getByRole("heading", { name: "Invitaciones pendientes" }),
		).toBeTruthy();
		expect(screen.getByText("Acme")).toBeTruthy();
		expect(screen.getByText(/Rol ofrecido: Administrador/)).toBeTruthy();
		// The exact day depends on the test runner's timezone, so the expected
		// label is produced by the same formatter the component uses.
		expect(
			screen.getByText(
				new RegExp(`Enviada el ${formatDate(invitation().invitedAt)}`),
			),
		).toBeTruthy();
	});

	it("prefers the inviter's full name", () => {
		mockPending([invitation()]);

		render(<PendingInvitationsSection />);

		expect(screen.getByText("Invitación de Ana Pérez")).toBeTruthy();
	});

	it("falls back to the inviter's email when there is no name", () => {
		mockPending([
			invitation({
				inviter: { id: "u1", fullName: null, email: "ana@empresa.com" },
			}),
		]);

		render(<PendingInvitationsSection />);

		expect(screen.getByText("Invitación de ana@empresa.com")).toBeTruthy();
	});

	it("falls back to a neutral label when the inviter could not be resolved", () => {
		mockPending([invitation({ inviter: null })]);

		render(<PendingInvitationsSection />);

		expect(
			screen.getByText("Invitación de un administrador de la empresa"),
		).toBeTruthy();
	});

	it("keeps the accept action in its panel variant", () => {
		mockPending([invitation()]);

		render(<PendingInvitationsSection />);

		expect(acceptInvitationsActionMock.mock.calls[0]?.[0]).toEqual({
			variant: "panel",
		});
	});
});
