# Mestre dos Negócios — Banco de Questões

Banco de questões do jogo de trivia de Administração (estilo Perguntados, com a pegada de feedback do Duolingo).
**347 questões** em 6 áreas, todas no mesmo padrão "modo jogo": situação do dia a dia, pergunta direta, 4 alternativas e feedback que ensina.

## Para o app

| | |
|---|---|
| **Banco final** | [`banco-final/banco-questoes.json`](banco-final/banco-questoes.json) — o arquivo que vai para o aplicativo |
| **Formato** | [`schema/questao.schema.json`](schema/questao.schema.json) (JSON Schema) · explicação em [`docs/02-SCHEMA.md`](docs/02-SCHEMA.md) |
| **Resumo** | [`docs/08-BANCO-FINAL.md`](docs/08-BANCO-FINAL.md) — tabela por área, mecânica e dificuldade |
| **Jogar no navegador** | [`preview_quiz.html`](preview_quiz.html) — baixe e abra; filtros por área, mecânica e dificuldade, timer e "Eliminar 2" |

| Área | Total | Duelo | Giro | Coroa | Desempate |
|---|---|---|---|---|---|
| Empreendedorismo | 58 | 23 | 23 | 12 | 0 |
| Estratégia | 57 | 25 | 21 | 11 | 0 |
| Finanças | 58 | 34 | 12 | 12 | 0 |
| Liderança | 58 | 24 | 22 | 12 | 0 |
| Marketing | 56 | 23 | 22 | 11 | 0 |
| Operações | 60 | 25 | 21 | 12 | 2 |
| **Total** | **347** | 154 | 99 | 70 | 2 |

## Estrutura do repositório

```
banco-final/      banco único para o app (gerado — não editar à mão)
lotes/            lotes de trabalho: base refatorada (300) e lote piloto (47)
base-original/    questões do jogo físico + refatorações compactas por área (fonte da base)
schema/           JSON Schema da questão
scripts/          montar, validar e gerar o preview
docs/             áreas, schema, protocolo, guia do modo jogo, revisões e plano
playtest/         playtest com personas (professora, jogador, calouro)
```

## Como atualizar

Edite as questões em `base-original/refatoradas/*.json` (base) ou `lotes/lote-00-piloto.json` (piloto) e rode:

```bash
python scripts/montar_base.py          # expande a base refatorada -> lotes/lote-base-original.json
python scripts/montar_banco_final.py   # junta tudo -> banco-final/banco-questoes.json
python scripts/validar.py banco-final/banco-questoes.json   # deve dar 0 erros e 0 avisos
python scripts/gerar_preview.py        # atualiza preview_quiz.html
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/01-AREAS.md`](docs/01-AREAS.md) | As 6 áreas da roleta e onde entra cada matéria |
| [`docs/02-SCHEMA.md`](docs/02-SCHEMA.md) | Padrão de 4 alternativas, mecânicas e regras do validador |
| [`docs/03-PROTOCOLO.md`](docs/03-PROTOCOLO.md) | Passo a passo de criação e revisão de questões |
| [`docs/07-GUIA-MODO-JOGO.md`](docs/07-GUIA-MODO-JOGO.md) | Limites de texto, conta de cabeça e formatos que funcionam no timer |
| [`docs/08-BANCO-FINAL.md`](docs/08-BANCO-FINAL.md) | Resumo do banco final |
| [`docs/04-REVISAO-LOTE-00.md`](docs/04-REVISAO-LOTE-00.md) · [`docs/06-REVISAO-BASE-ORIGINAL.md`](docs/06-REVISAO-BASE-ORIGINAL.md) | Histórico de revisões |
| [`docs/05-PLANO-DE-LOTES.md`](docs/05-PLANO-DE-LOTES.md) | Plano dos próximos lotes |
| [`playtest/RELATORIO-PLAYTEST.md`](playtest/RELATORIO-PLAYTEST.md) | Resultado do playtest com personas |
