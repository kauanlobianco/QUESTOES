# 06 — Revisão da base original refatorada

Fonte: `MESTRE DOS NEGÓCIOS.zip` → `data/questions.json` (cópia em [`base-original/questions_original.json`](../base-original/questions_original.json)).
Resultado: [`lotes/lote-base-original.json`](../lotes/lote-base-original.json) — **300 questões** (50 por área), geradas a partir das refatorações compactas em [`base-original/refatoradas/`](../base-original/refatoradas/) pelo script `scripts/montar_base.py`. Cada questão guarda o texto original em `origem_questao.original` (visível no preview em "Fonte, revisão e origem").

Validação conjunta (base + piloto, 347 questões): **0 erros, 0 avisos**; pista de tamanho 0%; posição da correta a/b/c/d = 79/88/103/75.

## O que mudou em todas
- Encaixe em subtema e microtema da base de conhecimento, com ficha e arquivos de origem.
- **Mecânica pela dificuldade original:** fácil → Duelo + Giro (Lembrar/Entender/Aplicar); média → Giro; difícil → **Coroa com micro-cenário neutro** (artefato + restrição).
- 4 alternativas reescritas: distratores tirados de erros comuns reais (em geral, o conceito vizinho), cada um com diagnóstico e feedback próprio.
- Equilíbrio de tamanho: a primeira versão repetia o vício de deixar a correta mais longa (18 de 50 em Empreendedorismo); o validador apontou e as corretas foram reescritas.

## Correções de conteúdo em questões originais
| Original | Problema | Correção |
|---|---|---|
| estrategia #47 | Indicava **patentear um algoritmo de IA** | Programa de computador em si não é invenção patenteável (Lei 9.279/96, art. 10); proteção por segredo e registro de software (Lei 9.609/98) |
| estrategia #44 | Duas respostas defensáveis (clientes fracos e entrantes fracos) | Cenário com dado de reajustes para ancorar a resposta; feedback reconhece as barreiras |
| empreendedorismo #37, financas #26 | Repetiam outra questão da mesma área | Mesmo caso, outro ângulo (métricas de vaidade; reconciliação absorção × variável) |
| estrategia #4, marketing #19 | Pergunta de lembrar já coberta | Elevadas para Aplicar (classificar tipo de receita; tipo de segmentação) |
| financas #30 | "Fundo que vira sócio" sem distinguir de anjo | Distrator de investidor-anjo com a regra da LC 182/2021 |
| operacoes #47 | "Timebox da sprint" | Reescrita pelo Scrum Guide 2020: foco na Meta da Sprint |

## Conceitos das questões originais que não estão nas fontes de aula (marcados `WEB`)
Contrato psicológico (lideranca #14, #24), pensamento de grupo (lideranca #35), efeito tesoura (financas #50), proteção de software (estrategia #47), estratégias genéricas de Porter (marketing #50), princípios do effectuation (empreendedorismo #41), GEM 2024 (empreendedorismo #20), MEI 2026 (empreendedorismo #3), Scrum Guide 2020 (operacoes #47). Use o filtro **"Fonte: só NLM"** no preview para ver o jogo apenas com conteúdo de aula.

## Distribuição
| | Lembrar | Entender | Aplicar | Analisar | Avaliar |
|---|---|---|---|---|---|
| Base + piloto (347) | 64 | 100 | 117 | 46 | 20 |

Duelo 137 · Giro 271 · Coroa 74 · Desempate 2 (com sobreposição). A base original é mais forte em Lembrar/Entender (Duelo); os próximos lotes devem reforçar **Analisar/Avaliar** (Coroa).
