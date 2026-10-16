import * as v from "valibot";

/**
 * Request schema for `PATCH /me`.
 *
 * `fullName` is required and is either `null` or a string of at most 120
 * characters after trimming. The trim runs before `maxLength` so the cap
 * counts the value that will actually be stored, and an empty or
 * whitespace-only string passes on purpose: clearing the name is a valid
 * action, so `""` is input, not a validation failure.
 *
 * The 120 cap is an input rule and lives here (answered with 400), not in the
 * domain entity: enforcing it there would surface as a 422 from the domain
 * error path instead of the contract's 400.
 */
export const updateMeSchema = v.object({
	fullName: v.nullable(
		v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(120, "fullName must be at most 120 characters"),
		),
	),
});
