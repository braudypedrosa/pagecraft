# Publication attempt and import checks — 2026-09-09

Package: 71afc69bc7059e8fcaf0a5d94fefcf0d26963b19b0306fe0be43c22eaf59a771

User explicitly authorized publication. Catalog not promoted or deployed.

## Current observed checks
- Native build/check passes.
- Production HTTPS /sign-in responds 200. Authenticated dashboard shows 3 of 3 owned sites; Add new site disabled. No existing site modified. Replacement choice requested.
- Fresh local Cloud fixture at localhost:4930 uses current checkout createApp and /tmp/pagecraft-cove-fixes/index.html. Template import creates editable Stillwood release QA. Testimonial slide 3 navigable, quote changed through inspector, persisted after reload. This is not a production/Supabase test.
- Cloud Publish dialog blocks publishing on five form-no-action problems, across homepage, three cabin pages and contact. No fake destinations supplied. Demo handling choice requested.
- Fresh isolated WordPress installation /tmp/stillwood-release-wp uses separate stillwoodreleaseqa_ tables and port 4931. User-provided pagecraftqa account. Existing Cove and earlier Stillwood database tables preserved.
- Actual WholeProjectImporter: initial job 4 created nine pages; homepage 20; 15 media assets; one menu. Later job 37 updated nine, created zero; counts stable. One default WordPress page also present.
- WordPress page opens native editor directly. Frontend Edit Page contains Edit with Pagecraft route for post 20. Slide 4 navigable/editable; changed quote saved and verified after reload. Reimport restored package source.
- Reimported WordPress homepage: all loaded images valid, no viewport overflow, footer logo/navigation center difference 0px.

## Outstanding
Live Cloud import; full editing stress and per-page/per-breakpoint release matrix; promotion direction/visual review records. No unperformed checks entered as passes. Form endpoints intentionally unconfigured and hosted publish currently blocked. Both local hosts are QA only.
