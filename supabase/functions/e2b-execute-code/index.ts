// e2b-execute-code: run arbitrary Python or JavaScript in an E2B sandbox.
// POST body: { code, language?, input_files?, output_files?, timeout_sec?, conversation_id? }
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};
import { runInSandbox } from "../_shared/e2b.ts";
import { serviceClient, getUserId, uploadFiles } from "../_shared/e2b-storage.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const userId = await getUserId(req);
    if (!userId) return json(401, { error: "auth_required" });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.code !== "string" || !body.code.trim()) {
      return json(400, { error: "code is required" });
    }
    const language = body.language === "javascript" ? "javascript" : "python";
    const timeoutSec = Math.min(Math.max(Number(body.timeout_sec) || 120, 5), 300);

    const supabase = serviceClient();
    const { data: execRow, error: insErr } = await supabase
      .from("e2b_executions")
      .insert({
        user_id: userId,
        conversation_id: body.conversation_id ?? null,
        kind: "execute_code",
        language,
        status: "running",
        input: { code: body.code, output_files: body.output_files ?? [] },
      })
      .select("id")
      .single();
    if (insErr || !execRow) return json(500, { error: "failed to create execution" });

    try {
      const result = await runInSandbox({
        code: body.code,
        language,
        inputFiles: body.input_files,
        outputFiles: body.output_files,
        timeoutSec,
      });

      const uploaded = await uploadFiles(supabase, userId, execRow.id, result.files);

      await supabase.from("e2b_executions").update({
        status: result.error ? "failed" : "succeeded",
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error ?? null,
        files: uploaded,
        result: { results: result.results },
        duration_ms: result.duration_ms,
      }).eq("id", execRow.id);

      return json(200, {
        execution_id: execRow.id,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error,
        results: result.results,
        files: uploaded,
        duration_ms: result.duration_ms,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("e2b_executions").update({
        status: "failed", error: msg,
      }).eq("id", execRow.id);
      return json(500, { execution_id: execRow.id, error: msg });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});
