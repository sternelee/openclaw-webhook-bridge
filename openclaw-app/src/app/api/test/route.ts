// Edge runtime for Cloudflare Workers
export const runtime = "edge";

export async function GET() {
  return Response.json({ status: "ok", message: "API is working" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return Response.json({ status: "ok", received: body });
}
