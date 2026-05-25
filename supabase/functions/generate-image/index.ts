// Edge function: generate-image
// Providers: Fal (default) + Runware (for openai:gpt-image-2, sd3.5, etc.)
// - Resolves pricing dynamically from public.model_pricing
// - Deducts credits via deduct_credits RPC
// - Saves output to media-studio bucket and registers in media_assets

import { falRun, extractImageUrls, FalError } from "../_shared/fal.ts";
import { runwareImage, RunwareError } from "../_shared/runware.ts";
import { createJob, runInBackground } from "../_shared/jobs.ts";
import {
  adminClient,
  getModelPricing,
  computeImageCredits,
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
  model: string;              // model_pricing.id (e.g. "fal/nano-banana-pro")
  user_id?: string;
  workspace_id?: string | null;
  num_images?: number;
  image_size?: { width: number; height: number } | string;
  image_url?: string;
  image_urls?: string[];
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  background?: boolean;
  conversation_id?: string | null;
}

// Routes a text-to-image model id to its dedicated /edit variant when the
// caller attached one or more input images. Keep this in sync with
// EDIT_VARIANT_MAP in src/lib/modelDetails.ts.
const IMAGE_EDIT_VARIANT_MAP: Record<string, string> = {
  "fal-ai/nano-banana": "fal-ai/nano-banana/edit",
  "fal-ai/nano-banana-2": "fal-ai/nano-banana-2/edit",
  "fal-ai/bytedance/seedream/v4/text-to-image": "fal-ai/bytedance/seedream/v4/edit",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sizeToWH(size: ReqBody["image_size"]): { width: number; height: number } {
  if (size && typeof size === "object") return { width: size.width, height: size.height };
  switch (size) {
    case "portrait_hd":   return { width: 1024, height: 1536 };
    case "landscape_hd":  return { width: 1536, height: 1024 };
    case "square":        return { width: 768,  height: 768 };
    case "square_hd":
    default:              return { width: 1024, height: 1024 };
  }
}

function buildFalPayload(modelEndpoint: string, body: ReqBody): Record<string, unknown> {
  const payload: Record<string, unknown> = { prompt: body.prompt };
  if (body.num_images && body.num_images > 0) payload.num_images = body.num_images;
  if (body.seed !== undefined) payload.seed = body.seed;
  if (body.guidance_scale !== undefined) payload.guidance_scale = body.guidance_scale;
  if (body.num_inference_steps !== undefined) payload.num_inference_steps = body.num_inference_steps;
  payload.image_size = body.image_size ?? "square_hd";
  if (body.image_url) {
    payload.image_url = body.image_url;
    if (modelEndpoint.includes("nano-banana") || modelEndpoint.includes("gemini") || modelEndpoint.includes("kontext") || modelEndpoint.includes("seedream")) {
      payload.image_urls = body.image_urls?.length ? body.image_urls : [body.image_url];
    }
  } else if (body.image_urls?.length) {
    payload.image_urls = body.image_urls;
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
  // Force user_id to the authenticated caller — never trust body.user_id
  body.user_id = authUser.id;

  if (!body.prompt || typeof body.prompt !== "string") return jsonResponse({ error: "prompt is required" }, 400);
  if (!body.model || typeof body.model !== "string") return jsonResponse({ error: "model is required" }, 400);

  const admin = adminClient();

  // Auto-route to the /edit twin when the user attached input image(s).
  const hasInputImage = !!body.image_url || !!(body.image_urls && body.image_urls.length);
  if (hasInputImage && IMAGE_EDIT_VARIANT_MAP[body.model]) {
    body.model = IMAGE_EDIT_VARIANT_MAP[body.model];
  }

  let pricing = await getModelPricing(admin, body.model);
  if (!pricing || pricing.kind !== "image") {
    return jsonResponse({ error: `Unknown image model: ${body.model}` }, 400);
  }

  const numImages = Math.max(1, body.num_images ?? 1);
  const creditsCost = computeImageCredits(pricing, numImages);

  // Deduct credits
  if (body.user_id) {
    const { data, error } = await admin.rpc("deduct_credits", {
      p_user_id: body.user_id,
      p_amount: creditsCost,
      p_action_type: "image_generation",
      p_description: `Image: ${pricing.label}`,
    });
    if (error) return jsonResponse({ error: `Credit deduction failed: ${error.message}` }, 500);
    if (data && data.success === false) {
      return jsonResponse({ error: data.error || "Insufficient credits", credits: data.credits }, 402);
    }
  }

  const runGeneration = async (): Promise<string[]> => {
    if (pricing.provider === "runware") {
      const { width, height } = sizeToWH(body.image_size);
      return await runwareImage({
        positivePrompt: body.prompt,
        model: pricing.endpoint,
        numberResults: numImages,
        width,
        height,
        seed: body.seed,
        referenceImages: body.image_urls ?? (body.image_url ? [body.image_url] : undefined),
      });
    }
    // Default: Fal
    const payload = buildFalPayload(pricing.endpoint, body);
    const result = await falRun(pricing.endpoint, payload, { maxWaitMs: 3 * 60 * 1000 });
    return extractImageUrls(result);
  };

  const persistAndReturn = async (urls: string[]) => {
    const wh = sizeToWH(body.image_size);
    const saved: string[] = [];
    if (body.user_id) {
      for (const u of urls) {
        const a = await saveRemoteAsset({
          admin, userId: body.user_id, remoteUrl: u, kind: "image",
          provider: pricing.provider, model: pricing.id,
          prompt: body.prompt, costCredits: creditsCost / urls.length,
          width: wh.width, height: wh.height,
          workspaceId: body.workspace_id ?? null,
          metadata: { num_images: numImages },
        });
        if (a) saved.push(a.public_url);
      }
    }
    const finalUrls = saved.length ? saved : urls;
    return { image_urls: finalUrls, image_url: finalUrls[0], credits_charged: creditsCost };
  };

  // Background mode
  if (body.background && body.user_id) {
    try {
      const jobId = await createJob({
        userId: body.user_id,
        kind: "image",
        input: { prompt: body.prompt, model: body.model, image_url: body.image_url, image_urls: body.image_urls },
        conversationId: body.conversation_id ?? null,
        meta: { model: body.model, credits_cost: creditsCost },
      });
      runInBackground(jobId, async (writer) => {
        await writer.start({ phase: "generating", status_text: "Generating image..." });
        const urls = await runGeneration();
        if (!urls.length) throw new Error("No images returned");
        const out = await persistAndReturn(urls);
        await writer.complete(out);
      });
      return jsonResponse({ jobId });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  try {
    const urls = await runGeneration();
    if (!urls.length) return jsonResponse({ error: "No images returned" }, 502);
    return jsonResponse(await persistAndReturn(urls));
  } catch (err) {
    const status = err instanceof FalError || err instanceof RunwareError ? (err as any).status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate-image error:", message);
    return jsonResponse({ error: message }, status);
  }
});
