// Edge function: fal-generate-image
// Reads model definition from public.fal_image_models, smart-routes endpoint
// based on attached images, deducts credits, and persists output to media-studio.

import { falRun, extractImageUrls, FalError } from "../_shared/fal.ts";
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
  images?: string[];
  aspect_ratio?: string;
  resolution?: string;
  num_images?: number;
  seed?: number;
  workspace_id?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function aspectToSize(aspect: string, res: string): { width: number; height: number } {
  const base = res === "2K" ? 2048 : res === "4K" ? 4096 : 1024;
  const [a, b] = (aspect || "1:1").split(":").map(Number);
  if (!a || !b) return { width: base, height: base };
  if (a >= b) return { width: base, height: Math.round((base * b) / a) };
  return { width: Math.round((base * a) / b), height: base };
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
    .from("fal_image_models")
    .select("*")
    .eq("slug", body.model_slug)
    .eq("is_active", true)
    .maybeSingle();
  if (modelErr || !model) return json({ error: `unknown_model:${body.model_slug}` }, 400);

  const images = body.images?.filter(Boolean) ?? [];
  if (images.length > 1 && !model.supports_multi_image) {
    return json({ error: "model_does_not_support_multi_image" }, 400);
  }
  if (images.length > model.max_input_images) {
    return json({ error: `max_input_images_${model.max_input_images}` }, 400);
  }

  // Smart route
  let endpoint: string | null = null;
  if (images.length > 1 && model.endpoint_multi_reference) endpoint = model.endpoint_multi_reference;
  else if (images.length >= 1 && model.endpoint_image_to_image) endpoint = model.endpoint_image_to_image;
  else if (images.length === 0 && model.endpoint_text_to_image) endpoint = model.endpoint_text_to_image;
  else endpoint = model.endpoint_image_to_image || model.endpoint_text_to_image;
  if (!endpoint) return json({ error: "no_endpoint_for_input" }, 400);

  const numImages = Math.max(1, Math.min(4, body.num_images ?? 1));
  const credits = Math.max(1, (model.credits ?? 1) * numImages);

  // Deduct credits
  const { data: deduct, error: deductErr } = await admin.rpc("deduct_credits", {
    p_user_id: user.id,
    p_amount: credits,
    p_action_type: "fal_image_generation",
    p_description: `${model.display_name} (${images.length ? "edit" : "generate"})`,
  });
  if (deductErr) return json({ error: `credit_error:${deductErr.message}` }, 500);
  if (deduct && deduct.success === false) {
    return json({ error: deduct.error || "insufficient_credits", credits: deduct.credits }, 402);
  }

  // Build payload
  const aspect = body.aspect_ratio || model.default_aspect;
  const resolution = body.resolution || model.default_resolution;
  const wh = aspectToSize(aspect, resolution);
  const payload: Record<string, unknown> = {
    prompt: body.prompt,
    aspect_ratio: aspect,
    image_size: wh,
    num_images: numImages,
  };
  if (body.seed !== undefined) payload.seed = body.seed;
  if (images.length === 1) {
    payload.image_url = images[0];
    payload.image_urls = images;
  } else if (images.length > 1) {
    payload.image_urls = images;
    payload.reference_images = images;
  }

  try {
    const result = await falRun(endpoint, payload, { maxWaitMs: 3 * 60 * 1000 });
    const urls = extractImageUrls(result);
    if (!urls.length) return json({ error: "no_images_returned" }, 502);

    const saved: string[] = [];
    for (const u of urls) {
      const a = await saveRemoteAsset({
        admin, userId: user.id, remoteUrl: u, kind: "image",
        provider: "fal", model: model.slug,
        prompt: body.prompt, costCredits: credits / urls.length,
        width: wh.width, height: wh.height,
        workspaceId: body.workspace_id ?? null,
        metadata: { endpoint, aspect, resolution, input_images: images.length },
      });
      if (a) saved.push(a.public_url);
    }
    const finalUrls = saved.length ? saved : urls;
    return json({ image_urls: finalUrls, image_url: finalUrls[0], credits_charged: credits });
  } catch (err) {
    const status = err instanceof FalError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : String(err) }, status);
  }
});
