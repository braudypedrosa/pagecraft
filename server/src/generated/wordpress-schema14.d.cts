import type * as production from "../portable-packages.ts";

declare const schema14: Pick<
  typeof production,
  "portableAssetIds" | "createPagePackage" | "createSitePackage"
>;

export = schema14;
