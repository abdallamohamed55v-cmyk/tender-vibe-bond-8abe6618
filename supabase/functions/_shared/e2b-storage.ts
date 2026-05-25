// Helpers to persist E2B outputs to Supabase Storage + executions table.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

const MIME_MAP: Record<string, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  csv: "text/csv",
  json: "application/json",
  txt: "text/plain",
  html: "text/html",
  svg: "image/svg+xml",
};

export async function uploadFiles(
  supabase: SupabaseClient,
  userId: string,
  executionId: string,
  files: Array<{ path: string; bytes: Uint8Array }>,
): Promise<Array<{ name: string; storagePath: string; size: number; mime: string; signedUrl: string }>> {
  const uploaded: Array<{ name: string; storagePath: string; size: number; mime: string; signedUrl: string }> = [];
  for (const f of files) {
    const name = f.path.split("/").pop() ?? "file";
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    const mime = MIME_MAP[ext] ?? "application/octet-stream";
    const storagePath = `${userId}/${executionId}/${name}`;
    const { error: upErr } = await supabase.storage
      .from("generated-files")
      .upload(storagePath, f.bytes, { contentType: mime, upsert: true });
    if (upErr) {
      console.error("storage upload failed", storagePath, upErr);
      continue;
    }
    const { data: signed } = await supabase.storage
      .from("generated-files")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
    uploaded.push({
      name,
      storagePath,
      size: f.bytes.byteLength,
      mime,
      signedUrl: signed?.signedUrl ?? "",
    });
  }
  return uploaded;
}
