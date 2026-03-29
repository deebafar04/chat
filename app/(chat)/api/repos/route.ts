import { getAvailableRepos } from "@/lib/repos";

export async function GET() {
  const repos = await getAvailableRepos();
  return Response.json({ repos });
}
