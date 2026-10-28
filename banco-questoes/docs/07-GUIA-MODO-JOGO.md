# 07 — Guia "modo jogo": questões rápidas, curtas e divertidas

**Por quê:** o conteúdo está certo, mas várias questões pareciam prova. Tinham texto longo, contas de várias etapas e itens de ordenar ou encadear. No Perguntados, a pessoa lê, entende e responde em segundos. O conteúdo continua universitário; o que muda é a **forma**.

## 1. O que copiamos do Duolingo (repos next14-duolingo-clone e LEAF)
- **Um conceito por questão.** Os desafios do clone (`SELECT`/`ASSIST`) têm um prompt de uma linha e opções de 1–3 palavras.
- **Reconhecer, não recordar.** A pessoa escolhe entre opções curtas e nunca precisa montar a resposta de cabeça.
- **Erro que ensina na hora.** O feedback por alternativa diz em 1 frase por que aquela opção está errada.
- **Ritmo.** Questões fáceis em sequência criam *streak*; a dificuldade sobe aos poucos (Duelo → Giro → Coroa).
- **Corações e XP.** Errar custa pouco e o jogo segue. Por isso nenhuma questão deve exigir papel e caneta.

## 2. Limites por mecânica (o validador cobra)
| | Duelo | Giro | Coroa |
|---|---|---|---|
| Tempo | 20 s | 30 s | 45 s |
| Enunciado | ≤ 110 car. | ≤ 130 car. | ≤ 110 car. |
| Cenário | — | opcional, ≤ 160 car. (1 frase) | obrigatório, 80–240 car. (1–2 frases) |
| Cada alternativa | ≤ 45 car. | ≤ 55 car. | ≤ 60 car. |
| Leitura total (cenário + enunciado + 4 alternativas) | ≤ 280 | ≤ 380 | ≤ 500 |
| Dificuldade | 1–2 | 1–3 | 3–4 |
| Bloom | lembrar · entender | lembrar · entender · aplicar · analisar | aplicar · analisar · avaliar |
| `feedback.curto` | ≤ 120 car. | ≤ 120 car. | ≤ 120 car. |

Leitura de ~15 caracteres por segundo: 500 caracteres ≈ 33 s, o que ainda deixa folga nos 45 s da Coroa.

## 3. Contas: só de cabeça
- **No máximo 3 números** no cenário + enunciado. Anos e números de lei não contam.
- **Uma operação**, com números redondos: 100 − 40, 20% de 500, 90 − 120.
- O resultado sai em ~5 s sem calculadora.
- Se o conceito precisa de várias etapas (VPL, TIR, CMPC, TAM/SAM/SOM completo, PERT), pergunte **a lógica**, não o número. Exemplos: "o que acontece com o VPL se a taxa sobe?", "qual fórmula?", "qual projeto escolher se o VPL de A é maior?".
- O tipo numérico continua só no desempate, também com conta de cabeça.

## 4. Formatos proibidos (não cabem no timer)
- Ordenar etapas ou encadear causa → efeito. Alternativas com "→" são bloqueadas.
- Afirmativas I/II/III combinadas ("apenas I e III").
- Classificar vários itens de uma vez ("X é A, Y é B, Z é C").
- Enunciado negativo (NÃO, EXCETO, INCORRETA) gera aviso. Use só se for muito curto.
- Cenário com tabela, lista de dados ou mais de um personagem com decisões.

## 5. Formatos que funcionam (escolha um)
1. **Qual é o nome disso?** Definição curta → termo. *"Custo que não muda com o volume produzido:"*
2. **Qual é o exemplo?** Termo → exemplo do dia a dia.
3. **Mini-caso → conceito ou ferramenta.** *"A padaria testou 1 sabor novo antes de investir. Isso é…"*
4. **O que acontece se…?** Uma variável muda e a pessoa diz a direção. *"Se o preço sobe e a demanda é elástica, a receita…"*
5. **Conta de cabeça.** Uma operação, números redondos.
6. **Melhor decisão (Coroa).** Um caso de 1–2 frases com uma restrição; 4 decisões curtas.

## 6. Diversão sem perder rigor
- **Cenários do cotidiano:** padaria do bairro, food truck, app de delivery, atlética da faculdade, loja de açaí. Use nomes e lugares concretos e evite "Uma empresa X".
- **Distratores por nível.** Na dificuldade 1–2, distratores de conceitos claramente diferentes. Na 3–4, o conceito vizinho, que é o erro comum.
- **Distrator divertido.** Na dificuldade 1–2, pode haver **1 distrator leve/bem-humorado**, plausível para quem não estudou (ex.: "Contratar um influencer"). Ele também leva `erro_comum` e `feedback`. Nunca na Coroa.
- **Feedback curto** de 1 frase, que ensina o conceito e não repete "Correto!" (a interface já faz isso).
- **Explicação** fica para o "saiba mais". É ali que entram números, fórmulas e citações das aulas.

## 7. O que NÃO muda
4 alternativas, 1 correta, distratores de erros comuns com feedback, cenário neutro (sem palavras que entreguem a resposta), equilíbrio de tamanho (pista ≤ 15%), fontes NLM/WEB e validade.
