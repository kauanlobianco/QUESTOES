# 02 — Schema definitivo (padrão Perguntados) e regras de mecânica

Arquivo formal: [`schema/questao.schema.json`](../schema/questao.schema.json). Cada lote é `{ "lote": {...}, "questoes": [ ... ] }`.

## 1. Formato único: 4 alternativas
Seguindo o **Perguntados**, Giro, Coroa e Duelo usam **sempre múltipla escolha com 4 alternativas (1 correta + 3 distratores)**. Isso mantém a interface limpa e permite as mecânicas clássicas (eliminar 2, segunda chance, pular).
O DNA do **Duolingo** está na pedagogia, não no formato: micro-cenários, **feedback por alternativa** (o jogador vê por que errou), feedback curto de 1 frase e gamificação (XP, combos, streaks).

| `tipo` | Uso | Gabarito |
|---|---|---|
| `multipla_escolha` | Giro, Coroa e Duelo | `alternativas` (a–d), exatamente 1 `correta` |
| `numerico` | **Somente desempate do Duelo** ("quem chega mais perto"), como no Perguntados | `resposta_numerica.valor` ± `tolerancia` |

`formato`: `direta` ou `cenario` (micro-cenário neutro: `texto` + `artefato` + `restricao`).

## 2. Anatomia da questão
| Bloco | Campos |
|---|---|
| Identidade | `id` (`AREA-SUBTEMA-NNN`; base original usa a faixa 101+), `versao` |
| Taxonomia | `area`, `areas_secundarias`, `subtema`, `microtema`, `tags` |
| Conteúdo | `formato`, `cenario`, `enunciado`, `alternativas[]` (`texto`, `correta`, `erro_comum`, `feedback`) |
| Ensino | `feedback.curto` (≤ 120), `feedback.explicacao`, `feedback.saiba_mais` |
| Calibragem | `bloom`, `dificuldade` (1–5), `mecanicas`, `tempo_seg`, `xp` |
| Rastreabilidade | `fonte` (`origem` NLM/WEB/NLM+WEB, `ficha`, `arquivos`, `urls`), `validade` (`perene`/`datado`) |
| Origem | `origem_questao` (`inedita` ou `base_original` + `ref` + texto `original` para auditoria) |
| Qualidade | `revisao` (`status`, 8 `criterios`, `notas`) |

## 3. Mecânicas (modo jogo — detalhes em [`07-GUIA-MODO-JOGO.md`](07-GUIA-MODO-JOGO.md))
| Mecânica | Bloom | Formato | Tempo | XP | Dificuldade | Enunciado / cenário / alternativa / leitura total |
|---|---|---|---|---|---|---|
| **Duelo** | lembrar · entender | direta | 20 s | 15 | 1–2 | ≤ 110 / — / ≤ 45 / ≤ 280 |
| **Giro** | lembrar · entender · aplicar · analisar | direta ou mini-cenário de 1 frase | 30 s | 10 | 1–3 | ≤ 130 / ≤ 160 / ≤ 55 / ≤ 380 |
| **Coroa** | aplicar · analisar · avaliar | **micro-cenário obrigatório** (1–2 frases) | 45 s | 30 | 3–4 | ≤ 110 / 80–240 / ≤ 60 / ≤ 500 |
| **Desempate** | lembrar · aplicar | direta, `numerico`, conta de cabeça | 20 s | 5 | 1–3 | ≤ 110 |

A primeira mecânica da lista é a principal (`tempo_seg` e `xp` são dela).

## 4. Regras do validador (`scripts/validar.py`)
1. Schema, enums e coerência área × subtema × ID.
2. Exatamente 4 alternativas, ids a–d, 1 correta, sem repetição, sem "todas/nenhuma das anteriores" (quebra o "eliminar 2").
3. Todo distrator com `erro_comum` e `feedback`.
4. Numérico só no desempate.
5. Coerência mecânica × Bloom × formato × tempo × XP.
6. Cenário neutro (sem termos que vazam a resposta).
7. **Pista de tamanho**: a correta não pode ser a mais longa com folga (> 15% sobre a 2ª) — meta ≤ 15% do lote.
8. Pistas de termos absolutos; IDs únicos; WEB exige URL; datado exige referência.
9. **Modo jogo:** limites de texto por mecânica (tabela acima), `feedback.curto` ≤ 120, no máximo 3 números no cenário + enunciado (conta de cabeça), sem alternativas de sequência (→) ou afirmativas I/II/III; enunciado negativo gera aviso.
