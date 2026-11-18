-- Covering indexes for foreign keys flagged by the Supabase performance advisor
-- (unindexed_foreign_keys, 2026-11-18). Without them, deleting or updating a referenced row
-- scans the referencing table, and joins on these columns cannot use an index.
-- Additive only: no data or behaviour changes. Safe on the shared staging/production database.
create index if not exists collaboration_invitations_invited_by_idx on public.collaboration_invitations (invited_by);
create index if not exists collaborator_invitation_outbox_user_id_idx on public.collaborator_invitation_outbox (user_id);
create index if not exists connected_editor_sessions_connection_id_idx on public.connected_editor_sessions (connection_id);
create index if not exists connected_editor_sessions_owner_id_idx on public.connected_editor_sessions (owner_id);
create index if not exists connected_editor_sessions_site_id_idx on public.connected_editor_sessions (site_id);
create index if not exists connected_one_time_grants_connection_id_idx on public.connected_one_time_grants (connection_id);
create index if not exists connected_one_time_grants_site_id_idx on public.connected_one_time_grants (site_id);
create index if not exists deployments_release_id_connection_id_idx on public.deployments (release_id, connection_id);
create index if not exists site_release_reservations_created_by_idx on public.site_release_reservations (created_by);
create index if not exists sites_published_publication_id_idx on public.sites (published_publication_id);
create index if not exists sites_published_release_id_idx on public.sites (published_release_id);
create index if not exists wordpress_connections_active_release_id_idx on public.wordpress_connections (active_release_id);
create index if not exists wordpress_webhook_outbox_release_id_idx on public.wordpress_webhook_outbox (release_id);
