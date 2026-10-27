# 05 — Plano de execução em lotes

**Meta:** ~600 questões (≈ 100 por área), geradas em lotes de **30–40**, cada um focado em **um subtema**, para manter o rigor do piloto (fatos-chave → cenário neutro → distratores de erros comuns → feedback → mesa-redonda → 8 critérios → validador).

## 1. Sequência

Ordem: primeiro as matérias com ficha mais completa e números verificáveis; por último, as que dependem de conteúdo `[WEB]` (esperam sua decisão sobre o item 2 de `04-REVISAO-LOTE-00.md`).

| Lote | Área · Subtema | Base (ficha) | Qtd. | Foco do lote | Dependência |
|---|---|---|---|---|---|
| 01 | FIN · CTB Contabilidade | 05 | 40 | BP/DRE (nomenclatura atual), CVL, absorção × variável, segmentada, ABC | — |
| 02 | OPE · PRO Processos | 03 | 38 | Fundamentos, Plan (VOC/Kano/CTQ/SIPOC), Do (RACI, Y/y/x), Check; caso Nubank | — |
| 03 | OPE · PRJ Projetos | 04 | 42 | Estruturas, ciclos, TAP/premissa/restrição, EAP, CPM/PERT, riscos/VME, qualidade, Scrum 2020 | — |
| 04 | FIN · INV Investimentos | 09 | 34 | Risco, CMPC/passivo oculto, valuation, VPL/TIR/payback, capital de giro, planilha | — |
| 05 | FIN · ECO Economia | 08 | 34 | Oferta/demanda, equilíbrio, elasticidades, estruturas, macro, RBU | — |
| 06 | EMP · FEM Fundamentos | 11 | 40 | Linha do tempo, CCEs/TCP, tipos, educação, processo, spin-offs, Baron & Shane | — |
| 07 | EMP · MOD Modelagem | 01 | 40 | Wasserman, plano × modelo, Lean, MVP/pivô, BMC/VPC/padrões, Lean Canvas/AARRR | — |
| 08 | EMP · INO Inovação | 02 | 28 | Invenção × inovação, SECI, frugal/social/disruptiva, aberta × distribuída, Teece, TD | Oslo 2018 citado com edição |
| 09a | EST · EST (parte 1) | 10 | 36 | 5 Ps, planejamento/VUCA, SWOT cruzada, PI, escolas de Mintzberg | ADI 5529 verificada |
| 09b | EST · EST (parte 2) | 10 | 34 | BCG, 5 Forças, valor criado (Brandenburger & Stuart), Oceano Azul, BMC/BSC, eficiência × eficácia × efetividade | — |
| 10 | LID · LCO (parte 1) | 07 | 34 | CO, Belbin, liderança (situacional, transformacional, lado sombrio), motivação | — |
| 11 | LID · LCO (parte 2) | 07 | 32 | Personalidade, D&I e gênero (conceitual), cultura e clima, comunicação/voz, prazer e sofrimento | Revisão de sensibilidade |
| 12 | MKT · MKT (parte 1) | 06 | 42 | Conceito/orientações, mix (4Ps/5Ps/7Ps), comportamento do consumidor, pesquisa | — |
| 13 | MKT · MKT (parte 2) | 06 + 10 | 42 | Segmentação/posicionamento, plano de marketing, vendas (7 passos), TAM/SAM/SOM, preço, canais, marca | — |
| 14 | LID · GPE + NEG `[WEB]` | lacunas | 30 | Gestão de pessoas (6 processos), negociação de Harvard, conflito (Thomas-Kilmann), poder | Sua decisão sobre `[WEB]` |
| 15 | OPE · QLD `[WEB]` | lacunas + 03/04 | 26 | 7 ferramentas, FMEA, Lean/JIT/7 desperdícios, curva ABC | Idem |
| 16 | EST · DEC + ASG `[WEB]` | lacunas | 22 | Simon, decisões programadas, níveis; ESG/Pacto Global | Idem |
| 17 | Integrado (2+ áreas) | várias | 30 | Pontes de `01-AREAS.md` para o "Desafio Integrado" do Duelo | Lotes 01–16 |

**Total previsto:** 47 (piloto) + 300 (base original refatorada) + lotes novos. Com a base já cobrindo ~50 questões por área, os lotes 01–17 podem ser reduzidos para ~20–30 questões cada, focados nos microtemas e níveis de Bloom ainda descobertos.

## 2. Regras de cada lote
- **Formato:** sempre 4 alternativas (padrão Perguntados); numérico só para desempate.
- **Mix por lote:** como a base original já cobre bem Lembrar/Entender (Duelo), os lotes novos devem puxar para **Coroa (Aplicar/Analisar/Avaliar)** e evitar repetir microtemas já cobertos pela base (checar no preview antes de cada lote).
- **Cobertura:** cada microtema `núcleo` da ficha recebe ≥ 2 questões (níveis de Bloom diferentes); `periférico`, no máximo 1.
- **Saída:** `lotes/lote-NN-<subtema>.json` + seção na `04-REVISAO` (ou `revisao/lote-NN.md`) + `validar.py` com 0 erros e pista de tamanho ≤ 15%.
- **Anti-duplicação:** antes de fechar um lote, validar junto com todos os anteriores (`python scripts/validar.py lotes/*.json`) para pegar IDs repetidos.
- **Itens "a confirmar"** só entram depois de verificados (ACAP/Aula 11, ADI 5529, princípios ISO 9001, ZOPA).

## 3. Ritmo sugerido
Dois lotes por rodada de conversa (≈ 80 questões), com sua validação a cada 2–3 lotes. Se o professor quiser revisar, o campo `revisao.status` passa para `aprovado_professor` questão a questão.
