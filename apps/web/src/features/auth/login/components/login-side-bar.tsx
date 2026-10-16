import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { data } from "../utils/constants";
import { LoginForm } from "./login-form";

export default function LoginSideBar() {
	return (
		<div className="grid min-h-screen grid-cols-1 lg:grid-cols-[43fr_57fr]">
			<LazyMotion features={domAnimation}>
				<m.aside
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.5 }}
					data-slot="login-brand"
					className="hidden flex-col bg-sidebar p-8 lg:flex xl:p-12"
				>
					<div className="flex items-center gap-3">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary">
							<div className="size-3 rounded-[3px] bg-white" />
						</div>
						<span className="text-base font-bold text-sidebar-foreground">
							{data.maintitle}
						</span>
					</div>

					<div className="flex flex-1 flex-col justify-center gap-6">
						<h1 className="text-4xl font-bold leading-tight text-sidebar-foreground">
							{data.title}
						</h1>
						<p className="text-base text-sidebar-foreground/80">
							{data.subtitle}
						</p>
						<ul className="flex flex-col gap-3">
							{data.capabilities.map((capability) => (
								<li
									key={capability}
									className="flex items-center gap-3 text-sidebar-foreground/90"
								>
									<span
										aria-hidden="true"
										className="size-2 shrink-0 rounded-full bg-primary"
									/>
									<span>{capability}</span>
								</li>
							))}
						</ul>
					</div>

					<p className="text-sm text-sidebar-foreground/70">{data.footer}</p>
				</m.aside>
			</LazyMotion>

			<main
				data-slot="login-form-column"
				className="flex items-center justify-center bg-background px-4 py-10 sm:px-6 lg:items-start lg:pt-[13.5vh]"
			>
				<LoginForm />
			</main>
		</div>
	);
}
