import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, getApiClient } from "@/lib/api/client";
import { useUploadProductPhoto } from "../use-upload-product-photo";

jest.mock("@/lib/api/client", () => ({
	...jest.requireActual("@/lib/api/client"),
	getApiClient: jest.fn(),
}));

const getApiClientMock = getApiClient as jest.MockedFunction<
	typeof getApiClient
>;

const SECURE_URL = "https://res.cloudinary.com/demo/image/upload/cafe.jpg";

function signature(overrides: Record<string, unknown> = {}) {
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

function image(name: string, type: string, size = 1024) {
	const file = new File([new Uint8Array(1)], name, { type });
	// jsdom keeps the real byte length; the size the rule reads is overridden.
	Object.defineProperty(file, "size", { value: size });
	return file;
}

function mockSignature(data: unknown) {
	const post = jest.fn(async () => ({ data }));
	getApiClientMock.mockReturnValue({
		post,
	} as unknown as ReturnType<typeof getApiClient>);
	return post;
}

function wrapperFor(queryClient: QueryClient) {
	return function wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function renderUpload(fetchImpl: jest.Mock) {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	return renderHook(
		() => useUploadProductPhoto("c1", fetchImpl as unknown as typeof fetch),
		{ wrapper: wrapperFor(queryClient) },
	);
}

function okFetch(url = SECURE_URL) {
	return jest.fn(async () => ({
		ok: true,
		status: 200,
		json: async () => ({ secure_url: url }),
	}));
}

describe("useUploadProductPhoto", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("rejects an oversized file before uploading a byte", async () => {
		const post = mockSignature(signature());
		const fetchImpl = jest.fn();

		const { result } = renderUpload(fetchImpl);

		await expect(
			result.current.mutateAsync(
				image("foto.jpg", "image/jpeg", 5 * 1024 * 1024 + 1),
			),
		).rejects.toThrow(/no puede superar los 5 MB/);
		expect(post).toHaveBeenCalledWith("/companies/c1/media/signature");
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("rejects a format the signature does not allow before uploading", async () => {
		mockSignature(signature());
		const fetchImpl = jest.fn();

		const { result } = renderUpload(fetchImpl);

		await expect(
			result.current.mutateAsync(image("foto.gif", "image/gif")),
		).rejects.toThrow(/jpg, png, webp/);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("reports the rejection as an ApiError a view can render", async () => {
		mockSignature(signature());
		const fetchImpl = jest.fn();

		const { result } = renderUpload(fetchImpl);

		await expect(
			result.current.mutateAsync(image("foto.gif", "image/gif")),
		).rejects.toBeInstanceOf(ApiError);
	});

	it("sends the signed parameters to the cloud and returns the secure url", async () => {
		mockSignature(signature());
		const fetchImpl = okFetch();

		const { result } = renderUpload(fetchImpl);

		const url = await result.current.mutateAsync(
			image("foto.jpg", "image/jpeg"),
		);

		expect(url).toBe(SECURE_URL);
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		const calls = fetchImpl.mock.calls as unknown as [
			string,
			{ method: string; body: FormData },
		][];
		const [calledUrl, init] = calls[0];
		expect(calledUrl).toBe(
			"https://api.cloudinary.com/v1_1/demo-cloud/image/upload",
		);
		expect(init.method).toBe("POST");

		const body = init.body;
		expect(body.get("api_key")).toBe("123456789");
		expect(body.get("timestamp")).toBe("1760000000");
		expect(body.get("signature")).toBe("abc123deadbeef");
		expect(body.get("folder")).toBe("companies/c1/products");
		expect(body.get("allowed_formats")).toBe("jpg,png,webp");
		expect((body.get("file") as File).name).toBe("foto.jpg");
	});

	it("rejects a response whose secure_url is not an http(s) url", async () => {
		mockSignature(signature());
		const fetchImpl = okFetch("javascript:alert(1)");

		const { result } = renderUpload(fetchImpl);

		await expect(
			result.current.mutateAsync(image("foto.jpg", "image/jpeg")),
		).rejects.toThrow(/respuesta inesperada/);
	});

	it("rejects a response without secure_url", async () => {
		mockSignature(signature());
		const fetchImpl = jest.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ public_id: "cafe" }),
		}));

		const { result } = renderUpload(fetchImpl);

		await expect(
			result.current.mutateAsync(image("foto.jpg", "image/jpeg")),
		).rejects.toThrow(/respuesta inesperada/);
	});

	it("reports an upload the storage provider refused", async () => {
		mockSignature(signature());
		const fetchImpl = jest.fn(async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: { message: "Invalid signature" } }),
		}));

		const { result } = renderUpload(fetchImpl);

		await expect(
			result.current.mutateAsync(image("foto.jpg", "image/jpeg")),
		).rejects.toThrow(/No pudimos subir la foto/);
	});

	it("refuses to upload when the signature itself changed shape", async () => {
		mockSignature({ cloudName: "demo-cloud" });
		const fetchImpl = jest.fn();

		const { result } = renderUpload(fetchImpl);

		await expect(
			result.current.mutateAsync(image("foto.jpg", "image/jpeg")),
		).rejects.toThrow(/respuesta inesperada/);
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});
