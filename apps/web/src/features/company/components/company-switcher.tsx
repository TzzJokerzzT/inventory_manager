"use client";

import { cn } from "cn";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useCompanies } from "../api/use-companies";
import {
	selectActiveCompany,
	shouldShowCompanySwitcher,
} from "../store/company-selectors";
import { useCompanyStore } from "../store/company-store";

/**
 * Company switcher shown in the dashboard top bar.
 *
 * Acceptance criterion 3: it renders nothing with zero or one company. With
 * two or more it shows the trigger from the mockup (coloured dot, active
 * company name, chevron) and a menu that makes another company active.
 *
 * The panel is a simple absolutely-positioned list: the app shell does not
 * exist yet, so positioning polish belongs to the dashboard view task.
 */
export function CompanySwitcher() {
	const { data: companies } = useCompanies();
	const activeCompanyId = useCompanyStore((state) => state.activeCompanyId);
	const setActiveCompanyId = useCompanyStore(
		(state) => state.setActiveCompanyId,
	);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open]);

	if (!shouldShowCompanySwitcher(companies)) {
		return null;
	}

	const activeCompany = selectActiveCompany(companies, activeCompanyId);
	const list = companies ?? [];

	return (
		<div className="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary hover:bg-surface-muted"
			>
				<span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
				<span>{activeCompany?.name}</span>
				<ChevronDown
					aria-hidden="true"
					className={cn(
						"size-4 text-text-muted transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>

			{open ? (
				<div
					role="menu"
					className="absolute top-full left-0 z-10 mt-2 w-full min-w-48 overflow-hidden rounded-md border border-border bg-surface shadow-md"
				>
					{list.map((company) => {
						const isActive = company.id === activeCompany?.id;

						return (
							<button
								key={company.id}
								type="button"
								role="menuitem"
								aria-current={isActive ? "true" : undefined}
								onClick={() => {
									setActiveCompanyId(company.id);
									setOpen(false);
								}}
								className={cn(
									"flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-muted",
									isActive && "bg-primary-soft font-medium",
								)}
							>
								<span
									aria-hidden="true"
									className="size-2.5 rounded-full bg-primary"
								/>
								<span className="flex-1">{company.name}</span>
								{isActive ? (
									<Check aria-hidden="true" className="size-4 text-primary" />
								) : null}
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
