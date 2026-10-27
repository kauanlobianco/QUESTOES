# 01 — Arquitetura das 6 Áreas (categorias da roleta / personagens)

**Decisão:** mantenho as **6 macro-áreas do jogo físico**. Elas cobrem as 11 matérias sem sobra e, somadas aos complementos `[WEB]`, cobrem os **15 objetos de conhecimento do ENADE 2025**. As disciplinas viram **subtemas** (equivalente às "unidades" do Duolingo) e os conceitos das fichas viram **microtemas** (equivalente às "lições").

```
Área (personagem/coroa)  →  Subtema (disciplina ou complemento)  →  Microtema (conceito da ficha)  →  Questões
```

## Mapa de encaixe

| Área | Código | Subtemas (origem) | Objetos ENADE cobertos | Peso no banco |
|---|---|---|---|---|
| **1. Empreendedorismo** | `EMP` | `FEM` Fundamentos do Empreendedorismo · `MOD` Modelagem de Negócios · `INO` Inovação nas Organizações | X | 18% |
| **2. Estratégia** | `EST` | `EST` Estratégia e Novos Negócios · `DEC` Tomada de decisão `[WEB]` · `ASG` ASG/ESG `[WEB]` | I, II, III, XIV | 16% |
| **3. Finanças** | `FIN` | `CTB` Contabilidade Gerencial · `INV` Avaliação de Investimentos · `ECO` Economia | I (macro), V, VI | 18% |
| **4. Liderança** | `LID` | `LCO` Liderança e Comportamento Organizacional · `GPE` Gestão de pessoas `[WEB]` · `NEG` Negociação e conflito `[WEB]` | IV, VII, VIII, XIII | 16% |
| **5. Marketing** | `MKT` | `MKT` Gestão de Marketing (+ TAM/SAM/SOM, preço, canais e marca da matéria de Estratégia) | IX | 14% |
| **6. Operações** | `OPE` | `PRO` Gestão de Processos · `PRJ` Gestão de Projetos · `QLD` Qualidade e operações/logística `[WEB]` | XI, XII, XV | 18% |

### Por que cada escolha
- **Inovação → Empreendedorismo** (e não Estratégia): as fontes de Inovação são casos de startups, financiamento e inovação frugal/social — a mesma lógica do Empreendedorismo. Oceano Azul fica em **Estratégia** (é ensinado lá com mais profundidade), mas aparece em Empreendedorismo como questão interdisciplinar.
- **Economia → Finanças**: o que o curso cobra de Economia é preço, elasticidade, juros (Selic) e políticas — insumos de decisão financeira. Questões de macroambiente recebem área secundária `EST`.
- **Contabilidade + Investimentos → Finanças**: núcleo de "análise econômico-financeira" (ENADE V e VI).
- **Gestão de pessoas, negociação, ética e D&I → Liderança**: preenchem as lacunas ENADE IV, VII, VIII e XIII com base em conceitos que já existem em `07-lideranca` (motivação, comunicação, diversidade).
- **Tomada de decisão → Estratégia**: decisão programada × não programada e racionalidade limitada conversam com níveis de planejamento e escolas de Mintzberg. Os "ganchos de decisão" das outras áreas (VME, CVL incremental, VPL × TIR) continuam nas suas áreas.
- **ASG → Estratégia**: governança e sustentabilidade como escolha estratégica (capacidades dinâmicas verdes, Pacto Global).
- **Qualidade, Lean/JIT e logística → Operações**: junta-se a Processos e Projetos, que já trazem PDCA, carta de controle, Pareto, Ishikawa, GUT e custos da qualidade.
- **Marketing** absorve TAM/SAM/SOM, skimming × penetração, canais e estratégias de marca da Aula 7 de Estratégia (são conteúdos de mercado, não de escolha estratégica).

## Temas transversais (interdisciplinares)

Não crio uma 7ª categoria. Cada questão tem **uma área principal** (para a roleta) e pode ter `areas_secundarias`. Questões com 2+ áreas alimentam:
- **Duelo "Desafio Integrado"** (rodada final do 1v1): sorteia questões interdisciplinares.
- **Coroa**: pode cair uma interdisciplinar desde que a área principal seja a do personagem.

Pontes prioritárias (vindas do `01-INDICE.md` da Etapa 1):

| Ponte | Áreas | Exemplo de questão |
|---|---|---|
| Ponto de equilíbrio | FIN ↔ EMP | PE de uma startup a partir do Lean Canvas |
| Comissão sobre receita × sobre margem | MKT ↔ FIN | Qual produto o vendedor empurra |
| Elasticidade → preço → margem | FIN (ECO) ↔ MKT | Promoção que aumenta ou reduz receita |
| Oceano Azul / inovação de valor | EST ↔ EMP | ERRC em startup |
| McClelland, lócus, CCEs | LID ↔ EMP | Classificar comportamento empreendedor |
| RACI, Ishikawa, Pareto, 5W2H | OPE (PRO ↔ PRJ) | Plano de melhoria como projeto |
| Financiamento (anjo, VC, crowdfunding) | EMP ↔ FIN | Diluição × fôlego de caixa |

## Regras de conteúdo herdadas da Etapa 1 (`02-LACUNAS-TRANSVERSAIS.md`)
1. **Conceito perene primeiro.** Normas, rankings e números conjunturais só entram citando edição/ano no enunciado ("Segundo o PMBOK 7 (2021)…", "No Doing Business 2020…") e com `validade.tipo = "datado"`.
2. **Nunca** usar valores regulatórios exatos de crowdfunding/P2P (mudam com frequência e há revisão em curso na CVM).
3. **Nomenclatura atualizada**: Ativo Não Circulante (não "Ativo Permanente"); Scrum Guide 2020 (Developers; 5 eventos; 3 artefatos).
4. Conteúdo `[WEB]` entra com `fonte.origem = "WEB"` e URL; o app pode filtrar se o professor quiser só conteúdo de aula.
5. Itens marcados "a confirmar" nas fichas (ACAP na Aula 11 de Processos; ADI 5529 sobre prazo de patente; 7 princípios da ISO 9001; ZOPA) **não** viram questão até serem verificados.
6. Temas sensíveis (assédio, gênero, burnout, racismo estrutural): só perguntas conceituais, sem caricatura, sem pessoa real identificável como vítima.
