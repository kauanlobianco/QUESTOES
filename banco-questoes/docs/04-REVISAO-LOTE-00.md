# 04 — Revisão do Lote 00 (piloto)

Arquivo: [`lotes/lote-00-piloto.json`](../lotes/lote-00-piloto.json) · Validação: `python scripts/validar.py lotes/lote-00-piloto.json` → **0 erros, 0 avisos**.

## 1. Composição

| Dimensão | Resultado | Meta do banco completo |
|---|---|---|
| Questões | **45** | ~600 |
| Por área | EMP 8 · EST 7 · FIN 8 · LID 8 · MKT 6 · OPE 8 | 18/16/18/16/14/18% |
| Por tipo | múltipla escolha 33 · associar 4 · V/F 3 · ordenar 2 · numérico 2 · completar lacuna 1 | ≥ 25% fora da múltipla escolha |
| Por Bloom | lembrar 7 · entender 8 · aplicar 17 · analisar 7 · avaliar 6 | 15/25/30/20/10% |
| Por mecânica | giro 27 · duelo 15 · coroa 14 (com sobreposição) | ~55/25/20% |
| Origem | NLM 39 · NLM+WEB 3 · WEB 3 | WEB só em lacunas |
| Interdisciplinares | 10 | ~15% |
| Pista de tamanho | 0/34 após correção (era 62% antes do validador) | ≤ 15% |
| Posição da correta (a/b/c/d) | 8 · 9 · 11 · 6 | equilibrada (o app também embaralha) |

O piloto está **mais pesado em Coroa (Aplicar/Avaliar)** do que a meta, de propósito: as questões de cenário são as mais difíceis de escrever e precisavam ser testadas primeiro. Os lotes seguintes compensam com mais Lembrar/Entender para Giro e Duelo.

## 2. Mesa-redonda — o que cada persona mudou

> As quatro personas são leituras feitas por mim (IA) em papéis distintos. Status das questões: `revisado_ia`. A aprovação humana (`aprovado_professor`) é o próximo passo.

**Especialista Pedagógico**
- Casos **novos** em todas as questões de Aplicar para cima (Clínica Vida Perto, EduPlay, Academia Leve, Júlia, Violão Já…), para testar transferência e não memória do exemplo da aula. Os casos da aula aparecem no **feedback** como ponte ("é o mesmo raciocínio do Problema 3 da Aula 4").
- Maturidade de Hersey-Blanchard tratada **por tarefa** (Júlia é M4 nos relatórios e M3 na apresentação).
- Associar SECI num único contexto (oficina), para comparar as direções em vez de decorar exemplos soltos.

**Precisão de Conteúdo**
- Todos os cálculos recalculados em script (PE, CVL, CMPC composto, elasticidade, TAM/SAM/SOM, VME, PERT, NPR).
- Ambiguidades removidas: "os clientes sabiam" (concierge × Mágico de Oz); "sem tendência" (carta de controle); "mesmo prazo e risco semelhante" (VPL × TIR); compromisso prévio de produzir os sabores votados (inovação distribuída); retirada da pergunta sobre nível de não cliente no Oceano Azul.
- Itens "a confirmar" da Etapa 1 **não** viraram gabarito: ADI 5529 (patente), ACAP (Aula 11), ZOPA.
- Patente marcada como `datado` (regra legal da Lei 9.279/96).

**Integração de Feedback**
- Todo distrator tem `erro_comum` + `feedback` próprio. Em várias questões, cada distrator explica o conceito que ele realmente é (BCG, RACI, Herzberg × Vroom × Maslow) — errar vira revisão do tópico inteiro.
- Distratores "certos pelo motivo errado" para testar raciocínio (FIN-CTB-002 d: rejeitar pela razão errada do ponto de equilíbrio).
- O **validador** encontrou a pista de tamanho (correta mais longa em 62% das questões). Corrigido para 0%.

**Perspectiva Inovadora**
- Empresas fictícias com cara de Niterói/São Gonçalo/RJ, para aproximar da turma da UFF.
- Formatos curtos para celular (SWOT em código "1, 2, 3, 4"; cartões de ordenar com pista de conteúdo).
- Tipo `numerico` (PERT, NPR) pensado para o **desempate do Duelo** ("quem chegar mais perto").

## 3. Exemplos por mecânica (para testar no protótipo)

| Mecânica | Questões sugeridas |
|---|---|
| **Giro** | EST-EST-002 (SWOT), LID-LCO-004 (Vroom), FIN-ECO-002 (elasticidade), EMP-INO-001 (associar SECI), OPE-PRO-004 (associar PDCA) |
| **Coroa** | EMP-FEM-004 (anjo × VC), FIN-CTB-002 (CVL), LID-LCO-002 (Hersey-Blanchard), MKT-MKT-006 (comissão), OPE-PRO-003 (carta de controle), EST-EST-004 (Oceano Azul) |
| **Duelo** | EMP-FEM-001, EST-EST-003, FIN-CTB-001, LID-LCO-003, OPE-PRJ-001 (numérico), FIN-ECO-001 (V/F) |
| **Desafio integrado** (2+ áreas) | EMP-FEM-004 (EMP+FIN), MKT-MKT-006 (MKT+FIN), FIN-ECO-002 (FIN+MKT), OPE-PRJ-002 (OPE+EST), EST-EST-004 (EST+EMP) |

## 4. Pontos para sua validação antes do Lote 01
1. **Tom e dificuldade** das Coroas: estão no nível de prova universitária que vocês querem?
2. **Conteúdo `[WEB]`** (6 questões: Simon, negociação de Harvard, JIT, FMEA, VPL × TIR, Hersey-Blanchard): entra no jogo ou fica num filtro "extra"?
3. **Nomes fictícios regionais**: manter o padrão Niterói/RJ?
4. **Tempo**: 20 s no Duelo e 90 s na Coroa parecem bons para o ritmo do app?
