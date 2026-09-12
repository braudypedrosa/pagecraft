-- Retain immutable bytes for revisions, publications and concurrent references.
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS retired boolean NOT NULL DEFAULT false;
