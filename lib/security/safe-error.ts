type ErrorWithMetadata = Error & {
  code?: unknown;
  subcode?: unknown;
  status?: unknown;
};

/**
 * Gera metadados diagnósticos sem serializar a exceção original. Exceções de
 * APIs externas podem carregar URL, token, destinatário ou texto da mensagem
 * em `message`, `cause` e propriedades enumeráveis; nada disso deve ir ao log.
 */
export function getSafeErrorMetadata(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: "UnknownError" };
  }

  const candidate = error as ErrorWithMetadata;
  return {
    name: error.name || "Error",
    ...(typeof candidate.code === "number" || typeof candidate.code === "string"
      ? { code: candidate.code }
      : {}),
    ...(typeof candidate.subcode === "number"
      ? { subcode: candidate.subcode }
      : {}),
    ...(typeof candidate.status === "number"
      ? { status: candidate.status }
      : {}),
  };
}

export function logServerError(event: string, error: unknown) {
  console.error(event, getSafeErrorMetadata(error));
}

export function logServerWarning(event: string, error: unknown) {
  console.warn(event, getSafeErrorMetadata(error));
}
