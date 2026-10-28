"""Expande as refatorações compactas (base-original/refatoradas/*.json) para o schema completo e grava
lotes/lote-base-original.json, anexando a questão original (base-original/questions_original.json) para auditoria.

Formato compacto de cada item:
  r   índice da questão original (1–50) na área        s   subtema          m  microtema (slug)
  b   bloom      d dificuldade (1–5)      k  mecânicas (ex.: ["duelo","giro"])
  c   [titulo, texto, artefato, restricao]  (opcional → formato cenário)
  q   enunciado
  a   4 alternativas na ordem a–d: "*texto" = correta; [texto, erro_comum, feedback] = distrator
  f   feedback curto        e  explicação
  o   origem (NLM padrão) · u urls · x arquivos (sobrepõe o padrão do subtema) · sec áreas secundárias
  dt  referência se a questão for datada · n nota de revisão · fi subtema cuja ficha é a fonte (quando difere de s)
  nv  true = questão nova que ocupa o lugar da original r (origem_questao vira "inedita", sem o texto original)
"""
import json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREA_JSON = {"empreendedorismo": "EMP", "estrategia": "EST", "financas": "FIN", "lideranca": "LID", "marketing": "MKT", "operacoes": "OPE"}
FICHA = {
    "FEM": "base-conhecimento/materias/11-fundamentos-do-empreendedorismo.md", "MOD": "base-conhecimento/materias/01-modelagem-de-negocios.md",
    "INO": "base-conhecimento/materias/02-inovacao-nas-organizacoes.md", "EST": "base-conhecimento/materias/10-estrategia-e-novos-negocios.md",
    "DEC": "base-conhecimento/02-LACUNAS-TRANSVERSAIS.md", "ASG": "base-conhecimento/02-LACUNAS-TRANSVERSAIS.md",
    "CTB": "base-conhecimento/materias/05-contabilidade-gerencial.md", "INV": "base-conhecimento/materias/09-avaliacao-de-investimentos.md",
    "ECO": "base-conhecimento/materias/08-economia.md", "LCO": "base-conhecimento/materias/07-lideranca-e-comportamento-organizacional.md",
    "GPE": "base-conhecimento/02-LACUNAS-TRANSVERSAIS.md", "NEG": "base-conhecimento/02-LACUNAS-TRANSVERSAIS.md",
    "MKT": "base-conhecimento/materias/06-gestao-de-marketing.md", "PRO": "base-conhecimento/materias/03-gestao-de-processos.md",
    "PRJ": "base-conhecimento/materias/04-gestao-de-projetos.md", "QLD": "base-conhecimento/02-LACUNAS-TRANSVERSAIS.md",
}
ARQ = {
    "FEM": ["Fundamentos do Empreendedorismo - Aulas 01 a 10 (slides)", "Cunha (2022) - capítulos", "Mariano (2022) - capítulos"],
    "MOD": ["Modelagem de Negócios - Aulas 1 a 6 (slides)", "Capítulos 02, 06, 07 e 08 - Modelagem de Negócios"],
    "INO": ["Cunha (2022) - Inovação.pdf", "Capítulo 5 - Inovação (1).pdf", "respostas prova 2025 inovacoes .pdf"],
    "EST": ["Estratégia e Novos Negócios - Aulas 1 a 8 (slides)", "Ferramentas Endeavor (SWOT, 5 Forças, BCG, Canvas)"],
    "CTB": ["Demonstracoes.pptx", "DRE.pptx", "Aula4.pptx", "Custeio.pptx", "Custeio_ABC.pptx"],
    "INV": ["Avaliação de Investimentos - Aulas 1 a 9 (slides)"],
    "ECO": ["AULA 1.pdf", "capítulo 4 _mankiw.pdf", "elasticidade_2024B.pdf", "aula Macro_parte 1.pdf", "macro_parte2A.pdf"],
    "LCO": ["Liderança e CO - slides de aula (liderança, motivação, cultura, comunicação, personalidade)"],
    "MKT": ["NT00032296.pdf (SEBRAE - plano de marketing)", "NT0003229E.pdf (SEBRAE - pesquisa)", "NT00037492.pdf (SEBRAE - vendas)", "OpenStax - Principles of Marketing"],
    "PRO": ["STE00017 - Gestão de Processos - Aulas 1 a 9 (slides)"],
    "PRJ": ["STE00018 - Gestão de Projetos - Aulas 1 a 11 (slides)", "Project Model Canvas.pdf"],
}
MEC = {"giro": (30, 10), "coroa": (45, 30), "duelo": (20, 15)}
CRIT = {c: True for c in ["compreensivel", "relacionada_ao_tema", "gramatical", "clara", "respondivel", "central", "usaria", "nivel_bloom_ok"]}


def expandir(area_json, itens, originais, contadores):
    area = AREA_JSON[area_json]
    out = []
    for it in itens:
        s = it["s"]
        contadores[(area, s)] = contadores.get((area, s), 100) + 1
        alts = []
        for letra, a in zip("abcd", it["a"]):
            if isinstance(a, str) and a.startswith("*"):
                alts.append({"id": letra, "texto": a[1:], "correta": True})
            else:
                alts.append({"id": letra, "texto": a[0], "correta": False, "erro_comum": a[1], "feedback": a[2]})
        cen = None
        if it.get("c"):
            t, txt, art, res = it["c"]
            cen = {"titulo": t, "texto": txt, "artefato": art, "restricao": res}
        p = it["k"][0]
        tempo = MEC[p][0]
        orig = originais[area_json][it["r"] - 1]
        origem = it.get("o", "NLM")
        ficha = FICHA[it["fi"]] if it.get("fi") else FICHA[s]
        fonte = {"origem": origem, "ficha": ficha}
        if "NLM" in origem:
            fonte["arquivos"] = it.get("x") or ARQ.get(it.get("fi") or s, ["(ver ficha)"])
        if "WEB" in origem:
            fonte["urls"] = it["u"]
        q = {
            "id": f"{area}-{s}-{contadores[(area, s)]:03d}", "versao": 1, "area": area, "subtema": s, "microtema": it["m"],
            "tipo": "multipla_escolha", "formato": "cenario" if cen else "direta", "cenario": cen,
            "enunciado": it["q"], "alternativas": alts,
            "feedback": {"curto": it["f"], "explicacao": it["e"], "saiba_mais": ficha},
            "bloom": it["b"], "dificuldade": it["d"], "mecanicas": it["k"], "tempo_seg": tempo, "xp": MEC[p][1],
            "fonte": fonte,
            "validade": {"tipo": "datado", "referencia": it["dt"]} if it.get("dt") else {"tipo": "perene"},
            "revisao": {"status": "revisado_ia", "criterios": dict(CRIT), "notas": it.get("n", "Refatorada da base original: enunciado, distratores e feedback reescritos.")},
            "origem_questao": {"tipo": "base_original", "ref": f"questions.json#{area_json}/{it['r']}",
                               "original": {"q": orig["q"], "a": orig["a"], "b": orig["b"], "c": orig["c"], "d": orig["d"], "gabarito": orig["ans"], "dificuldade": orig["diff"], "explicacao": orig["ex"]}},
        }
        if it.get("nv"):
            q["origem_questao"] = {"tipo": "inedita", "ref": f"substitui questions.json#{area_json}/{it['r']}"}
        if it.get("sec"):
            q["areas_secundarias"] = it["sec"]
        out.append(q)
    return out


def main():
    originais = json.load(open(os.path.join(BASE, "base-original", "questions_original.json"), encoding="utf-8"))
    pasta = os.path.join(BASE, "base-original", "refatoradas")
    todas, cont = [], {}
    for area_json in AREA_JSON:
        p = os.path.join(pasta, f"{area_json}.json")
        if os.path.exists(p):
            itens = json.load(open(p, encoding="utf-8"))
            refs = sorted(i["r"] for i in itens)
            faltam = sorted(set(range(1, 51)) - set(refs))
            print(f"{area_json}: {len(itens)} refatoradas" + (f" | faltam: {faltam}" if faltam else ""))
            todas += expandir(area_json, itens, originais, cont)
    lote = {"lote": {"id": "lote-base-original", "descricao": "Questões do jogo físico original, refatoradas com a metodologia da Etapa 2.",
                     "gerado_em": "2026-10-27", "protocolo": "docs/03-PROTOCOLO.md", "schema": "schema/questao.schema.json"},
            "questoes": todas}
    json.dump(lote, open(os.path.join(BASE, "lotes", "lote-base-original.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("total:", len(todas))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
