import { supabase } from "@/integrations/supabase/client";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

const transientError = (message: string) =>
  /failed to send|network|fetch|timeout|edge function/i.test(message);

export async function invokeFunction<T = any>(name: string, options?: InvokeOptions, retries = 1): Promise<{ data: T; error: Error | null }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data, error } = await supabase.functions.invoke<T>(name, options);
    if (!error) return { data, error: null };

    lastError = error;
    const message = (error as any)?.message || "Request failed";
    if (!transientError(message) || attempt === retries) break;
    await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
  }

  return { data: null as T, error: lastError as Error };
}