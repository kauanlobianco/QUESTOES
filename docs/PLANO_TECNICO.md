# Mestre dos Negócios Web — Plano Técnico

Status: decisões tomadas, pronto para executar.
Fontes: [`MECANICA_CLASSIC_CLEAN.md`](MECANICA_CLASSIC_CLEAN.md), [`ESPEC_ARQUITETURA.md`](ESPEC_ARQUITETURA.md), `MESTRE DOS NEGÓCIOS.zip`.

---

## 0. O que já temos (inventário do zip)

| Ativo | Conteúdo | Uso no web |
|---|---|---|
| `data/questions.json` | 300 perguntas: 6 áreas × 50 (20 fácil, 20 média, 10 difícil). Campos `q, a–d, ans, diff, ex` | Banco do jogo. O `ex` (explicação) vira feedback pós-resposta |
| 6 áreas + cores | Empreendedorismo `#8b5cf6`, Marketing `#ec4899`, Finanças `#16a34a`, Operações `#2563eb`, Liderança `#f97316`, Estratégia `#eab308` | Fatias da roleta, temas de tela |
| `hero-*.png` (6) | Personagem de cada área (até 1,8 MB cada) | "Coroas" = conquistar o personagem. Converter para WebP |
| `ficha-1..6.png` | Fichas redondas dos personagens | Slots de coroa no tabuleiro e ícones da roleta |
| `tabuleiro_v6.png` | Trilha `1 → 2 → 3 → 👑` + 6 slots de personagem por jogador | Vira o **painel do jogador** na tela, igual ao físico |
| `roleta_*.png` | Roleta de 6 fatias | Referência visual. Redesenhada em SVG com 7ª fatia |
| Cartas Coringa | `PULAR` e `DUELO` | DUELO vira a mecânica de duelo; PULAR vira backlog |

Conclusão: o físico já implementa o loop do Classic (medidor de 3 cargas → coroa → 6 personagens). A adaptação é natural.

---

## 1. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Cliente | **Vite + React 19 + TypeScript** (SPA) | Build instantâneo, sem SSR. Jogo não precisa de SEO |
| Estilo | **Tailwind CSS v4** | Tokens de cor das áreas em um lugar; mobile-first rápido |
| Animação | **Motion** (ex-Framer Motion) + **canvas-confetti** | Roleta com física de desaceleração, transições de tela, feedback de acerto/erro. Tudo em GPU (transform/opacity) |
| Roleta | **SVG próprio** (7 fatias, fichas como imagem) | Nítida em qualquer tela, recolorível, alvo de rotação exato |
| Som | **Howler.js** com sprite único | Um arquivo, latência baixa no mobile |
| Estado local | **Zustand** | Pequeno, sem boilerplate |
| Rotas | **React Router** | `/`, `/p/:code`, `/m/:id` |
| API | **Vercel Functions (Node, região `gru1`)** em `/api` | Mesmo repo, mesmo TypeScript, deploy por `git push`. Sem Deno, sem Docker |
| Dados + Auth + Tempo real | **Supabase** (Postgres `sa-east-1`, Auth anônimo, Realtime) | Login invisível, banco relacional, push de mudanças. Free tier basta |
| Testes | **Vitest** (regras) + **Playwright** (2 navegadores jogando) | Regras são o risco; testadas sem UI |
| PWA | **vite-plugin-pwa** | "Adicionar à tela inicial", ícone, abre em tela cheia |

Descartados:
- **Next.js**: SSR/RSC não agrega nada a um jogo; só complexidade.
- **Supabase Edge Functions**: Deno + Docker local no Windows. Vercel Functions dá o mesmo resultado em Node.
- **Firebase**: equivalente, mas regras de segurança em NoSQL são mais frágeis para estado de partida.
- **PartyKit / WebSocket próprio**: ótimo para tempo real síncrono. Nosso jogo é **assíncrono**; precisa de persistência, não de socket.
- **Phaser / PixiJS / Rive**: a UI é de cartas e botões. DOM + SVG + Motion entrega o visual com menos código.

---

## 2. Multiplayer por link

### 2.1 Modelo: assíncrono por turnos, servidor autoritativo

Igual ao original: cada um joga quando pode. O amigo pode responder agora ou amanhã.
Se os dois estiverem online, a tela atualiza ao vivo (Realtime). Se não, o estado é lido ao abrir.

```
 Navegador A ──POST /api/game {cmd}──▶ Vercel Function ──▶ engine.reduce(state, cmd)
                                            │                 (TS puro, sem I/O)
                                            ▼
                                      Supabase Postgres
                                  ┌─ match_state (privado: estado completo)
                                  └─ matches     (público: visão sanitizada)
                                            │ Realtime (postgres_changes)
 Navegador B ◀──────────────────────────────┘
```

### 2.2 Fluxo sem fricção

```
1. A abre o site → login anônimo invisível → digita apelido (1 campo, salvo)
2. "Nova partida" → servidor cria partida + código K7Q2XZ → A já joga o 1º turno
3. Botão "Desafiar amigo" → Web Share API / WhatsApp / copiar
      https://mestre.app/p/K7Q2XZ
4. B abre o link → login anônimo → apelido → entra como P2 (abrir = aceitar)
5. Fim de cada turno → botão "Avisar no WhatsApp" com o link da partida
```

- Sem cadastro, sem senha, sem e-mail.
- Código de 6 caracteres sem ambíguos (`0/O`, `1/I/L` fora).
- Terceira pessoa no link: "Partida cheia" + "Criar a sua".
- Sessão anônima vive no navegador. Trocar de aparelho perde as partidas. Mitigação futura: vincular Google (Supabase converte anônimo em conta permanente sem perder dados).

### 2.3 Regras de segurança

- **Gabarito nunca chega ao cliente.** O banco de perguntas fica em `server/questions.json`, importado só pela função. Teste de build garante que o bundle do cliente não o contém.
- Cliente recebe pergunta sem resposta. Gabarito + explicação só voltam depois de responder.
- **Tempo medido no servidor:** `servedAt` gravado ao sortear; resposta após `30s + 2s` = erro.
- **Recarregar não troca a pergunta.** Ela fica gravada no estado. Fechar o app no meio = erro ao voltar.
- Concorrência otimista: toda escrita exige `version`; duplo clique é rejeitado.
- RLS: jogador lê só partidas onde é P1 ou P2. `match_state` só o service role lê.
- Expiração preguiçosa: sem cron. Qualquer leitura de partida vencida (72h sem jogar) a encerra.

### 2.4 Dados (Supabase)

```sql
profiles    (id uuid pk = auth.uid, nickname text, created_at)
matches     (id uuid pk, code text unique, p1 uuid, p2 uuid null,
             status text, turn_of smallint, version int,
             view jsonb,              -- estado público sanitizado
             updated_at, expires_at)
match_state (match_id uuid pk fk, state jsonb)   -- completo, privado
```

Escrita atômica via função SQL `commit_match(id, version, state, view)`: atualiza as duas tabelas se a versão bater.

### 2.5 API — um endpoint, comandos tipados

`POST /api/game` com `Authorization: Bearer <jwt anônimo>`.

| Comando | Entrada | Efeito |
|---|---|---|
| `create` | — | Cria partida e código; P1 em `SPIN` |
| `join` | `code` | Entra como P2 |
| `spin` | `matchId, v` | Sorteia fatia; se área, sorteia pergunta e grava `servedAt` |
| `answer` | `matchId, v, option` | Corrige, aplica regra, devolve `{correct, correctIndex, explanation, view}` |
| `chooseCrown` | `matchId, v, area` | Pergunta de coroa da área escolhida |
| `startDuel` | `matchId, v, requested, offered` | Valida apostas, inicia duelo |
| `resign` | `matchId` | Desistência |
| `rematch` | `matchId` | Nova partida com os mesmos dois jogadores |

Leituras (lista de partidas, partida atual) vão direto ao Supabase via RLS.

### 2.6 Engine compartilhada

`src/engine/` — TypeScript puro, zero dependências, zero I/O.

```ts
reduce(state, command, ctx: { now, rng, questions }) → { state, events }
toPublicView(state) → view
```

- Servidor usa com dados reais.
- `LocalGameClient` usa no navegador para desenvolver a UI antes do backend (hot-seat no mesmo aparelho).
- Toda regra coberta por teste unitário. `rng` injetado = testes determinísticos.

---

## 3. Mecânicas: manter, adaptar, cortar

### 3.1 Manter idêntico (coração da diversão)

| Mecânica | Regra |
|---|---|
| Roleta | Gira a cada pergunta. Animação longa e suspense é parte da graça |
| Acertou, continua | Turno segue enquanto acertar. Errou ou estourou o tempo, passa a vez |
| Medidor de cargas | 3 acertos normais → escolha de coroa. Mesmo `1-2-3-👑` do tabuleiro físico |
| Fatia especial | 7ª fatia **Coringa** = atalho direto para a escolha de coroa |
| Pergunta de coroa | Escolhe área que ainda não tem. Acerta → ganha o personagem. Cargas zeram sempre |
| Vitória | 6 personagens = Mestre dos Negócios |
| Duelo | Aposta coroa contra coroa, mesmas perguntas para os dois |
| P1 joga antes do aceite | Criador joga já e manda o link. Ninguém espera |
| Limite no 1º turno | Máx. 1 coroa no turno de abertura do P1 (equivalente ao `CROWNS_EXCEDED`) |
| Desistir | A qualquer momento |

### 3.2 Adaptar

| Original | Nosso | Motivo |
|---|---|---|
| `PENDING_APPROVAL` + aceitar/recusar | Abrir o link = aceitar | Zero cliques extras |
| 14 subestados `Pn_*` | `turnOf` + `phase` (`SPIN, QUESTION, CROWN_CHOICE, DUEL_ANSWERING, DUEL_RESPONSE, FINAL_DUEL`) | Mesma semântica, metade do código |
| Duelo: desempate com pergunta extra | Mais acertos vence → empate: menor tempo total → empate: defensor | Assíncrono não comporta mais uma ida e volta |
| Duelo: quando o desafiado responde | Ao abrir a partida, responde o duelo primeiro e depois joga seu turno normal | Fluxo único, sem tela de espera |
| Duelo final | Rodada 25: mais coroas vence; empate → Duelo Final (6 perguntas, reaproveita o duelo) | Garante fim de partida |
| Expiração por cron | Verificação preguiçosa na leitura, 72h | Zero infraestrutura |
| Pergunta só com texto | + explicação (`ex`) após responder | Valor educacional para a universidade, custo zero |
| Dificuldade não usada | Normal: qualquer. Coroa: média/difícil. Duelo: 2 de cada | Coroa vale mais, pergunta mais dura |
| — | Sem repetir pergunta na mesma partida | 300 perguntas cobrem ~3 partidas sem repetição |

Regras do duelo:
- Requisitos: desafiante tem ≥1 coroa; rival tem ≥1 coroa que o desafiante não tem.
- Desafiante escolhe a coroa pedida (do rival) e a apostada (sua).
- 6 perguntas, uma por área, 20s cada.
- Desafiante vence → leva a coroa pedida.
- Defensor vence → leva a apostada (se já tiver, ela só sai do desafiante).
- Checa vitória após o duelo.

### 3.3 Cortar

Power-ups, moedas, vidas/energia, chance extra, anúncios, loja, ranking, pets, eventos live-ops, chat, avaliar/reportar pergunta, mídia em pergunta (imagem/vídeo), partida contra aleatório, notificação push.

Backlog (só depois de validar com jogadores):
1. **Carta PULAR**: 1 por partida, troca a pergunta atual. Vem do jogo físico.
2. Push "sua vez" (Web Push).
3. Vincular conta Google para jogar em vários aparelhos.
4. Estatísticas por área ("você domina Finanças").
5. Painel para editar perguntas (move o banco para o Postgres).

### 3.4 Parâmetros (todos em `src/engine/rules.ts`)

| Parâmetro | Valor |
|---|---|
| Fatias da roleta | 6 áreas + Coringa, peso igual (1/7) |
| Cargas para coroa | 3 |
| Coroas para vencer | 6 |
| Tempo por pergunta | 30s (perguntas são longas, estilo caso) |
| Tempo no duelo | 20s |
| Perguntas no duelo | 6 |
| Coroas no 1º turno | máx. 1 |
| Limite de rodadas | 25 |
| Expiração | 72h sem jogar → quem devia jogar perde |

---

## 4. Estrutura do repositório

```
mestre-dos-negocios/
├─ src/
│  ├─ engine/            regras puras + testes (compartilhado)
│  ├─ game/              GameClient (Local | Remote), store Zustand
│  ├─ screens/           Home, Join, Match, Question, CrownChoice, Duel, Result
│  ├─ components/        Wheel, PlayerBoard, ChargeMeter, CrownSlots, Timer, AnswerButton
│  └─ assets/            WebP dos personagens, sprite de som
├─ api/game.ts           Vercel Function → engine + Supabase
├─ server/questions.json banco com gabarito (nunca no bundle)
├─ supabase/migrations/  tabelas, RLS, commit_match
└─ scripts/              importar perguntas, otimizar imagens
```

`ALVO.apkm`, `rea-main*` e o zip ficam fora do repositório (`.gitignore`).

---

## 5. Fases de implementação

Cada fase termina jogável ou testável.

### Fase 0 — Fundação
- `git init`, Vite + React + TS + Tailwind, Vitest, lint.
- Script: `questions.json` → formato normalizado `{id, area, diff, text, options[4], correctIndex, explanation}`, com validação.
- Script: PNGs → WebP 512px (~40 KB cada). Mapear fichas ↔ áreas.
- Tokens de cor e fontes do físico (Fredoka + Nunito).

**Pronto quando:** app abre, assets otimizados, banco validado.

### Fase 1 — Engine de regras
- Estado, comandos e `reduce` cobrindo: roleta, cargas, coroa, limite do 1º turno, timeout, troca de turno, rodadas, duelo, duelo final, vitória, desistência, expiração.
- `toPublicView` sem gabarito.
- Testes para cada regra e para partidas completas simuladas.

**Pronto quando:** partida inteira simulada em teste, do início à vitória.

### Fase 2 — Jogo local (hot-seat)
- `LocalGameClient` rodando a engine no navegador.
- Telas: Home, Partida (dois painéis-tabuleiro), Roleta, Pergunta com timer, feedback + explicação, Escolha de coroa, Duelo, Vitória.
- Roleta: começa a girar no toque, desacelera até a fatia sorteada (esconde a latência da API).
- Mobile-first (360px), funciona no PC.

**Pronto quando:** duas pessoas jogam uma partida completa no mesmo celular.

### Fase 3 — Backend
- Projeto Supabase (`sa-east-1`): migrations, RLS, `commit_match`, Auth anônimo.
- `api/game.ts`: valida JWT, carrega estado, aplica engine, grava atômico.
- `RemoteGameClient` + assinatura Realtime. Troca de cliente sem mudar telas.

**Pronto quando:** dois navegadores jogam a mesma partida via API.

### Fase 4 — Fluxo do link
- Apelido, criar partida, compartilhar (Web Share / WhatsApp / copiar), `/p/:code`.
- Home com "Minhas partidas": sua vez / vez do amigo / encerradas.
- "Avisar no WhatsApp" ao fim do turno. Revanche.

**Pronto quando:** link enviado por WhatsApp abre e joga em outro celular sem nenhum cadastro.

### Fase 5 — Polimento
- Sons, vibração (`navigator.vibrate`), confete na coroa e na vitória.
- Animação de conquista do personagem (hero em tela cheia).
- PWA, estados de carregamento, reconexão, erros amigáveis.
- Performance: 60 fps na roleta em Android médio; bundle inicial < 200 KB gz.

### Fase 6 — Deploy e teste real
- Vercel (`gru1`) + Supabase produção. Domínio.
- Playwright: dois contextos jogando uma partida completa.
- Playtest com a turma. Ajustar tempo, limite de rodadas e dificuldade da coroa só em `rules.ts`.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Supabase free pausa após 7 dias sem uso | Ping diário (Vercel Cron) ou plano Pro na época de uso |
| Perder sessão anônima ao limpar navegador | Aviso na Home; vincular Google no backlog |
| Pesquisar a resposta no Google em 30s | Aceito. Jogo entre amigos; perguntas de caso dificultam |
| 300 perguntas se repetem entre partidas | Sem repetição por partida; banco cresce pelo painel (backlog) |
| Imagens pesadas no 4G | WebP 512px + preload só da partida atual |
