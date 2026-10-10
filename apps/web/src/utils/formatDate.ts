export function formatDate(iso: string) {
	return new Intl.DateTimeFormat("es-CO", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "America/Bogota",
	})
		.format(new Date(iso))
		.replaceAll("/", "-");
}
