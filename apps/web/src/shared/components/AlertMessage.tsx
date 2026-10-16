"use client";

import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { Alert } from "@/components/design-system";

type AlertMessageProps = {
	message: string;
	title: string;
	variant?: "success" | "danger" | "warning";
};

export function AlertMessage({
	message,
	title,
	variant = "success",
}: AlertMessageProps) {
	return (
		<LazyMotion features={domAnimation}>
			<m.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5 }}
			>
				<Alert variant={variant} title={title}>
					{message}
				</Alert>
			</m.div>
		</LazyMotion>
	);
}
