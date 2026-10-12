import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { MeNotification } from "@/lib/api/schemas";
import { useMarkNotificationsRead } from "../../api/use-mark-notifications-read";
import { useNotifications } from "../../api/use-notifications";
import { NotificationsSection } from "../notifications-section";

jest.mock("../../api/use-notifications", () => ({
	useNotifications: jest.fn(),
}));

jest.mock("../../api/use-mark-notifications-read", () => ({
	useMarkNotificationsRead: jest.fn(),
}));

const useNotificationsMock = useNotifications as jest.MockedFunction<
	typeof useNotifications
>;
const useMarkNotificationsReadMock =
	useMarkNotificationsRead as jest.MockedFunction<
		typeof useMarkNotificationsRead
	>;
const mutate = jest.fn();

function notification(overrides: Partial<MeNotification> = {}): MeNotification {
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
		...overrides,
	};
}

function mockNotifications(
	data: MeNotification[] | undefined,
	state: Record<string, unknown> = {},
) {
	useNotificationsMock.mockReturnValue({
		data,
		isPending: false,
		isError: false,
		refetch: jest.fn(),
		...state,
	} as unknown as ReturnType<typeof useNotifications>);
}

function mockMarkRead(
	state: Partial<ReturnType<typeof useMarkNotificationsRead>> = {},
) {
	useMarkNotificationsReadMock.mockReturnValue({
		mutate,
		isPending: false,
		isError: false,
		error: undefined,
		...state,
	} as unknown as ReturnType<typeof useMarkNotificationsRead>);
}

describe("NotificationsSection", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockMarkRead();
	});

	it("renders nothing when there are no notifications", () => {
		mockNotifications([]);

		const { container } = render(<NotificationsSection />);

		expect(container.firstChild).toBeNull();
		expect(
			screen.queryByRole("heading", { name: "Notificaciones" }),
		).toBeNull();
	});

	it("renders nothing while the read is still in flight", () => {
		// The section is conditional, so an unresolved read must not flash an
		// empty card: it stays hidden until there is something to show.
		mockNotifications(undefined, { isPending: true });

		const { container } = render(<NotificationsSection />);

		expect(container.firstChild).toBeNull();
	});

	it("says what happened, naming the company when it resolved", () => {
		mockNotifications([notification()]);

		render(<NotificationsSection />);

		expect(
			screen.getByRole("heading", { name: "Notificaciones" }),
		).toBeTruthy();
		expect(
			screen.getByText("Alguien aceptó tu invitación a Acme."),
		).toBeTruthy();
	});

	it("falls back to neutral copy when the company could not be resolved", () => {
		mockNotifications([notification({ company: null })]);

		render(<NotificationsSection />);

		expect(screen.getByText("Alguien aceptó tu invitación.")).toBeTruthy();
	});

	it("degrades an unknown event type to a neutral sentence", () => {
		mockNotifications([notification({ type: "company.renamed" })]);

		render(<NotificationsSection />);

		expect(screen.queryByText(/undefined/)).toBeNull();
		expect(screen.getByText("Tenés una novedad en Acme.")).toBeTruthy();
	});

	it("marks unread rows and leaves read rows unmarked", () => {
		mockNotifications([
			notification({ id: "n1" }),
			notification({
				id: "n2",
				readAt: "2026-10-07T00:00:00.000Z",
			}),
		]);

		render(<NotificationsSection />);

		expect(screen.getAllByText("Nueva")).toHaveLength(1);
	});

	it("marks every notification as read with the single action", () => {
		mockNotifications([notification()]);

		render(<NotificationsSection />);
		fireEvent.click(
			screen.getByRole("button", { name: "Marcar todas como leídas" }),
		);

		expect(mutate).toHaveBeenCalled();
	});

	it("hides the mark-all action when everything is already read", () => {
		mockNotifications([notification({ readAt: "2026-10-07T00:00:00.000Z" })]);

		render(<NotificationsSection />);

		expect(
			screen.queryByRole("button", { name: "Marcar todas como leídas" }),
		).toBeNull();
	});

	it("shows the API message when marking as read fails", () => {
		mockNotifications([notification()]);
		mockMarkRead({
			isError: true,
			error: new ApiError("No autorizado", 403),
		});

		render(<NotificationsSection />);

		expect(screen.getByText("No autorizado")).toBeTruthy();
	});

	it("shows a busy state while marking as read", () => {
		mockNotifications([notification()]);
		mockMarkRead({ isPending: true });

		render(<NotificationsSection />);

		expect(
			screen.getByRole("button", { name: /Marcando\.\.\./ }),
		).toHaveProperty("disabled", true);
	});
});
