// `next/og` builds a Web `Response`, which this jsdom environment does not
// polyfill; the assertions below are about the module's declared contract, not
// about the rendered PNG, so the renderer is stubbed instead of emulated.
jest.mock("next/og", () => ({ ImageResponse: jest.fn() }));

import * as opengraph from "../opengraph-image";

/**
 * The card route's own contract.
 *
 * Next reads `size`, `contentType` and `alt` from the module to build the
 * `<meta>` tags; if `size` stops matching what the image actually renders, the
 * crawlers scale it and the text goes soft.
 */
describe("opengraph image route", () => {
	it("publishes a 1200x630 PNG, the size every preview expects", () => {
		expect(opengraph.size).toEqual({ width: 1200, height: 630 });
		expect(opengraph.contentType).toBe("image/png");
	});

	it("describes the image for people who cannot see it", () => {
		expect(opengraph.alt).toContain("Inventory Manager");
	});
});
