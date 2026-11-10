import type { LegacyDoc } from "../../app/src/core/types.ts";
import schema14 from "./generated/wordpress-schema14.cjs";
import * as production from "./portable-packages.ts";

/** Staging can write schema 14 documents to the shared store. Read those with
 * the matching renderer in the manual WordPress export endpoints. Older and
 * unsupported documents keep the production package builder's existing behavior. */
export function wordpressPortablePackages(
  document: Pick<LegacyDoc, "schemaVersion" | "v">,
) {
  const schemaVersion = document?.schemaVersion ?? document?.v;
  return schemaVersion === 14 ? schema14 : production;
}
