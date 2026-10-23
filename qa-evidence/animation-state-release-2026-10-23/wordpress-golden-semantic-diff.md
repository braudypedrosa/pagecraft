# WordPress golden semantic diff

Compared the pre-regeneration fixture with the fixture produced by the documented `PAGECRAFT_UPDATE_WORDPRESS_GOLDEN=1` path.

- `/` is byte-equivalent at the route object level.
- All four route `bodyHtml` values are unchanged.
- `/nested/about`, `/nested/about/page-2`, and `/nested/about/page-3` change only `css`, `runtime`, `scripts`, and derived `sourceHash` fields.
- Each changed CSS value has exactly 26 added `:where(:not(.bp-is-done-animating))` entrance-state gates. Removing only those gates makes the CSS byte-equivalent to the prior fixture. The legacy `.pc-fade-out` selector remains ungated.
- Each changed runtime is byte-equivalent outside `handleAnimationComplete`. That shared block now validates the element and keyframe name, ignores unrelated completion events, marks completion, releases entrance animation ownership, and preserves `bpFadeOut` ownership.
- Each changed route retains eight script records. Seven are byte-equivalent; only the animation runtime record has derived `hash`, `occurrenceId`, and `token` changes.
- The remaining fixture changes are the derived release manifest, release signature, deployment envelope, and deployment signature.
- No route content, document structure, assets, forms, paths, or non-animation runtime changed.

The complete recursive leaf diff contains 22 values: six derived route values on each of the three animation-bearing routes, plus four release/deployment signature values.
