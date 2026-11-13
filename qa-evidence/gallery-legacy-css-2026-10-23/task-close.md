# Gallery legacy CSS and Spacer parity repair

Date:23 October2026, Asia/Manila. Pagecraft customer acceptance retest. Status: implemented and automated checks pass; deployed native acceptance remains open. No production promotion.

The existing WordPress page failed preview99 without a Save because its stored preview98 CSS lacked the new lightbox failure styling. Fixed failure styles now travel once with the runtime, from the same canonical CSS used by fresh compilation. Script nonce copying is covered; no CSP relaxation or broader stylesheet reorder is introduced. Controls and Close geometry remain unchanged. A build-order guard caught unwanted runtime text retained in the UI bundle; script assembly is now side-effect free and the unchanged guard passes.

A separate native test found percentage Spacers differed between editor and Preview because all editor Columns had a40px minimum. The minimum now applies only to Columns rendering an empty drop placeholder. Real children use the actual public layout context. Isolated native proof covers D/T/M auto parent0, definite200px parent50, authored minimum200/0, retained empty drop target and usable zero-height Navigator/HUD. The38-node isolated fixture was restored exactly. Public output is unchanged by this editor scaffold repair.

Root combined suite:2,734 passed,5 skipped,264 passing files and2 skipped. Two ordered builds reproduce all ten generated assets exactly. Main's eleven protected working files remain byte-exact; eight generated outputs are staged index-only. Source and evidence records preserve the rejected build-order attempt.

Next: deploy exact source, verify Cloud, pin WordPress preview100, then test the original saved WPv34 Gallery without resaving. Restore fixtures and temporary transport settings. Browser CSP enforcement beyond the product's current policy, broader component CSS architecture, remaining module settings and full production readiness remain open.

Time/billing: unknown, not submitted.
