import type { ReactNode } from "react";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

export function Provider({ children }: { children: ReactNode }) {
	return (
		<QueryProvider>
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				{children}
			</ThemeProvider>
		</QueryProvider>
	);
}
