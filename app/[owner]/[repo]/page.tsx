import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReversePromptHome } from "@/components/reverse-prompt-home";
import { isHomeExampleRepo } from "@/lib/home-example-repos";
import { isValidGitHubRepoPath, normalizeRepoSegment } from "@/lib/parse-github-repo";
import { getSupabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{ owner: string; repo: string }>;
};

export default async function RepoPage({ params }: PageProps) {
  await connection();
  const { owner: ownerRaw, repo: repoRaw } = await params;
  const owner = decodeURIComponent(ownerRaw);
  const repo = decodeURIComponent(repoRaw);

  if (!isValidGitHubRepoPath(owner, repo)) {
    notFound();
  }

  const repoNorm = normalizeRepoSegment(repo);
  const initialRepoInput = `${owner}/${repoNorm}`;

  let cachedPrompt: string | undefined;
  try {
    const supabase = getSupabase();
    if (supabase) {
      if (!isHomeExampleRepo(owner, repoNorm)) {
        const { error: viewsError } = await supabase.rpc("increment_views", {
          p_owner: owner,
          p_repo: repoNorm,
        });
        if (viewsError) {
          console.warn("[repo-page] increment_views:", viewsError.message);
        }
      }
      const { data } = await supabase
        .from("prompt_cache")
        .select("prompt")
        .eq("owner", owner)
        .eq("repo", repoNorm)
        .maybeSingle();
      if (data?.prompt) {
        cachedPrompt = data.prompt as string;
      }
    }
  } catch {
    // silently ignore — fall back to client-side auto-submit
  }

  return (
    <ReversePromptHome
      initialRepoInput={initialRepoInput}
      autoSubmit={!cachedPrompt}
      initialPrompt={cachedPrompt}
    />
  );
}
