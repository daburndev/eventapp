import { readPhoto } from "@/lib/services/photo-store";

export async function GET(_request: Request, context: RouteContext<"/media/[...key]">) {
  const { key } = await context.params;
  return readPhoto(key.join("/"));
}
