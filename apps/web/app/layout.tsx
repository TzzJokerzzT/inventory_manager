import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
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

export const metadata: Metadata = {
	// Pages that care about their own title (login, registro) declare it
	// themselves; this is the default a visitor gets on the landing.
	title: "Inventory Manager — control de inventario multi-empresa",
	description:
		"Gestioná productos, clientes y entradas y salidas de stock en un solo panel. Multi-empresa, con equipo y roles, y gratis.",
};

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
