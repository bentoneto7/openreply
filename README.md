<div align="center">

# Comentou

Sistema comercial do Instagram: da intenção no comentário à venda acompanhável.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

</div>

Comentou transforma intenção no Instagram em vendas acompanháveis. O produto observa comentários e mensagens compatíveis, inicia a experiência configurada pela API oficial da Meta, identifica a oportunidade e entrega contexto para o atendimento humano conduzir o próximo passo.

> O comentário chegou. A oportunidade não espera.

Comentário, DM, clique, oportunidade e venda são eventos diferentes. Receita só aparece quando uma venda é registrada como confirmada; clique nunca é tratado como compra.

## Why this exists

Uma resposta rápida abre a conversa, mas a operação comercial precisa continuar: entender a origem, priorizar intenção, atribuir responsável, registrar próxima ação e acompanhar ganho ou perda. Comentou reúne essa jornada sem prometer que automação, sozinha, vende.

Comentou is built around Meta's official Instagram private replies. It does not scrape, it does not automate a browser, and it never asks for an Instagram password. That keeps your account inside Meta's rules, which matters if you care about not getting flagged.

## Features

- Keyword to DM. Match one or many keywords per post, whole-word or partial.
- Optional public reply. Post a visible comment reply on top of the DM.
- Tracked links. Swap a link for a tracked redirect and see clicks and CTR per campaign.
- Two link buttons. Send up to two tappable link buttons in one DM, each a separate tracked link with its own click stats.
- Follow gate. Optionally require a follow before you hand over the link. The DM asks the commenter to follow and tap a button; on tap, Comentou checks Meta's `is_user_follow_business` flag and only sends the link once they follow, re-prompting until then. It fails open (sends the link anyway) when Instagram does not return follow status, so a real follower is never trapped.
- Personalization. Use `{username}` in your message to greet the commenter by name.
- Per-account rate limiting. Stays under Meta's documented cap of 750 private replies per hour, and queues the overflow instead of dropping it.
- Multiple Instagram accounts. Connect several professional accounts under one workspace, each with its own limits.
- Workspaces and roles. Owner, admin, and member roles with invite links, useful if you run this for clients.
- Campaign templates. Start from a preset instead of a blank form.
- Inbox. Read your Instagram DM conversations and reply from the dashboard, inside Meta's 24-hour messaging window. Cached so it loads instantly on repeat visits.
- Commercial pipeline. Track `NOVO`, `ABORDADO`, `RESPONDEU`, `NEGOCIANDO`, `GANHO`, and `PERDIDO` with origin, assignee, offer, value, next action, and auditable transitions.
- Explainable intent. Deterministic signals classify price, purchase, urgency, objection, support, and other intent categories, with human correction preserved.
- Human-approved copilot. Local fallback summarizes context and prepares short, consultative, and direct drafts without sending them automatically.
- Confirmed results. Opportunities, wins, conversion, and revenue keep measured zero separate from unavailable data; revenue comes only from persisted confirmed sales.
- Operational health. Technical failures stay separate from commercial follow-ups, stalled negotiations, and unassigned opportunities.
- DM logs. Every send, skip, and failure is logged with a reason.
- Self-comment filtering. Your own comments never trigger a reply, since Meta rejects DMing yourself anyway.

## How it works

1. Someone comments on your Instagram post or reel.
2. Meta sends a webhook to your Comentou instance.
3. Comentou checks the comment against your active campaigns.
4. On a keyword match, it queues a job.
5. A background worker sends the configured reply, while retries and rate limits protect delivery.
6. The matching person becomes a persisted opportunity with source and intent signals.
7. A human reviews the conversation, assigns ownership, records next actions, and confirms a sale or loss when it actually happens.

The web app receives the webhook and serves the commercial workspace. A separate worker process handles automated delivery because sends must survive rate limits and retries. Both use the same Postgres and Redis, and all private records are scoped by workspace.

## Quick start

You need a few free accounts before anything works: a Meta developer app, a Resend account for login emails, and somewhere to host (Vercel for the web app, Railway for the worker plus Postgres and Redis). The Instagram account you connect has to be a Business or Creator account, not a personal one.

The honest version: the code deploys in minutes, but the Meta app setup is the part that takes real time. Read [docs/setup.md](docs/setup.md) before you start. It is the single setup guide, covering hosting, your domain, the environment, and every Meta wrong turn so you do not have to find them yourself.

### Deploy the web app


### Run it locally

```bash
Clone o repositório privado da Comentou e entre na pasta do projeto.
npm install
cp .env.example .env      # then fill in the values, see docs/setup.md
docker-compose up -d      # starts Postgres and Redis
npm run db:migrate
npm run dev               # web app on http://localhost:3000
npm run worker            # in a second terminal, this sends the DMs
```

Two processes, always. `npm run dev` serves the app and receives webhooks. `npm run worker` is what actually sends the messages. If comments come in and no DM ever arrives, the worker is the first thing to check.

Full environment variables and the production layout are in [docs/setup.md](docs/setup.md).

## Set it up with your AI assistant

If you use Claude Code, Cursor, or a similar tool, the Meta setup is a lot faster with an assistant driving it. There is a ready-made prompt in the [Set it up with an AI assistant](docs/setup.md#set-it-up-with-an-ai-assistant) section of the setup guide. Paste it into your assistant inside a clone of this repo, hand over your keys as it asks, and it will walk you through connecting Instagram and going live.

## Tech stack

- Next.js 16 and React 19 for the web app and API routes
- Prisma 7 with PostgreSQL
- BullMQ on Redis for the send queue and the worker
- Auth.js (NextAuth) with email magic links through Resend
- Tailwind CSS for the interface
- The official Instagram API with Instagram Login

For the complete stack — application libraries, the two runtime processes, and the free services this runs on (Vercel, Neon, Redis Cloud, an Oracle Cloud always-free VM for the worker, Resend, Meta) — see [docs/stack.md](docs/stack.md).

## Contributing

Issues and pull requests are welcome. If you hit a Meta quirk that is not in the setup guide, a PR that documents it is worth as much as a code fix, because that is where everyone loses time.

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## Credits

Built and maintained by Diwen Huang.

- GitHub: [@diwenne](https://github.com/diwenne)
- Website: [diwenhuang.ca](https://diwenhuang.ca)
- X: [@diwenne](https://x.com/diwennee)
- Instagram: [@devdiwen](https://instagram.com/devdiwen)

Comentou is a fork of [instagram-comment-to-dm](https://github.com/im-anishraj/instagram-comment-to-dm) by [Anish Raj](https://github.com/im-anishraj), also MIT licensed. The billing layer and plan caps were removed, and the setup was documented from scratch.

## Star the repo

If Comentou is useful to you, star it. It is the simplest way to help the project reach the next person looking for a free way to do this.

## License

MIT. See [LICENSE](LICENSE).
