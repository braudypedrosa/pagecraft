# Pagecraft host boundary

The editor, document model, compiler, renderer, component registry, and migration chain are
host-independent. They must not import this directory.

`PagecraftHostAdapter` is the only surface through which an embedded editor may reach its
environment. It groups document persistence, authentication and capabilities, pages, menus,
revisions, media, and settings. `WebHostAdapter` adds Pagecraft Cloud releases;
`WordPressHostAdapter` keeps WordPress REST nonce handling inside its transport.

Both adapters pass documents through `adoptHostDocument`. That wrapper clones input and calls
the core's single `migrate` chain. A document from a newer schema fails closed with an explicit
host-upgrade message; neither adapter has a private migration or renderer.

The current web shell creates `WebHostAdapter` from the same sealed bundle as the ported UI.
The WordPress plugin can create `WordPressHostAdapter` with its REST root, page ID, nonce, and
capability snapshot. Host-specific REST routes may evolve, but editor and component behavior
must continue to depend only on these typed contracts.

WordPress menu payloads identify page/post-backed items separately from custom URLs and retain
stable item ids, parent ids, classes, targets, relationships, and optional anchors. This lets the
WordPress host update native records without teaching the shared renderer about WordPress APIs.
