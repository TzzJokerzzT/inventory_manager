import { LandingContact } from "@/src/features/landing/components/landing-contact";
import { LandingFeatures } from "@/src/features/landing/components/landing-features";
import {
	LandingFooter,
	LandingFree,
} from "@/src/features/landing/components/landing-free";
import { LandingHero } from "@/src/features/landing/components/landing-hero";
import { LandingNav } from "@/src/features/landing/components/landing-nav";
import { LandingSteps } from "@/src/features/landing/components/landing-steps";

/**
 * Public landing page, served at `/`.
 *
 * It replaces the placeholder that lived here and is the face of the product
 * for anyone without a session: it explains what Inventory Manager is, what it
 * does, how little it takes to start, and that it is free, with `/login` as the
 * single door into the app.
 *
 * Every section is a server component, so the whole page is static HTML with no
 * client bundle: it is the first paint a stranger sees, often on a phone.
 */
export default function Home() {
	return (
		<div className="min-h-dvh bg-background">
			<LandingNav />
			<main>
				<LandingHero />
				<LandingFeatures />
				<LandingSteps />
				<LandingFree />
				<LandingContact />
			</main>
			<LandingFooter />
		</div>
	);
}
