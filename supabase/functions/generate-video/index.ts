// Edge function: generate-video
// - Fal-based video providers (Veo, Kling, Seedance, Hunyuan, etc.)
// - Resolves pricing dynamically from public.model_pricing
// - Deducts credits via deduct_credits RPC
// - Saves output to media-studio bucket + media_assets

import { falRun, extractVideoUrl, FalError } from "../_shared/fal.ts";
import { createJob, runInBackground } from "../_shared/jobs.ts";
import {
  adminClient,
  getModelPricing,
  computeVideoCredits,
  saveRemoteAsset,
} from "../_shared/media-storage.ts";
import { getAuthUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  prompt: string;
  model: string;
  user_id?: string;
  workspace_id?: string | null;
  image_url?: string;
  duration?: number | string;
  aspect_ratio?: string;
  resolution?: string;
  seed?: number;
  negative_prompt?: string;
  background?: boolean;
  conversation_id?: string | null;
}

// Routes a text-to-video model id to its image-to-video twin when the caller
// attached a starting image. Keep this in sync with EDIT_VARIANT_MAP in
// src/lib/modelDetails.ts.
const VIDEO_I2V_VARIANT_MAP: Record<string, string> = {
  "fal-ai/veo3": "fal-ai/veo3/image-to-video",
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
  "fal-ai/kling-video/v2.1/master/text-to-video": "fal-ai/kling-video/v2.1/master/image-to-video",
  "fal-ai/bytedance/seedance/v1/pro/text-to-video": "fal-ai/bytedance/seedance/v1/pro/image-to-video",
  "fal-ai/minimax/hailuo-02/pro/text-to-video": "fal-ai/minimax/hailuo-02/pro/image-to-video",
  "fal-ai/wan/v2.5/text-to-video": "fal-ai/wan/v2.5/image-to-video",
  "fal-ai/pika/v2.2/text-to-video": "fal-ai/pika/v2.2/image-to-video",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildPayload(modelEndpoint: string, body: ReqBody): Record<string, unknown> {
  const payload: Record<string, unknown> = { prompt: body.prompt };
  if (body.image_url) payload.image_url = body.image_url;
  if (body.duration !== undefined) payload.duration = body.duration;
  if (body.aspect_ratio) payload.aspect_ratio = body.aspect_ratio;
  if (body.resolution) payload.resolution = body.resolution;
  if (body.seed !== undefined) payload.seed = body.seed;
  if (body.negative_prompt) payload.negative_prompt = body.negative_prompt;
  if (!payload.aspect_ratio && (modelEndpoint.includes("veo") || modelEndpoint.includes("kling"))) {
    payload.aspect_ratio = "16:9";
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authUser = await getAuthUser(req);
  if (!authUser) return jsonResponse({ error: "auth_required" }, 401);

  let body: ReqBody;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }
  body.user_id = authUser.id;


  if (!body.prompt) return jsonResponse({ error: "prompt is required" }, 400);
  if (!body.model) return jsonResponse({ error: "model is required" }, 400);

  const admin = adminClient();

  // Auto-route to the image-to-video twin when the caller attached an image.
  if (body.image_url && VIDEO_I2V_VARIANT_MAP[body.model]) {
    body.model = VIDEO_I2V_VARIANT_MAP[body.model];
  }

  const pricing = await getModelPricing(admin, body.model);
  if (!pricing || pricing.kind !== "video") {
    return jsonResponse({ error: `Unknown video model: ${body.model}` }, 400);
  }

  const seconds = Math.max(1, Math.ceil(Number(body.duration ?? 5)));
  const creditsCost = computeVideoCredits(pricing, seconds);

  if (body.user_id) {
    const { data, error } = await admin.rpc("deduct_credits", {
      p_user_id: body.user_id,
      p_amount: creditsCost,
      p_action_type: "video_generation",
      p_description: `Video: ${pricing.label} (${seconds}s)`,
    });
    if (error) return jsonResponse({ error: `Credit deduction failed: ${error.message}` }, 500);
    if (data && data.success === false) {
      return jsonResponse({ error: data.error || "Insufficient credits", credits: data.credits }, 402);
    }
  }

  const runGen = async (): Promise<string | null> => {
    const payload = buildPayload(pricing.endpoint, body);
    const result = await falRun(pricing.endpoint, payload, { maxWaitMs: 8 * 60 * 1000, pollIntervalMs: 3000 });
    return extractVideoUrl(result);
  };

  const persist = async (url: string) => {
    let finalUrl = url;
    if (body.user_id) {
      const a = await saveRemoteAsset({
        admin, userId: body.user_id, remoteUrl: url, kind: "video",
        provider: pricing.provider, model: pricing.id,
        prompt: body.prompt, costCredits: creditsCost,
        durationSeconds: seconds,
        workspaceId: body.workspace_id ?? null,
        metadata: { resolution: body.resolution, aspect_ratio: body.aspect_ratio },
      });
      if (a) finalUrl = a.public_url;
    }
    return { video_url: finalUrl, credits_charged: creditsCost };
  };

  if (body.background && body.user_id) {
    try {
      const jobId = await createJob({
        userId: body.user_id,
        kind: "video",
        input: { prompt: body.prompt, model: body.model, image_url: body.image_url },
        conversationId: body.conversation_id ?? null,
        meta: { model: body.model, credits_cost: creditsCost },
      });
      runInBackground(jobId, async (writer) => {
        await writer.start({ phase: "generating", status_text: "Generating video..." });
        const url = await runGen();
        if (!url) throw new Error("No video returned");
        await writer.complete(await persist(url));
      });
      return jsonResponse({ jobId });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  try {
    const url = await runGen();
    if (!url) return jsonResponse({ error: "No video returned" }, 502);
    return jsonResponse(await persist(url));
  } catch (err) {
    const status = err instanceof FalError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate-video error:", message);
    return jsonResponse({ error: message }, status);
  }
});
