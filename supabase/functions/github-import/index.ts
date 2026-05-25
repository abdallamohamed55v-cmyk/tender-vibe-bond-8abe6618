import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BodySchema = z.object({ project_id: z.string().uuid(), repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/) })

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')
  const token = authHeader.replace('Bearer ', '')
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user?.id) throw new Error('Unauthorized')
  return data.user.id
}
async function apiKeyFromDb(pattern: string) {
  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data } = await service.from('api_keys').select('api_key,service').ilike('service', pattern).eq('is_active', true).eq('is_blocked', false).limit(1)
  return data?.[0]?.api_key as string | undefined
}
async function getUserGithubToken(userId?: string) {
  if (!userId) return undefined
  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data } = await service
    .from('user_github_connections')
    .select('access_token')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.access_token as string | undefined
}
async function getGithubToken(userId?: string) {
  return await getUserGithubToken(userId) || Deno.env.get('GITHUB_TOKEN') || Deno.env.get('GH_TOKEN') || Deno.env.get('GITHUB_PAT') || await apiKeyFromDb('%github%')
}
async function github(path: string, raw = false, userId?: string) {
  const token = await getGithubToken(userId)
  if (!token) throw new Error('GitHub token is not configured in backend')
  const res = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
  const text = await res.text()
  if (!res.ok) throw new Error(`GitHub API failed [${res.status}]: ${text}`)
  return raw ? text : JSON.parse(text)
}
const skip = /(^|\/)(node_modules|dist|build|\.git|\.next|coverage|bun\.lockb|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$|\.(png|jpe?g|gif|webp|ico|mp4|mov|zip|pdf|woff2?|ttf)$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const userId = await requireUser(req)
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const { project_id, repo } = parsed.data
    const service = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: project } = await service.from('projects').select('id').eq('id', project_id).eq('user_id', userId).maybeSingle()
    if (!project) return json({ error: 'Project not found' }, 404)
    const tree = await github(`/repos/${repo}/git/trees/HEAD?recursive=1`, false, userId)
    const blobs = (tree.tree || []).filter((x: any) => x.type === 'blob' && x.size <= 160_000 && !skip.test(x.path)).slice(0, 120)
    const rows = []
    for (const b of blobs) {
      const content = await github(`/repos/${repo}/contents/${encodeURIComponent(b.path).replaceAll('%2F', '/')}`, true, userId)
      rows.push({ project_id, path: b.path, content })
    }
    await service.from('ai_project_files').delete().eq('project_id', project_id)
    if (rows.length) {
      const { error } = await service.from('ai_project_files').insert(rows)
      if (error) throw error
    }
    const [owner, name] = repo.split('/')
    await service.from('projects').update({ github_owner: owner, github_repo: name, github_url: `https://github.com/${repo}`, repo_url: `https://github.com/${repo}`, updated_at: new Date().toISOString() }).eq('id', project_id).eq('user_id', userId)
    return json({ ok: true, imported: rows.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed'
    return json({ error: msg }, msg === 'Unauthorized' ? 401 : 500)
  }
})
