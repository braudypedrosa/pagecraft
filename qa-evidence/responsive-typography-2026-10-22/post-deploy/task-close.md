# Responsive typography host acceptance

Cloud development commit37f65d4b83de12d6959bfa982c935bc945e31461 passed CI39732948892 and staging deployment39732948870. The exact deployment marker was read in the built-in browser. Native linked Rich text elements preserve Desktop18px, Tablet16px and inherited Mobile16px through Update. Detach preserves the source Mobile16px.

Five actual Undo actions restore the original20 elements, their content and measured typography exactly. A saved reload confirms the same restoration.

WordPress preview92 package is prepared. Guarded installation and native saved-draft acceptance remain pending. Broader customer QA remains open.

WordPress preview0.2.17-preview.20261022.92 pins the same exact Cloud source in WordPress commit249bf8e7f60b6aba0af8186a36e3693646e690ea. CI39734891275 passed PHP8.1/8.2/8.3. Root verified sealed source, current55 Builder files,19 theme files,16 importer files and120 historical package files. Installation alone preserved SQL byte-for-byte. npm audit was unavailable due advisory endpoint timeout and is not claimed clean.

Native WordPress draft616 Update/Detach, Save, reopen and public preview preserve D18/T16/M16 for two linked Rich text elements. Root then restored the original one-element content and original shared D18/T18/M17 via native controls and saved. Final public preview confirms the restored sizes and exact list markup with no horizontal page overflow. Four new revisions620-623 all belong to draft616. Original487 and protected posts, metadata, menus and revisions remain exact.

Global settings are semantically restored; serialized property order changed. Derived global CSS regenerated with current compiler output: same declarations apart from an existing Rich text Focus selector newly materialized, Body declaration order, and changed DM Sans provider font source URLs. The diff was reviewed and normalized comparison confirms no other CSS differences. This is not byte-exact global CSS restoration. See wordpress92-final-guard.json. CPU reset and viewport/media cleanup responses were recorded for owning preview tabs22/23, both closed after capture.

Full customer QA remains open. Native Video testing subsequently found malformed URL fallback into an iframe. That fix is isolated and not yet accepted or deployed.
