# @pagecraft/editor

Versioned Pagecraft editor bundle for trusted hosts such as the native WordPress Builder.

Pagecraft Cloud owns the source document schema and renderer. Consumers pin an exact package version, bundle the generated files into their own release, and never fetch this package at runtime.

Every host adapter exposes an immutable feature contract. The WordPress contract omits Cloud-only product surfaces and delegates pages, media, menus, revisions, preview, publishing, globals, and dynamic content to WordPress-owned adapters.
