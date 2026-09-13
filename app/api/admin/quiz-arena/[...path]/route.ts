import { NextRequest } from "next/server";
import { proxyQuizArena } from "@/lib/server/quiz-arena-proxy";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  return proxyQuizArena(request, (await context.params).path.join("/"));
}
export { handle as GET, handle as POST, handle as PATCH };
