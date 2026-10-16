"use client";

import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import type { ComponentProps, ElementType } from "react";

type MotionTagName = keyof typeof m & keyof React.JSX.IntrinsicElements;

type MotionTagProps<T extends MotionTagName> = {
	tag?: T;
} & ComponentProps<(typeof m)[T]>;

export function LazyMotionTag<T extends MotionTagName = "div">({
	tag = "div" as T,
	...props
}: MotionTagProps<T>) {
	// biome-ignore lint/performance/noDynamicNamespaceImportAccess: lista pequeña y controlada
	const Component = m[tag] as ElementType;
	return (
		<LazyMotion features={domAnimation}>
			<Component {...props} />
		</LazyMotion>
	);
}
