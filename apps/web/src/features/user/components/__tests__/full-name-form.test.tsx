import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { useUpdateFullName } from "../../api/use-update-full-name";
import { FullNameForm } from "../full-name-form";
import { User } from "../user";

jest.mock("../../api/use-update-full-name", () => ({
	useUpdateFullName: jest.fn(),
}));

const useUpdateFullNameMock = useUpdateFullName as jest.MockedFunction<
	typeof useUpdateFullName
>;
const mutate = jest.fn();

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

		expect(mutate).toHaveBeenCalledWith({ fullName: "Ana Pérez" });
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
		expect(screen.getByRole("button", { name: "Guardando..." })).toHaveProperty(
			"disabled",
			true,
		);
	});
});

describe("User", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockUpdate();
	});

	it("shows the profile heading and the full-name form", () => {
		render(<User />);

		expect(screen.getByRole("heading", { name: "Tu perfil" })).toBeTruthy();
		expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeTruthy();
	});
});
