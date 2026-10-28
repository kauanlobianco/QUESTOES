# Trivia Crack 3.392.1 — Especificação Abstrata de Arquitetura

Alvo: `ALVO.apkm` → `com.etermax.preguntados.lite`, versionCode 4112, minSdk 28.
Ferramentas: JADX 1.5.6 (oficial), extração de strings do snapshot Dart AOT.
REA MCP não estava conectado; análise feita diretamente.

> Cobertura: manifesto completo; ~41% das classes Java decompiladas no momento
> da escrita; lógica Dart inferida por caminhos de fonte e símbolos em
> `libapp.so` (AOT não é decompilável pelo JADX).

---

## 1. Visão geral

Aplicativo **híbrido "add-to-app"**:

| Camada | Tecnologia | Papel |
|---|---|---|
| Host nativo | Kotlin/Java (`com.etermax.preguntados.*`) | Boot, login/sessão, SDKs (ads, billing, analytics, push), modos legados |
| Módulo Flutter | Dart AOT (`libapp.so`, 33 MB) | Quase todas as features novas: Classic, Episodes, Daily Question, Ranking, Shop, Pets, Fun Park… |
| Ponte | Platform Channels | Host injeta config/credenciais; Flutter pede serviços nativos |
| Backend | Microsserviços HTTPS por domínio | `api`, `ranking`, `missions`, `pet`, `survival`, etc. |

```
SplashActivity ─▶ LoginActivity ─▶ DashboardTabsActivity
                                         │
                                         ▼
                           FlutterIntegrationActivity
                           (FlutterEngine + flutter_module)
                                         │  Platform Channels
           ┌─────────────────────────────┼──────────────────────────────┐
           ▼                             ▼                              ▼
   networking config/login      ads / purchase / wallet        event_bus / deeplink
           │
           ▼
   Dio (interceptors) ──HTTPS──▶ api.prod.tc.etermax.com/api  + serviços satélite
```

---

## 2. Evidências — componentes (AndroidManifest)

- `Application`: `com.etermax.preguntados.PreguntadosApplication`
- Backup de credenciais: `com.etermax.preguntados.backup.CredentialsBackupAgent`
- Launcher: `splash.presentation.SplashActivity` (exported)
- Container Flutter: `flutter.FlutterIntegrationActivity` (`flutter_deeplinking_enabled=false` → deeplink roteado pelo host)
- Login: `login.LoginActivity`, `gamescommon.login.accountmanager.shared.AccountAuthenticatorService`
- Sessão: `utils.network.interceptor.ExpiredSessionActivity`, `AppInMaintenanceActivity`
- Modos nativos legados: `survival.v2.*`, `survivalarena.*`, `picduel.PicDuelActivity`, `tugofwar.*`, `treasuremine.*`, `gacha.*`, `pet.*`
- Classic legado nativo: `classic.newgame.*`, `ui.game.category.CategoryActivity`, `ui.game.question.duel.DuelQuestionActivity`
- Push: `firebase.FcmMessagingService`; CRM: Braze/Appboy
- Permissões relevantes: `INTERNET`, `CAMERA`, `RECORD_AUDIO` (criação de conteúdo), `BILLING`, `AD_ID`, `POST_NOTIFICATIONS`
- `usesCleartextTraffic="true"`

Nativos (`split_config.arm64_v8a.apk`): `libflutter.so`, `libapp.so`, `libisar.so` (DB local), `librive_text.so` (animações Rive), `libflutter_soloud_plugin.so` (áudio), Bugsnag/Crashlytics, AppLovin.

---

## 3. Módulo Flutter — organização

Monorepo de pacotes Dart. Ranking por referências em `libapp.so`:

`classic`(740) · `episodes`(521) · `trivia_platform`(504) · `shop`(405) · `lucky_board`(350) · `pets`(263) · `fun_park`(263) · `user_questions_factory`(237) · `ranking`(212) · `progress`(209) · `dashboard`(202) · `channels`(183) · `trivia_topics`(182) · `daily_missions_streak`(162) · `master_wheel`(156) · `daily_question`(133) …

Entrada: `package:flutter_module/main.dart`.
Flavors: `src/flavor/{lite,pro,netflix,web}_features.dart` → mesmo binário Dart serve vários apps.
Roteamento: `src/path/application_path_router.dart` + `routes/*_path_route.dart` (ex.: `classic_path_route`, `daily_question_path_route`, `episodes_path_route`, `anonymous/*`). Host abre Flutter passando um **path**; o router resolve a tela.

### Padrão por pacote (Clean Architecture)

```
package:<feature>/src/
  core/
    action/        ← casos de uso (1 arquivo = 1 ação)
    domain/        ← entidades e value objects
    repository/    ← interfaces de persistência
    service/       ← interfaces de serviço (API, eventos)
  infrastructure/
    repository/    ← impl: shared_preferences_*, in_memory_*, api_*, cached_*
    service/       ← impl: api_*_service, host_* (via channel), wallet_*
    request/ response/  ← DTOs (json_serializable *.g.dart)
    di/            ← injeção de dependência
  presentation/    ← screen + view_model + view_data + navigation
```

APIs mais novas usam **clientes OpenAPI gerados**: `daily_question/generated/api/...`, `ranking/generated/ranking_client/...`.

---

## 4. Feature principal: Classic (partida por turnos)

### 4.1 Máquina de estados (evidência Java: `datasource/dto/enums`)

`GameStatus`: `PENDING_APPROVAL → ACTIVE → ENDED`

`GameSubStatus`:
```
P{1,2}_WAITING_FIRST_TURN / P{1,2}_PLAYING_FIRST_TURN
P{1,2}_WAITING_TURN       / P{1,2}_PLAYING_TURN
P{1,2}_WAITING_DUEL       / P{1,2}_WAITING_FINAL_DUEL
P1_WON / P2_WON
```
`EndedReason`: `NORMAL | EXPIRED | RESIGNED | REJECTED`
`SpinType`: `NORMAL | CROWN | DUEL`
`QuestionType`: `NORMAL | IMAGE | VIDEO`
`QuestionCategory`: `ENTERTAINMENT, ARTS, SPORTS, HISTORY, SCIENCE, GEOGRAPHY`
`OpponentType`: `RANDOM` (+ amigo/sugerido no Dart)

```
           create_game / accept_game
PENDING_APPROVAL ───────────────▶ ACTIVE ──────────────▶ ENDED
      │ reject_game                 │  ciclo de turnos      ▲
      └──────────▶ ENDED(REJECTED)  │                       │
                                    ▼                       │
   girar roleta ─▶ SpinType ─┬─ NORMAL ─▶ pergunta da categoria
                             ├─ CROWN  ─▶ escolhe categoria; acerto = coroa
                             └─ DUEL   ─▶ duelo (bet/answer/tie-break)
   erro / timeout ─▶ turno passa ao oponente (WAITING_TURN)
   6 coroas ou fim de duelo final ─▶ P{n}_WON ─▶ ENDED(NORMAL)
   resign_game ─▶ ENDED(RESIGNED);  inatividade ─▶ ENDED(EXPIRED)
```

### 4.2 Casos de uso (`package:classic/src/core/action/`)

| Grupo | Ações |
|---|---|
| Ciclo de jogo | `create_game`, `accept_game`, `reject_game`, `find_game`, `update_games`, `delete_game`, `resign_game`, `my_turn_game_sort`, `resolve_preferred_pending_classic_game` |
| Duelo | `bet_duel`, `answer_duel_question`, `next_duel_question`, `tie_break_duel_question` |
| Pergunta | `notify_question_impressed`, `rate_question`, `report_question`, `process_pending_questions` |
| Onboarding | `core_loop/*` (jogo tutorial, welcome spin, prize shields, forgiveness) |
| Monetização | `extra_chance/*`, `extra_time`, `free_powerup`, `wheel_swap`, `ads` |
| Social | `share_question`, `share_invite_friend_link`, `generate_web_invite`, `get_active_friends` |

### 4.3 Domínio (`core/domain/`)

`game`, `turn`, `spin`, `roulette`, `question`, `question_category`, `question_type`, `answer`, `answered_question`, `game_result`, `game_stats`, `game_turn_stats`, `game_turn_ended_reason`, `game_finished_reason`, `extra_chance`, `extra_time`, `earned_reward`, `price/payment`, `profile`, `game_addon` (`duplicate_reward_addon`, `addons/duel`).

Eventos: `events/turn/game_turn_event_bus` (stream interno) + `native_event_bus` (espelha eventos no host via channel).

### 4.4 Fluxo de um turno (abstrato)

```
GameScreen/GameViewModel
  └─ roleta → Spin(type, categoria)
QuestionScreen/ClassicQuestionViewModel
  ├─ question_impression_mixin → notify_question_impressed  (POST impressed_question)
  ├─ countdown_controller (timer) / power_ups_controller (bomba, +tempo, dupla chance…)
  ├─ classic_answer_interaction → answers_service.answer()
  │     → POST users/{userId}/games/{gameId}/v2/answers   (servidor decide resultado)
  ├─ answer_feedback_rive_animation (acerto/erro)
  ├─ crown_won_overlay / special_currencies (cookies, shields, shovels, live-ops)
  └─ turn_finished_coordinator → extra_chance? → rate_to_continue? → próximo spin | fim
FinishGameScreen → finish_game_rewards (crédito de recompensas, ranking points)
```

Resultado de turno e partida é **autoritativo no servidor**; o cliente envia respostas e renderiza o estado devolvido (`game_response`, `turn_response`, `answer_response`).

### 4.5 Persistência local

Majoritariamente `SharedPreferences` (`shared_preferences_*_repository`): jogo atual, idioma, aposta de duelo, estatísticas de turno, consumo de energia, uso de power-up grátis, "continue from".
Cache em memória: `in_memory_game_repository`, `cached_active_friends_repository`.
`isar` para dados maiores; `flutter_cache_manager` para imagens de perguntas.

---

## 5. Rede

### 5.1 Hosts (evidência Java)

| Serviço | Produção |
|---|---|
| API principal | `https://api.prod.tc.etermax.com/api` |
| Assets | `https://assets.prod.tc.etermax.com` |
| Ranking | `https://ranking.prod.tc.etermax.com` |
| Missões | `https://missions.prod.tc.etermax.com` |
| Pet | `https://pet.prod.tc.etermax.com` |
| Modos tempo real | `survival.`, `survival-arena.`, `picduel.`, `tugofwar.`, `treasure-mine.` `prod.tc.etermax.com` |
| Plataforma | `https://api.platform.etermax.com` |

Cada um tem `dev.` e `stg.` equivalentes → seleção por ambiente (`p2_environment_service`).

### 5.2 Endpoints observados

Java (Retrofit): `POST login`, `POST social-login/v2`, `POST anonymous-users`, `POST no-register/users`, `POST users/{userId}/devices`, `GET v5/users/{userId}/app/settings`, `GET users/{userId}/economy`, `GET users/{userId}/summary`, `GET v2/users/{userId}/profiles/me`, `POST users/{userId}/games/{gameId}/v2/answers`, `POST users/{userId}/games/{gameId}/v3/question-rating`, `POST users/{userId}/mission/{missionId}/collect`.

Dart: `/classic/games`, `/classic/games/impressed_question/`, `/classic/games/rate_question/`, `/classic/games/report_question/`, `/classic/lives`, `/classic/onboarding-games`, `/classic/shared-questions`, `/classic/extra-chance/settings`, `/classic/special-rewards?league=`, `/questions/pending/rating`, `/v2/suggested-questions`, `/v3/search`.

### 5.3 Stack HTTP do Flutter (`package:networking`)

`networking_factory` → `dio_factory` com interceptors:

1. `networking_configuration_interceptor` — base URL/headers vindos do host
2. `dio_credentials_interceptor` / `cookie_dio_credentials_interceptor` — sessão por cookie
3. `re_login_networking_configuration_interceptor` — 401 → re-login via host e repete
4. `app_in_maintenance_interceptor` — abre tela de manutenção
5. `user_economy_version_interceptor` — versão da economia do usuário
6. `user_tag_interceptor`, `core_loop_toggle_interceptor` — segmentação / feature flags
7. `retry/request_retry_evaluator` (+ `dio_smart_retry`)

Config e login vêm do nativo: `host_networking_configuration_repository`, `host_networking_login_service`.

Tempo real: pacote nativo `socket`/`socketrx` (modos Survival/Arena/PicDuel); chat via Sendbird (`wss://ws-…`).

---

## 6. Ponte Host ↔ Flutter (Platform Channels)

Prefixo `com.etermax.preguntados.flutter_module`:

| Channel | Responsabilidade |
|---|---|
| `.networking.configuration_repository` | base URLs, headers, cookies |
| `.networking.app_maintenance` | estado de manutenção |
| `.user_data.repository` | id/perfil do usuário logado |
| `.app_settings.repository` | settings remotas |
| `/event_bus` | eventos bidirecionais (fim de turno, moedas, navegação) |
| `/wallet`, `/purchase`, `/product_price`, `/subscription_v2`, `/minishop` | economia e billing (Google Play/RevenueCat) |
| `/ads`, `/ad_provider`, `/ad_space_*` | anúncios (xads/xmediator) |
| `/analytics`, `/user_properties`, `/apps_flyer_provider` | telemetria |
| `/deeplink2`, `/share_link`, `/invite`, `/facebook` | social/deeplinks |
| `/notifications`, `/notifications/local` | push/local |
| `/classic/special_currencies`, `/powerups_free_usage`, `/pet`, `/profile` | dados de features compartilhadas com o nativo |
| `/chat/user_token` | token Sendbird |

Regra arquitetural: **Flutter não autentica sozinho**; depende do host para sessão, pagamentos e ads.

---

## 7. Outras features (resumo)

- **Episodes / trivia_platform**: conteúdo gerado por usuário (quizzes com camadas, mídia, comentários, likes, compartilhamento, analytics por episódio). Ações: `create_episode`, `play_episode`, `answer_episode_game`, `progress_episode`, `finish_episode`, `rate_episode`.
- **Daily Question**: uma pergunta/dia, `play → answer → collect`, versão premium, comparação com amigos. Cliente OpenAPI gerado.
- **Ranking**: ligas, tiers, promoção, boosters; pontos calculados via `calculate_boosted_ranking_points`; serviço próprio.
- **Energy**: inventário de energia com refill por tempo (`get_time_to_refill_full_energy`), recarga via vídeo (`xads_video_reward_service`), assinatura ou minishop.
- **Economia**: `wallet` (moedas/gemas), `shop`, `minishop`, `subscriptions`, `billing`, `no_ads`.
- **Live-ops**: `lucky_board`, `master_wheel`, `pick_a_prize`, `pinata`, `sunken_treasure`, `reward_ladder`, `daily_missions_streak`, `fun_park`, `pets`, `trivia_cards` (álbum/gacha).
- **Social**: `chat` (Sendbird), `inbox`, `user_search`, `suggested_players`, `invite`, `cash_for_invites`.
- **Moderação**: `moderation_text` com listas de palavras locais; `report_question`.

---

## 8. Especificação abstrata (para reimplementar o padrão)

```
Cliente
├─ Shell nativo
│   ├─ Bootstrap (splash, config remota, toggles)
│   ├─ AuthService (email/social/anônimo) → cookie de sessão
│   ├─ Gateways: Billing, Ads, Push, Analytics
│   └─ FlutterHost: engine única + router por path + channels
└─ Módulo UI multiplataforma
    ├─ Router(path → Feature)
    ├─ Feature = core(actions, domain, ports) + infra(adapters) + presentation(MVVM)
    ├─ NetworkClient(Dio) + cadeia de interceptors (config, auth, relogin, retry, manutenção, flags)
    ├─ EventBus local + espelho nativo
    └─ Storage: prefs (estado pequeno), DB embarcado, cache de imagens

Servidor (autoritativo)
├─ Game service: partidas, turnos, spins, validação de respostas, recompensas
├─ Question service: banco por categoria/idioma, rating, report, perguntas de usuários
├─ Economy service: wallet, energia/vidas, preços, compras
├─ Ranking / Missions / Live-ops: microsserviços isolados por domínio
└─ Realtime: sockets para modos síncronos; chat terceirizado
```

Contrato mínimo do Classic:
```
POST /games                       {opponent, language}            → Game
GET  /games?filter=…                                              → [Game]
POST /games/{id}/accept | reject | resign
POST /games/{id}/answers          {questionId, answerId, powerups, elapsed} → Turn
POST /games/{id}/duel/bet | answer | tiebreak
POST /games/{id}/question-impression | question-rating | report
Game  = {id, status, subStatus, players[2]{crowns[], charges}, round, spins[], endedReason}
Turn  = {spin, questions[], results[], rewards[], nextSubStatus}
```

---

## 9. Limitações

- `libapp.so` é Dart AOT: nomes de arquivo/rota/endpoint são confiáveis; corpo dos métodos não foi reconstruído (exige Blutter ou similar).
- Decompilação Java parcial (~41% das 60.640 classes no momento); handlers de channel do host ainda não inspecionados.
- Nada foi executado em runtime; tráfego não capturado.
- Fora do escopo, intencionalmente: extração de respostas corretas, manipulação de economia/energia, bypass de ads/assinaturas.
