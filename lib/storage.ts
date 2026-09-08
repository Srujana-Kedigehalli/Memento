import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "photos";

// Used strictly for Storage (presigned upload URLs) — never as a database
// client. Postgres access always goes through lib/db.ts (Constitution
// Principle VII: server-only data access, no browser-to-Postgres path).
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage is not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function createSignedUploadUrl(eventId: string, fileName: string) {
  const supabase = getSupabaseAdmin();
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "jpg";
  const storagePath = `events/${eventId}/${randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create signed upload URL");
  }

  return { signedUrl: data.signedUrl, storagePath };
}

export function getPublicUrl(storagePath: string) {
  const supabase = getSupabaseAdmin();
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}
