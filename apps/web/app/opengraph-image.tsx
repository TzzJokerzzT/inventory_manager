import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG_IMAGE, SITE } from "@/src/features/marketing/site-metadata";

export const alt = OG_IMAGE.alt;
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = "image/png";

/** Brand tokens, copied from `app/globals.css` so the card matches the app. */
const INK = "#0f172a";
const MUTED = "#475569";
const PRIMARY = "#4f46e5";
const PAPER = "#f8fafc";

/**
 * The share card: logo, name and what the app does, in one image.
 *
 * `next/og` renders a subset of CSS, so everything here is inline and plain
 * flexbox on purpose — no Tailwind classes, no external stylesheet. The logo is
 * read from `public/` at build time and inlined as a data URL: the card has to
 * be a single self-contained PNG, because the crawler caches only the image.
 *
 * The route is static (`export const dynamic = "force-static"` is the default
 * for a metadata image route), so this file is executed when the site is built,
 * never per request.
 */
export default async function OpengraphImage() {
	const logo = await readFile(join(process.cwd(), "public", "logo.png"));
	const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: PAPER,
				padding: "60px 72px",
				borderTop: `12px solid ${PRIMARY}`,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 24 }}>
				{/* biome-ignore lint/performance/noImgElement: ImageResponse renders a PNG, not HTML; next/image does not exist here. */}
				<img
					src={logoDataUrl}
					alt=""
					width={96}
					height={96}
					style={{ borderRadius: 20 }}
				/>
				<div
					style={{ display: "flex", fontSize: 40, fontWeight: 700, color: INK }}
				>
					{SITE.name}
				</div>
			</div>

			{/*
			 * The middle band takes the leftover height and centres itself, so the
			 * footer can never be pushed into the description: whatever the text
			 * length, the gap belongs to this block.
			 */}
			<div
				style={{
					display: "flex",
					flex: 1,
					flexDirection: "column",
					justifyContent: "center",
					gap: 20,
				}}
			>
				<div
					style={{
						display: "flex",
						fontSize: 54,
						fontWeight: 700,
						lineHeight: 1.15,
						letterSpacing: -1.2,
						color: INK,
						maxWidth: 940,
					}}
				>
					El inventario de tu empresa, en un solo panel
				</div>
				<div
					style={{
						display: "flex",
						fontSize: 27,
						lineHeight: 1.4,
						color: MUTED,
						maxWidth: 900,
					}}
				>
					{SITE.description}
				</div>
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 14,
					fontSize: 24,
					fontWeight: 600,
					color: PRIMARY,
				}}
			>
				<div
					style={{
						display: "flex",
						width: 9,
						height: 9,
						borderRadius: 999,
						backgroundColor: PRIMARY,
					}}
				/>
				Multi-empresa · Equipo y roles · Gratis
			</div>
		</div>,
		size,
	);
}
