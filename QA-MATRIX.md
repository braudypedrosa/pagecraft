# WordPress v1 QA matrix

| Contract | Automated gate | Hosted proof |
|---|---|---|
| Shared editor components, inspectors, responsive output | `npm test`; golden component/release fixtures | Desktop, tablet, mobile editor and public pages |
| Package integrity, CMS/custom-code rejection | `wordpress/tests/lint.sh`; native import fixture | Upload failures leave no partial page |
| Pages, revisions, fallback rendering | Native import and theme fallback contracts | Edit, publish, deactivate, re-enable, uninstall |
| Menus and clean URLs | Native menu contract | WordPress menu editor and public navigation |
| Media verification and deduplication | Native media fixture | Media Library, responsive images, offline public page |
| Manual cloud import and revocation | Server, gateway, Supabase, and PHP cloud-import tests | Account connect, import, disconnect, revoke, reconnect |
| Compatibility and packages | PHP 8.1 Docker lint; deterministic package/release scripts | Hosted WordPress 6.6+ / PHP 8.1+ record |
| Accessibility, console, network health | Semantic/keyboard unit coverage | Recorded browser evidence |

Automated success does not substitute for the unchecked hosted acceptance record.
