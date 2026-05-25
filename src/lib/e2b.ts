// Client helpers for the E2B-powered edge functions.
// Usage:
//   const r = await e2bExecuteCode({ code: 'print(2+2)' });
//   const r = await e2bGenerateDocument({ type: 'pptx', spec, filename: 'deck.pptx' });
//   const r = await e2bDataAnalysis({ code, datasets: [{ name: 'data.csv', contentBase64 }] });
import { supabase } from "@/integrations/supabase/client";

export type E2bFile = {
  name: string;
  storagePath: string;
  size: number;
  mime: string;
  signedUrl: string;
};

export type E2bResponse = {
  execution_id: string;
  stdout?: string;
  stderr?: string;
  error?: string | null;
  results?: Array<Record<string, unknown>>;
  files?: E2bFile[];
  file?: E2bFile | null;
  duration_ms?: number;
};

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}

export function e2bExecuteCode(args: {
  code: string;
  language?: "python" | "javascript";
  input_files?: Array<{ path: string; contentBase64: string }>;
  output_files?: string[];
  timeout_sec?: number;
  conversation_id?: string;
}): Promise<E2bResponse> {
  return invoke("e2b-execute-code", args);
}

export function e2bGenerateDocument(args: {
  type: "pptx" | "docx" | "xlsx" | "pdf";
  spec: Record<string, unknown>;
  filename?: string;
  conversation_id?: string;
}): Promise<E2bResponse> {
  return invoke("e2b-generate-document", args);
}





export function e2bDataAnalysis(args: {
  code: string;
  dataset?: { name: string; contentBase64: string };
  datasets?: Array<{ name: string; contentBase64: string }>;
  output_files?: string[];
  timeout_sec?: number;
  conversation_id?: string;
}): Promise<E2bResponse> {
  return invoke("e2b-data-analysis", args);
}

/** Convert a browser File to base64 (no data URL prefix). */
export async function fileToBase64(file: File | Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}
