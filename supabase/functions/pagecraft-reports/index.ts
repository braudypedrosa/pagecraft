import "jsr:@supabase/functions-js@2.111.0/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import { createFounderReportsHandler } from "./founder-reporting.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
});

Deno.serve(createFounderReportsHandler(sql));
