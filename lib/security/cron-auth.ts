import { timingSafeEqual } from "node:crypto";

/**
 * Cron usa um segredo próprio. Em especial, uma instalação incompleta nunca
 * pode transformar a ausência da variável em uma credencial válida como
 * `Bearer undefined`.
 */
export function isAuthorizedCronRequest(request: Pick<Request, "headers">) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(secret);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}
