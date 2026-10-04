import { createClient } from "@supabase/supabase-js";

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "photos";

/** Signed read and download links last 5 minutes, so a hidden photo is reachable for at most that long. */
export const SIGNED_READ_SECONDS = 300;

// Used strictly for Storage — never as a database client. Postgres access always goes through
// lib/db.ts (Constitution Principle IV: raw SQL via pg, Data API disabled, no browser path to Postgres).
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage is not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

/** A one-time signed URL the browser PUTs the raw file to. The bucket must be private. */
export async function createSignedUploadUrl(path: string): Promise<{ signedUrl: string }> {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Failed to create signed upload URL");
  return { signedUrl: data.signedUrl };
}

export async function downloadObject(path: string): Promise<Buffer> {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) throw new Error(error?.message ?? "Failed to download object");
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadObject(path: string, body: Buffer, contentType: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(bucket)
    .upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);
}

export async function deleteObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getSupabaseAdmin().storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
}

export async function listObjects(prefix: string, limit = 1000): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).list(prefix, { limit });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((entry) => entry.id !== null).map((entry) => `${prefix}/${entry.name}`);
}

/** A signed read URL valid for 5 minutes. Pass `download` to force a save-as with that file name. */
export async function createSignedReadUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, SIGNED_READ_SECONDS, download ? { download } : undefined);
  if (error || !data) throw new Error(error?.message ?? "Failed to sign URL");
  return data.signedUrl;
}

/** Sign many paths in one call (gallery listings). Paths that cannot be signed come back as null. */
export async function createSignedReadUrls(paths: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (paths.length === 0) return out;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(bucket)
    .createSignedUrls(paths, SIGNED_READ_SECONDS);
  if (error || !data) throw new Error(error?.message ?? "Failed to sign URLs");
  for (const entry of data) out.set(entry.path ?? "", entry.error ? null : entry.signedUrl);
  return out;
}
