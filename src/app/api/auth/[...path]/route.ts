import { isAuthConfigured, neonAuth } from '@/lib/auth/server';

type RouteContext = { params: Promise<{ path: string[] }> };
type RouteHandlers = {
  GET: (request: Request, context: RouteContext) => Promise<Response>;
  POST: (request: Request, context: RouteContext) => Promise<Response>;
};

const handlers: RouteHandlers | null = isAuthConfigured() ? (neonAuth().handler() as RouteHandlers) : null;

function notConfigured() {
  return Response.json({ ok: false, message: 'Neon Auth is not configured.' }, { status: 503 });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return handlers ? handlers.GET(request, context) : notConfigured();
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return handlers ? handlers.POST(request, context) : notConfigured();
}
