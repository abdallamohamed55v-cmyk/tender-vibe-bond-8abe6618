// Edge function: fal-generate-video
// Reads model definition from public.fal_video_models, smart-routes endpoint,
// deducts credits per-second (or per-video), and persists output to media-studio.

import { falRun, extractVideoUrl, FalError } from "../_shared/fal.ts";
import { adminClient, saveRemoteAsset } from "../_shared/media-storage.ts";
import { getAuthUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  prompt: string;
  model_slug: string;
  images?: string[];           // reference / image-to-video inputs
  start_frame?: string;
  end_frame?: string;
  aspect_ratio?: string;
  resolution?: string;
  duration?: number;           // seconds
  seed?: number;
  workspace_id?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await getAuthUser(req);
  if (!user) return json({ error: "auth_required" }, 401);

  let body: ReqBody;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.prompt) return json({ error: "prompt_required" }, 400);
  if (!body.model_slug) return json({ error: "model_slug_required" }, 400);

  const admin = adminClient();
  const { data: model, error: modelErr } = await admin
    .from("fal_video_models")
    .select("*")
    .eq("slug", body.model_slug)
    .eq("is_active", true)
    .maybeSingle();
  if (modelErr || !model) return json({ error: `unknown_model:${body.model_slug}` }, 400);

  const images = body.images?.filter(Boolean) ?? [];
  const hasStartEnd = !!body.start_frame && !!body.end_frame;

  if (hasStartEnd && !model.supports_start_end_frame) {
    return json({ error: "model_does_not_support_start_end_frame" }, 400);
  }
  if (images.length > 1 && !model.supports_multi_image) {
    return json({ error: "model_does_not_support_multi_image" }, 400);
  }
  if (images.length > model.max_input_images) {
    return json({ error: `max_input_images_${model.max_input_images}` }, 400);
  }

  const duration = Number(body.duration ?? model.default_duration);
  const allowedDurations: number[] = Array.isArray(model.supported_durations)
    ? (model.supported_durations as number[])
    : [model.default_duration];
  if (!allowedDurations.includes(duration)) {
    return json({ error: `duration_not_supported:${duration}`, supported: allowedDurations }, 400);
  }

  // Smart route
  let endpoint: string | null = null;
  if (hasStartEnd && model.endpoint_start_end_frame) endpoint = model.endpoint_start_end_frame;
  else if (images.length > 1 && model.endpoint_reference_to_video) endpoint = model.endpoint_reference_to_video;
  else if (images.length >= 1 && model.endpoint_image_to_video) endpoint = model.endpoint_image_to_video;
  else if (images.length === 0 && model.endpoint_text_to_video) endpoint = model.endpoint_text_to_video;
  else endpoint = model.endpoint_image_to_video || model.endpoint_text_to_video;
  if (!endpoint) return json({ error: "no_endpoint_for_input" }, 400);

  // Credits
  const credits = model.unit === "video"
    ? Math.max(1, model.credits_per_video ?? 1)
    : Math.max(1, (model.credits_per_second ?? 1) * duration);

  const { data: deduct, error: deductErr } = await admin.rpc("deduct_credits", {
    p_user_id: user.id,
    p_amount: credits,
    p_action_type: "fal_video_generation",
    p_description: `${model.display_name} (${duration}s)`,
  });
  if (deductErr) return json({ error: `credit_error:${deductErr.message}` }, 500);
  if (deduct && deduct.success === false) {
    return json({ error: deduct.error || "insufficient_credits", credits: deduct.credits }, 402);
  }

  const aspect = body.aspect_ratio || model.default_aspect;
  const resolution = body.resolution || model.default_resolution;
  const payload: Record<string, unknown> = {
    prompt: body.prompt,
    aspect_ratio: aspect,
    resolution,
    duration,
  };
  if (body.seed !== undefined) payload.seed = body.seed;
  if (hasStartEnd) {
    payload.start_image_url = body.start_frame;
    payload.end_image_url = body.end_frame;
    payload.first_image_url = body.start_frame;
    payload.last_image_url = body.end_frame;
  } else if (images.length === 1) {
    payload.image_url = images[0];
  } else if (images.length > 1) {
    payload.image_urls = images;
    payload.reference_images = images;
  }

  try {
    const result = await falRun(endpoint, payload, { maxWaitMs: 10 * 60 * 1000 });
    const url = extractVideoUrl(result);
    if (!url) return json({ error: "no_video_returned" }, 502);

    const saved = await saveRemoteAsset({
      admin, userId: user.id, remoteUrl: url, kind: "video",
      provider: "fal", model: model.slug,
      prompt: body.prompt, costCredits: credits,
      durationSeconds: duration,
      workspaceId: body.workspace_id ?? null,
      metadata: { endpoint, aspect, resolution, has_start_end: hasStartEnd, input_images: images.length },
    });
    return json({
      video_url: saved?.public_url ?? url,
      credits_charged: credits,
      duration_seconds: duration,
    });
  } catch (err) {
    const status = err instanceof FalError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : String(err) }, status);
  }
});
