import { supabase } from "@/integrations/supabase/client";

export type ProjectBuildFile = { path: string; content: string };

const GRID_BACKGROUND_FALLBACK = `

export const GridBackground = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <div
      className="absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(120,120,160,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(120,120,160,0.25) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    />
  </div>
);
`;

const hasGridBackgroundImport = (files: ProjectBuildFile[]) =>
  files.some((file) =>
    /import\s*\{[^}]*\bGridBackground\b[^}]*\}\s*from\s*["']@\/components\/Backgrounds["']/.test(file.content),
  );

const exportsGridBackground = (content: string) =>
  /export\s+(?:const|function|class)\s+GridBackground\b/.test(content) ||
  /export\s*\{[^}]*\bGridBackground\b[^}]*\}/.test(content);

export function normalizeProjectFilesForDeploy(files: ProjectBuildFile[]) {
  const normalized = files.map((file) => ({ ...file }));
  const patches: ProjectBuildFile[] = [];
  const fixed: string[] = [];

  if (hasGridBackgroundImport(normalized)) {
    const backgrounds = normalized.find((file) => file.path === "src/components/Backgrounds.tsx");
    if (backgrounds && !exportsGridBackground(backgrounds.content)) {
      backgrounds.content = `${backgrounds.content.trimEnd()}${GRID_BACKGROUND_FALLBACK}`;
      patches.push(backgrounds);
      fixed.push("GridBackground export");
    }
  }

  return { files: normalized, patches, fixed };
}

export async function prepareProjectFilesForDeploy(projectId: string, currentFiles: ProjectBuildFile[] = []) {
  const { data, error } = await supabase
    .from("ai_project_files")
    .select("path, content")
    .eq("project_id", projectId);

  if (error) throw error;

  const latest = ((data ?? []) as ProjectBuildFile[]).length ? ((data ?? []) as ProjectBuildFile[]) : currentFiles;
  const result = normalizeProjectFilesForDeploy(latest);

  if (result.patches.length) {
    const { error: upsertError } = await (supabase as any)
      .from("ai_project_files")
      .upsert(
        result.patches.map((file) => ({ project_id: projectId, path: file.path, content: file.content })),
        { onConflict: "project_id,path" },
      );
    if (upsertError) throw upsertError;
  }

  return result;
}