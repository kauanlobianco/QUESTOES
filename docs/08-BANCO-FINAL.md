# 08 — Banco final do jogo

Arquivo para o app: [`banco-final/banco-questoes.json`](../banco-final/banco-questoes.json) — **347 questões**, todas no mesmo padrão "modo jogo" ([`07-GUIA-MODO-JOGO.md`](07-GUIA-MODO-JOGO.md)). Não há divisão entre base e inéditas: é um banco só.

Gerar de novo: `python scripts/montar_base.py && python scripts/montar_banco_final.py && python scripts/gerar_preview.py`. Validação: `python scripts/validar.py banco-final/banco-questoes.json` → 0 erros, 0 avisos.

## Questões por área e mecânica

| Área | Total | Duelo | Giro | Coroa | Desempate | Fácil (1–2) | Média (3) | Difícil (4) |
|---|---|---|---|---|---|---|---|---|
| Empreendedorismo | **58** | 23 | 23 | 12 | 0 | 46 | 12 | 0 |
| Estratégia | **57** | 25 | 21 | 11 | 0 | 46 | 10 | 1 |
| Finanças | **58** | 34 | 12 | 12 | 0 | 44 | 13 | 1 |
| Liderança | **58** | 24 | 22 | 12 | 0 | 46 | 10 | 2 |
| Marketing | **56** | 23 | 22 | 11 | 0 | 45 | 8 | 3 |
| Operações | **60** | 25 | 21 | 12 | 2 | 48 | 9 | 3 |
| **Total** | **347** | 154 | 121 | 70 | 2 | 275 | 62 | 10 |

Mecânica = a principal da questão (muitas questões de Duelo também podem cair no Giro).

## Padrão aplicado a todas

- Uma situação do dia a dia (padaria, food truck, atlética, app) e uma pergunta direta.
- A resposta depende da ideia, não de decorar autor, sigla ou fórmula. O autor aparece no feedback ("saiba mais").
- Sem conta de várias etapas: no máximo uma conta de cabeça com números redondos.
- Distratores são erros comuns; nas fáceis, às vezes um distrator bem-humorado. Todo distrator tem feedback que ensina.
- Finanças com foco em ideias gerais de gestão financeira e economia (sem TIR, VPL, ROE, custeio).
