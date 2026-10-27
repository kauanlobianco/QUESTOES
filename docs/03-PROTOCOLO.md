# 03 — Protocolo de geração e revisão (aplicado a cada questão)

Derivado de `base-conhecimento/00-METODOLOGIA.md` (BloomAssessment, QuizGen-RAG, kastle-lab, clones do Duolingo).

## Passo 1 — Fatos-chave (grounding)
- Toda questão nasce de **um microtema de uma ficha** (`base-conhecimento/materias/*.md`) e cita a ficha em `fonte.ficha`.
- Antes de escrever, listo os fatos atômicos que a resposta exige. **Se um fato não está na ficha nem na fonte `[WEB]` registrada, a questão não é escrita.**
- Cálculos são refeitos (script Python) antes de entrar no lote.

## Passo 2 — Gancho de cenário neutro (só Coroa e Giro com cenário)
- Cenário = **fatos crus**: personagens/empresa fictícia brasileira, dados, **≥ 1 artefato** (ferramenta, dado, processo) e **≥ 1 restrição** (custo, prazo, risco, trade-off).
- **Proibido** no cenário: explicar teoria, diagnosticar, insinuar a resposta, adjetivar a decisão ("infelizmente", "erroneamente", "visando", "percebe que"). Toda interpretação fica no enunciado/alternativas.
- Empresas reais só quando o caso veio das fontes (Nubank, Cirque du Soleil etc.); casos novos usam nomes fictícios.

## Passo 3 — Enunciado no verbo de Bloom certo
| Bloom | Verbos/estrutura de enunciado |
|---|---|
| Lembrar | "Qual é…", "Quem…", "Qual o prazo…" |
| Entender | "Por que…", "O que explica…", "Qual afirmação descreve corretamente…" |
| Aplicar | "Classifique…", "Calcule…", "Qual tipo é este caso…" (caso **novo**, nunca o exemplo da aula) |
| Analisar | "Qual relação…", "Qual leitura dos dados…", "O que diferencia…" |
| Avaliar | "Qual decisão é mais defensável…", "Qual crítica procede…" — com critério explícito |

## Passo 4 — Distratores = erros comuns
- Cada distrator vem de um campo **"Erros comuns / confusões"** da ficha (ou de erro de cálculo típico) e registra o diagnóstico em `erro_comum`.
- Regras de redação: mesma extensão e estrutura gramatical da correta; nada de "todas as anteriores"; nada de distrator absurdo; termos absolutos ("sempre", "nunca") distribuídos para não denunciar a correta.

## Passo 5 — Feedback-chave
- `feedback.curto` (≤ 160 caracteres): **uma frase que ensina o porquê**.
- `feedback` por alternativa: responde ao erro específico ("Isso é instrumentalidade; aqui o problema é a expectância…").
- `feedback.explicacao`: 2–3 frases com o raciocínio completo.

## Passo 6 — Mesa-redonda das 4 personas (adaptado do QuizGen-RAG)
Cada questão passa por quatro leituras críticas; o que mudou fica em `revisao.notas`:
1. **Especialista Pedagógico** — o verbo e a tarefa correspondem ao nível de Bloom declarado? A mecânica está certa?
2. **Precisão de Conteúdo** — confere com a ficha/fonte? números recalculados? edição/ano citado quando datado?
3. **Integração de Feedback** — os distratores mapeiam erros reais? o feedback ensina? há pista involuntária (comprimento, absolutos, repetição de palavras do enunciado)?
4. **Perspectiva Inovadora** — é engajadora para um universitário brasileiro? cabe na tela do celular? funciona no ritmo do modo (Duelo 20 s, Giro 30 s, Coroa 45 s) sem papel e caneta? Ver [`07-GUIA-MODO-JOGO.md`](07-GUIA-MODO-JOGO.md).

> Transparência: nesta fase as quatro personas são **leituras feitas por mim (IA)** seguindo esses papéis; o status final é `revisado_ia`. O status `aprovado_professor` fica reservado para a validação humana.

## Passo 7 — 8 critérios de qualidade (kastle-lab)
`compreensivel` · `relacionada_ao_tema` · `gramatical` · `clara` · `respondivel` (com o que o curso ensina) · `central` (conceito-chave, não curiosidade) · `usaria` (um professor usaria) · `nivel_bloom_ok`. Questão com qualquer critério `false` não entra no lote.

## Passo 8 — Validação automática
`python scripts/validar.py lotes/<arquivo>.json` — schema, regras de mecânica, neutralidade do cenário, viés de comprimento, distribuição de Bloom/tipos/áreas.
