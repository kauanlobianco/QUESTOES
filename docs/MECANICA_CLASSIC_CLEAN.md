# Mecânica do Modo Classic — Especificação Limpa

Escopo: só o modo Classic (1v1 por turnos). Pets, Shop, Ranking, Episodes, ads, login e rede da Etermax foram ignorados.

## 0. Fontes e grau de confiança

| Fonte | O que forneceu |
|---|---|
| Java (JADX) `com.etermax.preguntados.datasource.dto.*` | Enums, DTOs com chaves JSON (`@SerializedName`), regras em `GameDTO` |
| Java `ui.game.category.*`, `ui.game.persistence.*` | `MAX_CHARGES = 3`, eventos de navegação, estado local do turno |
| Dart `libapp.so` `package:classic/src/core/*` | Nomes de casos de uso, entidades e DTOs do duelo novo |

> Correção da análise anterior: os enums (`GameStatus`, `GameSubStatus`…) **vêm do Java decompilado**, não do `libapp.so`. O JADX terminou antes de ser parado; usei só os DTOs do Classic.

Legenda: **[E]** = evidência direta no código · **[I]** = inferência (a regra mora no servidor e não está no APK).

O cliente **não decide as regras**. Ele envia respostas e recebe o novo estado. Toda transição abaixo é calculada pelo servidor; o APK só mostra os nomes dos estados e os gatilhos que observa.

---

## 1. Máquina de estados da partida

### 1.1 Estados de topo — `GameStatus` [E]

| Estado | Significado |
|---|---|
| `PENDING_APPROVAL` | Convite criado; P2 ainda não aceitou |
| `ACTIVE` | Partida em andamento |
| `ENDED` | Encerrada; motivo em `ended_reason` |

`EndedReason` [E]: `NORMAL` (alguém venceu) · `RESIGNED` (desistência) · `REJECTED` (convite recusado) · `EXPIRED` (prazo de turno estourou).
`GameAction` [E]: `REJECT`, `RESIGN` (ações enviadas pelo jogador).

### 1.2 Subestados — `GameSubStatus` [E]

```
P1_WAITING_FIRST_TURN   P1_PLAYING_FIRST_TURN
P2_WAITING_FIRST_TURN   P2_PLAYING_FIRST_TURN
P1_WAITING_TURN         P1_PLAYING_TURN
P2_WAITING_TURN         P2_PLAYING_TURN
P1_WAITING_DUEL         P2_WAITING_DUEL
P1_WAITING_FINAL_DUEL   P2_WAITING_FINAL_DUEL
P1_WON                  P2_WON
```
O DTO também guarda `previous_sub_status` [E] e `status_version` [E] (versão para controle de concorrência).

Leitura dos nomes: `Pn_WAITING_*` = vez do jogador n, ainda não começou · `Pn_PLAYING_*` = jogador n está no meio do turno · `Pn_WAITING_DUEL` = jogador n precisa responder ao duelo aberto contra ele.

### 1.3 Regras explícitas em `GameDTO` [E]

```java
FIRST_ROUND_NUMBER = 1
isFirstTurn()   = round==1 && sub ∈ {P1_PLAYING_FIRST_TURN, P1_WAITING_FIRST_TURN}
isSecondTurn()  = round==1 && sub ∈ {P2_PLAYING_FIRST_TURN, P2_WAITING_FIRST_TURN}
isPendingOpponentApproval() = myPlayerNumber==1 && sub==P2_WAITING_FIRST_TURN
isPendingMyApproval() = myTurn && !random && !ended && myPlayerNumber==2
                        && round==1 && charges==0 && crowns vazio
isPlayable()    = myTurn && !ended
userScore()     = myPlayerInfo.crowns.size()      // placar = nº de coroas
hasExceededFirstTurnCrownsLimit() = existe evento CROWNS_EXCEDED
wonNormally()   = win && ended_reason==NORMAL
```

Consequência importante: **no convite entre amigos, P1 joga o primeiro turno antes de P2 aceitar.** O jogo fica em `PENDING_APPROVAL` / `P2_WAITING_FIRST_TURN` até P2 aceitar (`accept_game`) ou recusar (`reject_game`).

### 1.4 Diagrama de transições

```
create_game ──▶ [PENDING_APPROVAL]
                   │ P1_WAITING_FIRST_TURN → P1_PLAYING_FIRST_TURN
                   │ (P1 erra / fecha turno)
                   ▼
                 P2_WAITING_FIRST_TURN ──reject_game──▶ [ENDED/REJECTED]
                   │ accept_game                         (ou partida aleatória: aceite implícito [I])
                   ▼
               [ACTIVE]
   ┌──────────────────────────────────────────────────────────────┐
   │ Pn_WAITING_TURN ─(abre a roleta)─▶ Pn_PLAYING_TURN          │
   │   ├─ acerto normal ──▶ +1 carga; continua no mesmo turno    │
   │   ├─ acerto de coroa ─▶ +1 coroa; continua                  │
   │   ├─ erro / timeout ──▶ Pm_WAITING_TURN (m = adversário)    │
   │   │                    round_number++ ao fechar a rodada [I]│
   │   ├─ abre duelo ──────▶ Pm_WAITING_DUEL                     │
   │   │                    Pm responde ─▶ resolve aposta ─▶     │
   │   │                    volta a Pn_* ou Pm_* [I]             │
   │   └─ 6 coroas ────────▶ Pn_WON                              │
   │ limite de rodadas sem vencedor ─▶ Pn_WAITING_FINAL_DUEL [I] │
   │   duelo final ─▶ Pn_WON / Pm_WON                            │
   └──────────────────────────────────────────────────────────────┘
   Pn_WON ─▶ [ENDED/NORMAL]
   resign_game (qualquer momento) ─▶ [ENDED/RESIGNED]
   prazo expirado (expiration_date) ─▶ [ENDED/EXPIRED]
```

### 1.5 Tabela de gatilhos

| De | Gatilho | Para | Confiança |
|---|---|---|---|
| — | `create_game` | `PENDING_APPROVAL` + `P1_WAITING_FIRST_TURN` | E (enum + ação) |
| `P1_WAITING_FIRST_TURN` | P1 gira a roleta | `P1_PLAYING_FIRST_TURN` | E (nome) |
| `P1_PLAYING_FIRST_TURN` | erro/timeout | `P2_WAITING_FIRST_TURN` | E (`isPendingOpponentApproval`) |
| `PENDING_APPROVAL` | `accept_game` | `ACTIVE` | E (ação) |
| `PENDING_APPROVAL` | `reject_game` / `GameAction.REJECT` | `ENDED/REJECTED` | E |
| `Pn_PLAYING_*` | erro, tempo esgotado | `Pm_WAITING_TURN` | I |
| `Pn_PLAYING_TURN` | escolhe duelo | `Pm_WAITING_DUEL`; evento `DUEL_STARTED` | E (enum + evento) |
| `Pm_WAITING_DUEL` | Pm responde | evento `DUEL_ENDED`; troca de coroa | E (evento) / I (troca) |
| qualquer `ACTIVE` | 6ª coroa | `Pn_WON` → `ENDED/NORMAL`; evento `GAME_ENDED` | E (evento) / I (6) |
| qualquer `ACTIVE` | limite de rodadas | `Pn_WAITING_FINAL_DUEL`; `FINAL_DUEL_STARTED` | E (enum + evento) / I (gatilho) |
| `Pn_WAITING_FINAL_DUEL` | ambos respondem | `FINAL_DUEL_ENDED` → `Pn_WON` | E |
| qualquer | `resign_game` / `GameAction.RESIGN` | `ENDED/RESIGNED` | E |
| qualquer | passou de `expiration_date` | `ENDED/EXPIRED` | E (campo) / I (rotina no servidor) |

`GameEvent` [E]: `DUEL_STARTED`, `DUEL_ENDED`, `FINAL_DUEL_STARTED`, `FINAL_DUEL_ENDED`, `GAME_ENDED`, `CROWNS_EXCEDED`.

---

## 2. Roleta e barra de coroa (cargas)

### 2.1 Evidências

- `MAX_CHARGES = 3` em `ui.game.category.presentation.CategoryViewModelKt` [E]
- `GameUserDTO { charges:int, crowns:List<QuestionCategory> }` [E]
- `SpinsDataDTO { cause: WildcardCause, spins: List<SpinDTO> }` [E]
- `WildcardCause { SPIN, CHARGES }` [E] → a pergunta de coroa ("curinga") sai **por cair na fatia da roleta** ou **por encher as cargas**
- `SpinType { NORMAL, CROWN, DUEL }` [E]
- Widgets: `ChargeLoaderView`, `CategoryCrownsView`, `WonCrownsView`, `CategoryRightAnswersView` [E]
- Strings Dart: `three_charges_and_no_crown`, `sfx_crown_charge`, `crown_limit`, `is_crown_question`, `free_spin_available` [E]
- Eventos de navegação: `SpinEvent`, `RespinEvent{respinType}`, `GoToQuestionEvent`, `GoToCrownQuestionEvent`, `StartDuelEvent`, `CrownEarnedEvent` [E]

### 2.2 Regra resultante

```
cada acerto em pergunta NORMAL  → charges += 1
charges == 3                    → spins_data.cause = CHARGES  → escolha de coroa
roleta cai na fatia de coroa    → spins_data.cause = SPIN     → escolha de coroa
escolha de coroa:
   ├─ CROWN: escolhe categoria que ainda não tem → pergunta de coroa
   │          acerto → crowns += categoria; charges = 0 [I]
   │          erro   → passa a vez; charges = 0 [I]
   └─ DUEL : desafia o adversário (ver §3) — só se houver coroa para apostar
```

Sim: **3 acertos normais enchem o medidor** (MAX_CHARGES = 3) e liberam a escolha entre Coroa e Duelo.

Limite no 1º turno [E]: o servidor emite `CROWNS_EXCEDED` quando P1 ganharia coroas demais na primeira jogada (string `crown_limit`). O número exato não está no APK [I]; um valor razoável é limitar a 1 ou 2 coroas no turno de abertura.

### 2.3 Propriedades da roleta — `SpinDTO` [E]

| Chave JSON | Tipo | Papel |
|---|---|---|
| `type` | `NORMAL\|CROWN\|DUEL` | Tipo do giro |
| `questions` | `SpinQuestionDTO[]` | Perguntas desse giro |
| `requested_crown` | categoria | Coroa pedida (coroa escolhida ou coroa do rival no duelo) |
| `offered_crown` | categoria | Coroa própria apostada no duelo |
| `tie_break_question` | `QuestionDTO` | Pergunta de desempate do duelo |
| `second_chance_available` | bool | Power-up "segunda chance" disponível |
| `extra_chance` | `{iteration, costs[]}` | Oferta paga para continuar após errar |
| `performance`, `worst` | int, bool | Telemetria de desempenho do jogador |

`SpinQuestionDTO` [E]: `question`, `backup_question` (troca), `powerup_question`, `second_chance_question`.
`QuestionDTO` [E] (campos úteis): `id`, `text`, `answers[]`, `category`, `media_type (NORMAL|IMAGE|VIDEO)`, `media`, `author`.
Categorias [E]: `ENTERTAINMENT, ARTS, SPORTS, HISTORY, SCIENCE, GEOGRAPHY`.

### 2.4 Estado local do turno — `GamePersistenceManager` [E]

`answer`, `usedPowerUps[]`, `spinType`, `answerList`, `currentQuestion`, `correctAnswersCount`, `opponentCorrectAnswersCount`, `isChallenged`, `isTieBreakQuestion`, `requestedCrown`, `questionElapsedTime`, `answerTime`, `progressBarMax`, `progressBarElapsedTime`, `statusVersion`.
→ O cliente guarda o turno em andamento e manda **tudo de uma vez** no fim do giro.

---

## 3. Duelo

### 3.1 Evidências

- `SpinType.DUEL`; `DuelPlayerStatus { CHALLENGER, CHALLENGED }` [E]
- `EventDTO { type, me:DuelPlayerStatus, challenger_score, challenged_score, player_one_score, player_two_score, requested_crown, offered_crown, win, coins_reward, count }` [E]
- Casos de uso Dart: `bet_duel`, `answer_duel_question`, `next_duel_question`, `tie_break_duel_question` [E]
- Tipos Dart: `DuelBet`, `DuelAvailableBet`, `BetDto`, `BetOptionDto`, `BetType`, `DuelScores`, `DuelResult`, `DuelRewards`, `DuelStatus`, `DuelAddon`, `AddonBetDto`, `AddonAvailableBetDto` [E]
- Campos Dart: `betPlayerCharacter`, `betPlayerType`, `betPlayerValue`, `betOpponentCharacter`, `betOpponentType`, `betOpponentValue`, `available_bet`, `is_duel_creator`, `is_duel_question` [E]
- Erros Dart: `DuelPlayerCategoryNotAvailableException`, `DuelOpponentCategoryNotAvailableException`, `DuelBetNotFoundException`, `duel_bet_not_available`, `no_duel_bet`, `duel_not_available` [E]
- Telas: `duel/character_choice`, `duel/choice`, `duel/confirm_popup`, `duel/question`, `duel/tie_popup`, `duel/result`, `duel/finished_bottomsheet` [E]
- Repositórios locais: `game_duel_bet_repository`, `game_duel_started_repository` [E]

"Character" = a coroa/personagem de uma categoria.

### 3.2 Fluxo

```
1. Desafiante (CHALLENGER) com medidor cheio escolhe DUEL
2. bet_duel:
     betOpponentCharacter = coroa do rival que quer roubar   (requested_crown)
     betPlayerCharacter   = coroa própria em jogo            (offered_crown)
     validação: rival precisa ter a coroa pedida  → senão DuelOpponentCategoryNotAvailable
                desafiante precisa ter a coroa oferecida → senão DuelPlayerCategoryNotAvailable
3. Desafiante responde N perguntas (next_duel_question / answer_duel_question)
   → evento DUEL_STARTED; sub_status = Pm_WAITING_DUEL
4. Desafiado (CHALLENGED) responde as MESMAS perguntas
5. Placar: challenger_score vs challenged_score
     empate → tie_break_question (tie_break_duel_question), vence quem acertar/for mais rápido [I]
6. Resultado (DUEL_ENDED, campo win):
     desafiante vence → leva requested_crown do rival
     desafiado vence  → leva offered_crown do desafiante [I]
```

`betPlayerType/Value` e `betOpponentType/Value` + `DuelAddon` indicam uma camada nova em que a aposta pode ser **outro recurso além de coroa** (tipo + quantidade). [E] para os campos, [I] para o uso.

Nº de perguntas por duelo: não está no APK [I]. Sugestão: 6 (uma por categoria).

### 3.3 Duelo final

`Pn_WAITING_FINAL_DUEL` + eventos `FINAL_DUEL_STARTED/ENDED` + `player_one_score/player_two_score` [E]. Disparado quando a partida chega ao limite de rodadas sem vencedor (string `last_round`) [I]. Quem fizer mais pontos vence a partida (`Pn_WON`).

### 3.4 Parâmetros enviados — `AnswerListDTO` [E]

```
type             SpinType      (NORMAL | CROWN | DUEL)
requested_crown  categoria     (coroa pedida)
offered_crown    categoria     (coroa apostada — só duelo)
finish_time      long          (fim do turno)
answers[]:
   id                      long      (id da pergunta)
   category                categoria
   answer                  int       (índice escolhido)
   time                    long      (tempo de resposta)
   power_ups               PowerUp[] (DOUBLE_CHANCE, BOMB, SWAP_QUESTION, EXTRA_TIME, RIGHT_ANSWER, SECOND_CHANCE)
   second_chance_question  bool
   vote                    POSITIVE | NEGATIVE   (avaliação da pergunta)
```
Destino: `POST users/{userId}/games/{gameId}/v2/answers`. Resposta: o `GameDTO` atualizado.

---

## 4. Schema JSON para o seu backend

Princípios:
- **Servidor autoritativo.** O gabarito fica só no servidor; o cliente recebe a pergunta sem a resposta e só sabe se acertou depois de enviar.
- `version` incrementa a cada escrita (concorrência otimista, igual ao `status_version`).
- Um documento por partida + uma coleção à parte para o banco de perguntas.

### 4.1 Partida (`matches/{matchId}`)

```json
{
  "id": "m_8f3c",
  "version": 17,
  "status": "ACTIVE",
  "subStatus": "P2_WAITING_TURN",
  "previousSubStatus": "P1_PLAYING_TURN",
  "endedReason": null,
  "winner": null,
  "inviteCode": "K7Q2XZ",
  "language": "pt",
  "round": 4,
  "maxRounds": 25,
  "currentPlayer": 2,
  "createdAt": "2026-10-27T18:00:00Z",
  "lastTurnAt": "2026-10-27T18:20:11Z",
  "expiresAt": "2026-10-29T18:20:11Z",

  "players": {
    "1": {
      "userId": "u_ana",
      "name": "Ana",
      "charges": 0,
      "crowns": ["SCIENCE", "HISTORY"],
      "stats": { "answered": 14, "correct": 11, "byCategory": { "SCIENCE": { "correct": 3, "incorrect": 1 } } }
    },
    "2": {
      "userId": "u_bia",
      "name": "Bia",
      "charges": 2,
      "crowns": ["SPORTS"],
      "stats": { "answered": 9, "correct": 6, "byCategory": {} }
    }
  },

  "currentTurn": {
    "player": 2,
    "spin": {
      "type": "NORMAL",
      "category": "ARTS",
      "cause": null,
      "requestedCrown": null,
      "offeredCrown": null
    },
    "question": {
      "id": "q_1029",
      "category": "ARTS",
      "text": "…",
      "options": ["…", "…", "…", "…"],
      "media": null,
      "servedAt": "2026-10-27T18:20:15Z",
      "timeLimitMs": 30000
    }
  },

  "duel": null,

  "events": [
    { "type": "CROWN_WON", "player": 1, "category": "HISTORY", "round": 3, "at": "2026-10-27T18:15:00Z" },
    { "type": "TURN_ENDED", "player": 1, "reason": "WRONG_ANSWER", "round": 4, "at": "2026-10-27T18:20:11Z" }
  ]
}
```

### 4.2 Bloco `duel` (quando ativo)

```json
"duel": {
  "kind": "NORMAL",
  "challenger": 1,
  "challenged": 2,
  "requestedCrown": "SPORTS",
  "offeredCrown": "SCIENCE",
  "questionIds": ["q_11", "q_57", "q_90", "q_31", "q_72", "q_08"],
  "answers": {
    "1": [ { "qid": "q_11", "correct": true, "ms": 4200 } ],
    "2": []
  },
  "score": { "1": 4, "2": null },
  "tieBreakQuestionId": null,
  "result": null
}
```
`kind`: `NORMAL` (troca de coroa) ou `FINAL` (decide a partida).

### 4.3 Coleção privada do servidor (`questions/{id}`)

```json
{ "id": "q_1029", "category": "ARTS", "lang": "pt", "text": "…",
  "options": ["…","…","…","…"], "correctIndex": 2,
  "media": null, "rating": { "up": 120, "down": 4 } }
```
Bloqueie a leitura direta dessa coleção nas regras do Supabase/Firebase. Só uma Edge/Cloud Function a lê.

### 4.4 Comandos (Edge/Cloud Functions)

| Comando | Entrada | Efeito |
|---|---|---|
| `createMatch` | `{language}` | Cria partida + `inviteCode`; P1 em `P1_WAITING_FIRST_TURN` |
| `joinMatch` | `{inviteCode}` | P2 entra; aceite implícito pelo link |
| `spin` | `{matchId, version}` | Servidor sorteia a categoria/tipo; grava `currentTurn.spin` |
| `chooseCrown` | `{matchId, category, version}` | Com cargas cheias ou fatia de coroa |
| `answer` | `{matchId, questionId, optionIndex, powerUps[], version}` | Corrige no servidor, atualiza cargas/coroas, decide a próxima vez |
| `startDuel` | `{matchId, requestedCrown, offeredCrown, version}` | Valida posse das coroas; cria `duel` |
| `answerDuel` | `{matchId, questionId, optionIndex, version}` | Grava resposta do duelo; resolve ao fim |
| `resign` | `{matchId}` | `ENDED/RESIGNED` |
| cron `expireMatches` | — | `ENDED/EXPIRED` para `expiresAt` vencido |

Tempo: use `servedAt` do servidor e rejeite resposta acima de `timeLimitMs` + tolerância. Não confie no tempo enviado pelo cliente.

### 4.5 Pseudocódigo de `answer`

```
assert match.version == input.version
assert match.currentPlayer == caller
q = questions[input.questionId]; ok = (input.optionIndex == q.correctIndex)
p = match.players[caller]
switch spin.type:
  NORMAL: if ok { p.charges++; if p.charges >= 3 → aguardando chooseCrown }
          else  passTurn()
  CROWN:  p.charges = 0
          if ok { p.crowns.add(spin.category); if p.crowns.size == 6 → win(caller) }
          else  passTurn()
passTurn(): currentPlayer = outro; subStatus = Pm_WAITING_TURN;
            if fechou a rodada { round++; if round > maxRounds → startFinalDuel() }
match.version++
```

---

## 5. Diferenciação do original

A mecânica de "roleta + medidor + coroas por categoria + duelo" é um padrão de gênero. Para o jogo ser seu e não uma cópia, troque:
- nomes, mascotes, arte, sons e textos;
- as categorias (quantidade e temas);
- os números (cargas, coroas para vencer, limite de rodadas, perguntas do duelo).

Não use os assets, as perguntas nem as marcas do app analisado.

---

## 6. Lacunas (valores que o APK não contém)

| Item | Status | Sugestão |
|---|---|---|
| Coroas para vencer | não está no APK [I] | 6 (1 por categoria) |
| Limite de rodadas | não está no APK [I] | 25 |
| Perguntas por duelo | não está no APK [I] | 6 |
| Limite de coroas no 1º turno | só o evento `CROWNS_EXCEDED` [E] | 1–2 |
| Pesos das fatias da roleta | servidor | 6 categorias + 1 fatia de coroa |
| Regra exata do desempate | servidor | acerto e, se empatar, menor tempo |
| Uso de `betType/value` em addons | parcial | ignore no MVP |
