import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OperatorRun = {
  id: string;
  user_id: string;
  goal: string;
  status: string;
  current_phase: string | null;
  project_id: string | null;
  published_url: string | null;
  result: any;
  error: string | null;
  created_at: string;
  mode?: string | null;
  chat_response?: string | null;
};

export type OperatorStep = {
  id: string;
  run_id: string;
  step_no: number;
  agent: string;
  title: string;
  description: string | null;
  tool: string | null;
  tool_input: any;
  tool_output: any;
  status: string;
  error: string | null;
};

export type OperatorMsg = {
  id: string;
  run_id: string;
  agent: string;
  role: string;
  content: string;
  metadata: any;
  created_at: string;
};

export type OperatorArtifact = {
  id: string;
  run_id: string;
  step_id: string | null;
  kind: string;
  url: string | null;
  content: string | null;
  metadata: any;
  created_at: string;
};

export function useOperatorRun(runId: string | null) {
  const [run, setRun] = useState<OperatorRun | null>(null);
  const [steps, setSteps] = useState<OperatorStep[]>([]);
  const [messages, setMessages] = useState<OperatorMsg[]>([]);
  const [artifacts, setArtifacts] = useState<OperatorArtifact[]>([]);

  useEffect(() => {
    if (!runId) {
      setRun(null); setSteps([]); setMessages([]); setArtifacts([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const [{ data: r }, { data: s }, { data: m }, { data: a }] = await Promise.all([
        supabase.from("operator_runs").select("id,user_id,goal,status,current_phase,project_id,published_url,result,metadata,error,last_tick_at,created_at,updated_at,mode,chat_response,browser_session_id,live_view_url").eq("id", runId).maybeSingle(),
        supabase.from("operator_steps").select("*").eq("run_id", runId).order("step_no"),
        supabase.from("operator_agent_messages").select("*").eq("run_id", runId).order("created_at"),
        supabase.from("operator_artifacts").select("*").eq("run_id", runId).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setRun(r as any); setSteps((s ?? []) as any); setMessages((m ?? []) as any); setArtifacts((a ?? []) as any);
    };
    load();

    const ch = supabase
      .channel(`operator-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "operator_runs", filter: `id=eq.${runId}` },
        (p) => setRun(p.new as any))
      .on("postgres_changes", { event: "*", schema: "public", table: "operator_steps", filter: `run_id=eq.${runId}` },
        () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "operator_agent_messages", filter: `run_id=eq.${runId}` },
        (p) => setMessages((prev) => [...prev, p.new as any]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "operator_artifacts", filter: `run_id=eq.${runId}` },
        (p) => setArtifacts((prev) => [p.new as any, ...prev]))
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [runId]);

  return { run, steps, messages, artifacts };
}

export async function startOperatorRun(goal: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("operator-orchestrator", {
    body: { goal, user_id: userId },
  });
  if (error) { console.error(error); return null; }
  return (data as any)?.run_id ?? null;
}

export async function stopOperatorRun(runId: string) {
  await supabase.from("operator_runs").update({ status: "failed", error: "Stopped by user" }).eq("id", runId);
}
