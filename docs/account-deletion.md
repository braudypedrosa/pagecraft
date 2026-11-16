# Account deletion

People delete their own account from **Account settings → Security → Delete account**
(`POST /account/delete`, editor host only).

## What the person must do

- Retype their account email exactly (case-insensitive).
- Email-and-password accounts: enter the current password and pass the Turnstile check. The
  password is verified with a throwaway Supabase client, so the browser session is untouched.
- Google-only accounts: have signed in within the last 15 minutes (`last_sign_in_at`).
- The form also asks for a browser confirmation; requests share the 8-per-15-minutes
  account-change rate limit.

## What blocks deletion (nothing is deleted)

- The backing store cannot delete profiles yet (see "Deployment" below): the section says
  self-serve deletion is not available and to email hello@braudyp.dev.
- A site the person owns also has another owner. They must remove themselves or the other
  owners first (shared ownership is never decided automatically).
- The account has a non-Free plan (paid or privately assigned Pro).
- An owned site has signed WordPress releases (kept permanently by design).
- The person created releases, WordPress connections or media on sites they do not own
  (`retained_records`), which are kept permanently.

## What is deleted, in order

1. Every solely owned site through the same routine as site settings deletion: database rows
   (drafts, revisions, media and its storage objects, WordPress connections), then the hosted
   publication, form submissions, dashboard preview, integration connection, analytics,
   assistant tokens and proposals, schedules, reviews and live reviews.
2. On sites they only collaborate on: assistant tokens they created are revoked and their
   membership is removed. The site and everything else on it stay with the owners.
3. Library memberships, pending invitations addressed to them, connected WordPress import
   credentials.
4. The profile row (`auth.deleteAccount`), whose foreign keys cascade sessions, memberships,
   owned libraries, library memberships, invitations they sent and import/API credentials.
5. The Supabase Auth user (`supabase.auth.admin.deleteUser`, in the gateway, which already
   holds the service-role key). Then every session is signed out and the browser cookies
   are cleared.

If the Auth user cannot be removed, the profile is still deleted and the opaque Auth user id
is written to `<publication root>/.account-deletions/pending-auth-deletions.json` for an
administrator to delete in the Supabase dashboard (Authentication → Users).

## Deployment (required before it works on staging/production)

Staging and production use the `pagecraft-db` database gateway, which is deployed to Supabase
separately from the Node app. The new actions `auth.accountDeletionCheck` and
`auth.deleteAccount` are in `supabase/functions/pagecraft-db/index.ts` but are **not live
until the edge function is redeployed**. Until then the app's check gets "unknown op", shows
"not available yet" and deletes nothing. Because staging and production share one database
and gateway, redeploying it enables deletion for both environments' accounts (the Node
deployment of each environment still controls whether the UI is offered).

Local Postgres (`PgAuthStore`) deletes the profile but cannot remove a Supabase Auth user
(no admin key), so it records the pending Auth id as above.

Known gap: library media blobs in Supabase Storage for libraries the person owned are left
orphaned when their rows cascade; storage-object cleanup for libraries is not implemented.
