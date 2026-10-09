import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";

type SpinnerProps = {
	size?: number; // px
	className?: string;
};

export function SpinnerMotion({ size = 40, className = "" }: SpinnerProps) {
	return (
		<LazyMotion features={domAnimation}>
			<m.div
				role="status"
				aria-label="Cargando"
				style={{ width: size, height: size }}
				className={`rounded-full border-4 border-gray-200 border-t-primary ${className}`}
				animate={{ rotate: 360 }}
				transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
			/>
		</LazyMotion>
	);
}
