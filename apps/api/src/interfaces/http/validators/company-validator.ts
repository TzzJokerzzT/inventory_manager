import * as v from "valibot";

/**
 * Request schema for `POST /companies`.
 *
 * `trim` runs before `minLength` so a whitespace-only name is rejected at the
 * edge, mirroring the domain invariant on {@link Company.create}.
 */
export const createCompanySchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1, "name must not be empty")),
});
