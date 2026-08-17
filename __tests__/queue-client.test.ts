import { afterEach, describe, expect, it } from "vitest";
import { getRedisConnection } from "@/lib/queue/client";

/**
 * O ioredis trata uma URL ausente como "conecte em localhost:6379", então um
 * worker publicado sem REDIS_URL subia sem erro e ficava invisível para o
 * painel. A conexão precisa recusar a partida nomeando a variável.
 *
 * Só o caminho de falha é exercitado: ele lança antes de construir o cliente,
 * então nenhum socket é aberto e o singleton do módulo continua nulo.
 */
describe("getRedisConnection", () => {
  const original = process.env.REDIS_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });

  it("recusa a partida nomeando REDIS_URL quando a variável falta", () => {
    delete process.env.REDIS_URL;
    expect(() => getRedisConnection()).toThrow(/REDIS_URL/);
  });
});
