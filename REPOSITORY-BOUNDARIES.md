# Pagecraft repository boundaries

Pagecraft Cloud and Pagecraft for WordPress share one editor, document model, compiler, and
renderer. They do not share product ownership, publishing state, runtime credentials, or release
artifacts.

## Source ownership

| Scope | Repository | Authority |
| --- | --- | --- |
| Shared editor, schema, compiler, renderer, and host contracts | `braudypedrosa/pagecraft` | Source of truth |
| Pagecraft Cloud UI, account surfaces, API, storage gateway, and hosted publishing | `braudypedrosa/pagecraft` | Cloud-only |
| WordPress plugin, theme, REST adapters, native records, and distributable archives | `braudypedrosa/pagecraft-wordpress` | WordPress-only |
| WordPress editor bundle | Generated `@pagecraft/editor` archive from `pagecraft`, pinned in `pagecraft-wordpress` | Versioned handoff |

Cloud and WordPress may implement different host behavior through the explicit feature contract.
Cloud-only controls must not be enabled by the WordPress host. WordPress-only behavior must be
implemented by the WordPress adapter or the consuming plugin, not by copying Cloud credentials or
calling Cloud publishing endpoints at runtime.

## Branch names

- `bp/shared-editor-*` changes the editor or contract used by more than one host.
- `bp/cloud-*` changes only the hosted Pagecraft product or its deployment.
- `bp/wordpress-*` is reserved for the `pagecraft-wordpress` repository.

Using the same feature branch name in both repositories is discouraged because it hides which
product owns a change.

## Editor handoff

1. Change and test shared behavior in `pagecraft` on a `bp/shared-editor-*` branch.
2. Increment `packages/editor/package.json` and the generated contract version.
3. Run `npm run build:editor-package` and commit the generated package files with the source.
4. Create the package archive from that committed revision.
5. Copy the archive into `pagecraft-wordpress`, update its file dependency and lockfile, and rebuild
   `pagecraft-builder/assets/pagecraft-editor.html`.
6. Record the Pagecraft source commit and archive SHA-256 beside the pinned archive.
7. Run both repositories' test suites. WordPress releases never fetch the editor from Pagecraft
   Cloud at runtime.

## Cloud deployment

Deploy Pagecraft Cloud only from a committed `bp/cloud-*` revision. Record that Git commit and the
deployed file checksum in the release evidence. A generated WordPress editor archive is not a
Cloud deployment, and a Cloud deployment must never modify the `pagecraft-wordpress` checkout.
