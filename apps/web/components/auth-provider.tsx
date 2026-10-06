"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
	return (
		<Auth0Provider
			domain="dev-gewi4ex6jxartb8r.us.auth0.com"
			clientId="L7FWJWExsXmsl3fMDlptKDaRBbZGY2aC"
			authorizationParams={{ redirect_uri: window.location.origin }}
		>
			{children}
		</Auth0Provider>
	);
}
