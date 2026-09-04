# Pagecraft curated site authoring

Curated sites are versioned Pagecraft documents, not imported HTML themes. Their visible
layout, spacing, typography, colours, borders, backgrounds, responsive overrides and sticky
positioning belong in native node or Pagecraft class data so an author can change them in the
builder.

## Start a release

```sh
npm run template -- scaffold consulting-studio 1.0.0 \
  --name="Consulting Studio" \
  --sample-name="Example & Co" \
  --categories="Consulting,Services"
```

This creates a non-destructive version directory with `source.ts`, `template.config.json`, and
an `assets/` directory. It refuses to overwrite an existing release.

Author the site in `source.ts`. Put every author-facing visual value in each node's `css.d`,
`css.t`, and `css.m` maps. Add image files and their stable `asset:*` ids to the config.

## Validate and package

```sh
npm run template -- build consulting-studio 1.0.0
npm run template -- check consulting-studio 1.0.0
```

`build` validates the native document and asset references, produces the installable package
and manifest, then rebuilds the catalog. `check` is read-only and fails when the document,
assets, manifest, or package disagree.

New scaffolds use `customCssPolicy: "native-only"`. Advanced element CSS and project custom
CSS fail that policy because their values cannot be discovered reliably through the inspector.
An existing template may use `reviewed-exception` only with a concrete reason and only for a
behavior Pagecraft cannot model yet. The exception is a migration list, not a styling shortcut.

Before release, install the template through the dashboard and verify content editing, desktop,
tablet and mobile controls, media, navigation, publish, and the saved dashboard snapshot.
