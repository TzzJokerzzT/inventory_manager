import { Skeleton } from "@/components/ui/skeleton";

const ROSTER_ROWS = ["first", "second", "third", "fourth"] as const;

/** Invite form + roster + leave action. Used while `useMembers` is pending. */
export function MembersListSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			{/* Invite form */}
			<div className="flex flex-col gap-3 sm:flex-row">
				<Skeleton className="h-12 w-full sm:flex-1" />
				<Skeleton className="h-12 w-full sm:w-40" />
				<Skeleton className="h-12 w-full sm:w-32" />
			</div>

			{/* Roster */}
			<div className="overflow-hidden rounded-md border border-border bg-surface">
				<div className="flex h-13 items-center border-b border-border bg-surface-muted px-4">
					<Skeleton className="h-3 w-24" />
				</div>
				{ROSTER_ROWS.map((row) => (
					<div
						key={row}
						className="flex h-13 items-center gap-3 border-b border-border px-4 last:border-b-0"
					>
						<div className="flex min-w-0 flex-1 flex-col gap-1.5">
							<Skeleton className="h-4 w-32 max-w-full" />
							<Skeleton className="h-3 w-44 max-w-full" />
						</div>
						<Skeleton className="h-6 w-20 shrink-0 rounded-full" />
					</div>
				))}
			</div>

			{/* Leave company */}
			<Skeleton className="h-10 w-full sm:w-44" />
		</div>
	);
}

/** Whole members card, with its header, for the page-level skeleton. */
export function MembersSectionSkeleton() {
	return (
		<div className="flex w-full flex-col gap-6 rounded-md border border-border bg-surface p-4 sm:p-6 lg:p-8">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<Skeleton className="h-7 w-56 max-w-full" />
					<Skeleton className="h-5 w-72 max-w-full" />
				</div>
				<MembersListSkeleton />
			</div>
		</div>
	);
}
