import { OG_IMAGE, rootMetadata, SITE } from "../site-metadata";

/**
 * What a link preview promises.
 *
 * These assertions are the contract with the crawler: WhatsApp, Slack, X and
 * LinkedIn read `og:*` and `twitter:*` and nothing else. A refactor that drops
 * `og:image` or leaves `metadataBase` out (which makes the image a relative URL
 * they cannot resolve) still renders a beautiful app and a blank preview, and
 * nothing else in the suite would notice.
 */
describe("site metadata", () => {
	it("declares the name, the description and a resolvable base", () => {
		expect(rootMetadata.openGraph?.siteName).toBe("Inventory Manager");
		expect(rootMetadata.description).toContain("inventario");
		// Without an absolute base the image URL stays relative and previews
		// show no image at all.
		expect(rootMetadata.metadataBase).toBeInstanceOf(URL);
		expect(String(rootMetadata.metadataBase)).toMatch(/^https?:\/\//);
	});

	it("points the Open Graph card at the generated image", () => {
		const images = rootMetadata.openGraph?.images;

		expect(images).toBeTruthy();
		expect(images).toEqual([OG_IMAGE]);
		expect(OG_IMAGE.width).toBe(1200);
		expect(OG_IMAGE.height).toBe(630);
		// The alt text is what a screen reader announces instead of the image.
		expect(OG_IMAGE.alt.length).toBeGreaterThan(10);
	});

	it("asks for the wide Twitter card so the image is not cropped away", () => {
		const twitter = rootMetadata.twitter;

		// `twitter` is a union of card shapes: only the ones that name a card
		// carry the field, so it is narrowed instead of cast away.
		expect(twitter && "card" in twitter ? twitter.card : undefined).toBe(
			"summary_large_image",
		);
		expect(twitter && "images" in twitter ? twitter.images : undefined).toEqual(
			[OG_IMAGE.url],
		);
	});

	it("reuses the logo as the tab icon", () => {
		const icons = rootMetadata.icons;
		// `icons` is a union of a single URL, a list and a keyed object; only the
		// keyed shape has `icon`.
		const icon =
			icons && typeof icons === "object" && "icon" in icons
				? icons.icon
				: undefined;

		expect(icon).toBe("/logo.png");
	});

	it("falls back to the local host when no platform URL is set", () => {
		// The suite runs without VERCEL_URL on purpose: the default has to be
		// valid, because a build with no env still ships this page.
		expect(SITE.url.origin).toMatch(/^https?:\/\//);
		expect(SITE.locale).toBe("es_AR");
	});
});
