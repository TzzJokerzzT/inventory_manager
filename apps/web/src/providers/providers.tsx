import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

export function Provider({ children }: { children: ReactNode }) {
	return (
		<QueryProvider>
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				{children}
				<Toaster />
			</ThemeProvider>
		</QueryProvider>
	);
}
