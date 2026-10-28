# Mestre dos Negócios

Jogo de perguntas 1v1 por turnos sobre Administração — versão web do jogo físico, no estilo Perguntados, com feedback que ensina na hora (estilo Duolingo).
Gire a roleta, acerte perguntas das 6 áreas, conquiste os 6 personagens e desafie o rival em duelos.

| | |
|---|---|
| **Jogo** | React + Vite, engine pura em TypeScript, modo online com Supabase e Vercel |
| **Banco de questões** | [`banco-questoes/`](banco-questoes/) — 347 questões em 6 áreas, no padrão "modo jogo" |
| **Plano técnico** | [`docs/PLANO_TECNICO.md`](docs/PLANO_TECNICO.md) |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor local em http://localhost:5173 (modo hot-seat: dois jogadores no mesmo aparelho) |
| `npm test` | Testes: engine, API e SQL (RLS) num Postgres embutido |
| `npm run lint` | ESLint + checagem de tipos |
| `npm run build` | Build de produção + checagem de que o gabarito não vazou no bundle |
| `npm run questions` | `banco-questoes/banco-final/banco-questoes.json` → `server/questions.json` (valida o banco) |
| `npm run e2e:online` | Teste ponta a ponta do modo online (precisa de `npm run dev` e Supabase rodando) |
| `npm run images` | Gera WebP em `src/assets/` a partir de `MESTRE DOS NEGÓCIOS.zip` (material do jogo físico, fora do repositório) |
| `npm run icons` | Gera os ícones do app (PWA, favicon, iOS) em `public/icons/` |

## Estrutura

```
src/engine/       regras puras (reduce, settle, toPublicView) + testes
src/game/         GameClient: local (hot-seat, só em dev) e remoto (Supabase + /api/game)
src/screens/      Home e Partida (roleta, pergunta, coroa, duelo, fim)
src/ui/           componentes visuais (roleta, painel do jogador, fichas)
src/content/      nomes, cores e imagens das áreas
src/assets/       personagens e fichas em WebP
public/           manifesto do PWA, service worker (sw.js) e ícones
server/           lógica da API + banco normalizado com gabarito (nunca importar em src/)
api/game.ts       Vercel Function que expõe server/http.ts
supabase/         config local, migrations (tabelas, RLS, funções) e teste do SQL
scripts/          normalização de perguntas, otimização de imagens, checagens
banco-questoes/   criação e revisão das questões (fonte do banco do jogo)
docs/             plano técnico, mecânica de referência e arquitetura
```

## Banco de questões

As questões são escritas e revisadas em [`banco-questoes/`](banco-questoes/) (ver o [README de lá](banco-questoes/README.md)).
O jogo usa o banco final, e o fluxo para atualizar é:

```bash
cd banco-questoes
python scripts/montar_base.py && python scripts/montar_banco_final.py
python scripts/validar.py banco-final/banco-questoes.json   # 0 erros, 0 avisos
cd .. && npm run questions                                  # gera server/questions.json para o jogo
```

O que o jogo usa de cada questão:

| No banco | No jogo |
|---|---|
| `mecanicas` (Giro, Coroa, Duelo) e `tempo_seg` | Pergunta normal = Giro (30 s), coroa = Coroa (45 s), duelo = Duelo (20 s) |
| `cenario` (título + texto) | Caso curto acima do enunciado |
| `dificuldade` | Etiqueta Fácil / Média / Difícil na pergunta |
| `areas_secundarias` | Etiquetas "+ Área" nas questões interdisciplinares |
| `feedback.curto`, feedback por alternativa, `feedback.explicacao` | Feedback depois da resposta: por que errou, a ideia certa e o "Saiba mais" |
| XP do banco (Giro 10, Duelo 15, Coroa 30) | XP por acerto, mostrado na resposta, no placar e no fim da partida (`RULES.xpFor`) |
| `tipo: numerico` (desempate) | Ainda não usado: o desempate do duelo é por tempo |

## Engine

```ts
import { createMatch, reduce, settle, toPublicView } from './src/engine'

let state = createMatch({ id, code, creatorId, creatorName, now })
const r = reduce(state, { type: 'SPIN', by: creatorId }, { now, rng, bank })
state = r.state            // r.spin, r.reveal, r.events para a UI
toPublicView(state, bank)  // seguro para enviar ao cliente
```

Comandos: `JOIN`, `SPIN`, `ANSWER`, `CHOOSE_CROWN`, `START_DUEL`, `DUEL_NEXT`, `RESIGN`.
Balanceamento em [src/engine/rules.ts](src/engine/rules.ts).

## Modo online (Supabase)

Arquitetura: o navegador entra com login anônimo do Supabase, envia jogadas para `POST /api/game`
(que roda a engine com a service role) e recebe as jogadas do rival por Realtime na tabela `matches`.
O gabarito e o estado completo (`match_state`) nunca saem do servidor.

### Opção A — Supabase local (precisa do Docker Desktop aberto)

```bash
npx supabase start
```

O comando aplica `supabase/migrations/` e mostra `API URL`, `anon key` e `service_role key`.
Copie para `.env.local` (modelo em `.env.example`) e rode `npm run dev`.

### Opção B — Projeto na nuvem (supabase.com, plano grátis, região São Paulo)

1. Crie o projeto.
2. **SQL Editor**: cole e rode `supabase/migrations/20261027000000_matches.sql`.
3. **Authentication → Sign In / Providers**: ative *Allow anonymous sign-ins*.
4. **Project Settings → API**: copie URL, anon key e service_role key para `.env.local`.

> `.env.local` nunca vai para o repositório (está no `.gitignore`).
