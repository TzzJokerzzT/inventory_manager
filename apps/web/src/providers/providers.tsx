import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { IdleSessionGuard } from "@/src/features/auth/session/idle-session-guard";
import { SessionBootstrap } from "@/src/features/auth/session/session-bootstrap";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

export function Provider({ children }: { children: ReactNode }) {
	return (
		<QueryProvider>
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				<SessionBootstrap />
				<IdleSessionGuard />
				{children}
				<Toaster />
			</ThemeProvider>
		</QueryProvider>
	);
}
