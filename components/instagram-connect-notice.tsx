"use client";

import { useSearchParams } from "next/navigation";

type Tone = "error" | "warning" | "success";

const TONE_CLASSES: Record<Tone, string> = {
  error: "border-error/20 bg-error/10 text-error",
  warning: "border-warning/20 bg-warning/10 text-warning",
  success: "border-success/20 bg-success/10 text-success",
};

const MESSAGES: Record<
  string,
  { tone: Tone; title: string; detail: React.ReactNode }
> = {
  // A Meta devolve `error` tanto quando a pessoa cancela quanto quando a conta
  // não tem acesso ao app — e no Acesso Padrão o segundo caso é o comum. Não
  // dá para separar os dois pelo callback, então o texto lidera pela causa
  // provável em vez de mandar tentar de novo para sempre.
  denied: {
    tone: "warning",
    title: "Conta do Instagram ainda não autorizada",
    detail: (
      <>
        <p>
          Quase sempre isso acontece porque esta conta do Instagram ainda não
          tem acesso liberado ao nosso app da Meta — não porque você recusou
          alguma permissão. Tentar de novo não resolve sozinho.
        </p>
        <p className="mt-2">
          Peça a liberação a quem administra o Comentou, informando o @ da conta
          que você quer conectar. Depois de aceitar o convite de testador no
          Instagram (Editar perfil → Apps e sites → Convites de testador), volte
          aqui e conecte.
        </p>
        <p className="mt-2">
          Se você fechou a tela de permissões de propósito, é só conectar de
          novo.
        </p>
      </>
    ),
  },
  invalid: {
    tone: "error",
    title: "O link de conexão expirou",
    detail: (
      <p>
        O link ficou incompleto ou passou de 10 minutos. Clique em Conectar
        Instagram para começar de novo.
      </p>
    ),
  },
  forbidden: {
    tone: "error",
    title: "Sem permissão",
    detail: (
      <p>
        Só quem é dono ou administrador do espaço de trabalho pode conectar uma
        conta do Instagram.
      </p>
    ),
  },
  already_connected: {
    tone: "warning",
    title: "Esta conta do Instagram já está em uso",
    detail: (
      <>
        <p>
          Cada conta do Instagram fica ligada a um espaço de trabalho por vez, e
          esta já está ligada a outro.
        </p>
        <p className="mt-2">
          Se você já usou o Comentou antes com outro e-mail, a conta continua
          presa àquele cadastro: entre com ele e desconecte por lá, ou peça a
          quem administra o Comentou para liberar. Você também pode conectar uma
          conta do Instagram diferente.
        </p>
      </>
    ),
  },
};

export function InstagramConnectNotice() {
  const searchParams = useSearchParams();
  const status = searchParams.get("instagram");

  if (!status) return null;

  if (status === "misconfigured") {
    const missing = (searchParams.get("missing") ?? "")
      .split(",")
      .filter(Boolean);

    return (
      <Notice tone="error" title="App do Instagram não configurado">
        <p>
          Defina{" "}
          {missing.length > 0
            ? "estas variáveis de ambiente"
            : "as variáveis de ambiente necessárias"}{" "}
          e reinicie o servidor:
        </p>
        {missing.length > 0 && (
          <ul className="mt-2 space-y-1">
            {missing.map((name) => (
              <li key={name} className="font-mono text-xs">
                {name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2">
          Veja <span className="font-mono text-xs">docs/setup.md</span> para
          saber como obter cada valor. A{" "}
          <span className="font-mono text-xs">ENCRYPTION_KEY</span> precisa ser
          uma string hexadecimal de 64 caracteres.
        </p>
      </Notice>
    );
  }

  if (status === "failed") {
    const reason = searchParams.get("reason");

    return (
      <Notice tone="error" title="Não foi possível concluir a conexão">
        <p>
          O login no Instagram funcionou, mas a conexão parou no meio do
          caminho. Isso costuma ser configuração do app da Meta — permissões que
          faltam ou endereço de retorno diferente do cadastrado — e não algo que
          dê para resolver tentando de novo.
        </p>
        <p className="mt-2">
          Envie o detalhe abaixo para quem administra o Comentou.
        </p>
        {reason && (
          <p className="mt-2 text-xs opacity-80">
            <span className="font-semibold">Detalhe técnico:</span>{" "}
            <span className="font-mono break-words">{reason}</span>
          </p>
        )}
      </Notice>
    );
  }

  const known = MESSAGES[status];
  if (!known) return null;

  return (
    <Notice tone={known.tone} title={known.title}>
      {known.detail}
    </Notice>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded border p-4 text-sm ${TONE_CLASSES[tone]}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 opacity-90">{children}</div>
    </div>
  );
}
