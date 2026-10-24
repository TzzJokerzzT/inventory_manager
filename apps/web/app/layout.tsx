import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { rootMetadata } from "@/src/features/marketing/site-metadata";
import { Provider } from "@/src/providers/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = localFont({
	src: "./fonts/GeistVF.woff",
	variable: "--font-geist-sans",
});
const geistMono = localFont({
	src: "./fonts/GeistMonoVF.woff",
	variable: "--font-geist-mono",
});

/**
 * Title, description and the share card live in `site-metadata.ts`: the card is
 * copy that a test reads, and importing it here would drag `next/font` and the
 * provider tree into every test that only wants to check a tag.
 */
export const metadata = rootMetadata;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			// The whole interface is Spanish; the document language drives
			// hyphenation, spell-check and how a screen reader pronounces it.
			lang="es"
			suppressHydrationWarning
			className={cn("font-sans", inter.variable)}
		>
			<body className={`${geistSans.variable} ${geistMono.variable}`}>
				<Provider>{children}</Provider>
			</body>
		</html>
	);
}
