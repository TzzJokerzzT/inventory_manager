import type { Metadata } from "next";

/**
 * Everything a link preview needs, in one place.
 *
 * The card is what a stranger sees **before** they open the app: the name, one
 * sentence saying what it is for, and the logo. So these values are copy, not
 * config — they live here instead of inside `layout.tsx` so a test can read
 * them without pulling `next/font` and the whole provider tree.
 */

const NAME = "Inventory Manager";

const DESCRIPTION =
	"Controlá el inventario de tu empresa: productos, clientes, compras por medida y salidas de stock en un panel, con equipo y roles.";

/**
 * The base the crawlers resolve relative URLs against.
 *
 * `VERCEL_URL` is set by the platform on every build, so the default deploy
 * previews with its own host instead of `localhost`; a custom domain sets
 * `NEXT_PUBLIC_SITE_URL` once and wins over it.
 */
function siteUrl(): URL {
	const explicit = process.env.NEXT_PUBLIC_SITE_URL;
	if (explicit) {
		try {
			return new URL(explicit);
		} catch {
			// A malformed value must not break the build: fall through to the
			// platform host, and finally to the documented local default.
		}
	}
	if (process.env.VERCEL_URL) {
		return new URL(`https://${process.env.VERCEL_URL}`);
	}
	return new URL("http://localhost:3000");
}

/** The generated card in `app/opengraph-image.tsx`, with its real dimensions. */
export const OG_IMAGE = {
	url: "/opengraph-image",
	width: 1200,
	height: 630,
	alt: `${NAME}: control de inventario multi-empresa`,
};

/** The prose a preview shows, reused by the landing page and its metadata. */
export const SITE = {
	name: NAME,
	description: DESCRIPTION,
	locale: "es_AR",
	url: siteUrl(),
} as const;

export const rootMetadata: Metadata = {
	// Pages that care about their own title (login, registro) declare it
	// themselves; this is the default a visitor gets on the landing.
	title: `${NAME} — control de inventario multi-empresa`,
	description: DESCRIPTION,
	metadataBase: SITE.url,
	applicationName: NAME,
	// The logo is the same file the app uses in its header, so the tab and the
	// preview never disagree about the brand.
	icons: { icon: "/logo.png", apple: "/logo.png" },
	openGraph: {
		type: "website",
		siteName: NAME,
		title: `${NAME} — control de inventario multi-empresa`,
		description: DESCRIPTION,
		url: "/",
		locale: SITE.locale,
		images: [OG_IMAGE],
	},
	twitter: {
		// A wide card shows the logo, the name and the description together;
		// the small one crops the image away and leaves only the text.
		card: "summary_large_image",
		title: `${NAME} — control de inventario multi-empresa`,
		description: DESCRIPTION,
		images: [OG_IMAGE.url],
	},
};
