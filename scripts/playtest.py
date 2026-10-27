"""Playtest com agentes-persona.
  python scripts/playtest.py amostra      → playtest/amostra_cega.json (sem gabarito) + playtest/gabarito_feedback.json
  python scripts/playtest.py consolidar   → playtest/RELATORIO-PLAYTEST.md a partir de playtest/resp-*.json
Amostra estratificada: por área, 4 Duelo + 4 Giro + 2 Coroa (mecânica principal) + os desempates."""
import glob, json, os, random, sys
from collections import Counter, defaultdict
from statistics import mean

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PT = os.path.join(BASE, "playtest")
COTA = {"duelo": 4, "giro": 4, "coroa": 2}
NOMES = {"EMP": "Empreendedorismo", "EST": "Estratégia", "FIN": "Finanças", "LID": "Liderança", "MKT": "Marketing", "OPE": "Operações"}


def todas():
    qs = []
    for p in sorted(glob.glob(os.path.join(BASE, "lotes", "*.json"))):
        qs += json.load(open(p, encoding="utf-8"))["questoes"]
    return qs


def amostra():
    rnd = random.Random(42)
    qs, sel = todas(), []
    for a in NOMES:
        for m, n in COTA.items():
            pool = [q for q in qs if q["area"] == a and q["mecanicas"][0] == m]
            sel += rnd.sample(pool, min(n, len(pool)))
    sel += [q for q in qs if q["tipo"] == "numerico"]
    rnd.shuffle(sel)
    cega, gab = [], []
    for q in sel:
        c = {"id": q["id"], "area": NOMES[q["area"]], "mecanica": q["mecanicas"][0], "tempo_seg": q["tempo_seg"]}
        if q.get("cenario"):
            c["cenario"] = q["cenario"]["texto"]
        c["enunciado"] = q["enunciado"]
        if q["tipo"] == "numerico":
            c["resposta_numerica_unidade"] = q["resposta_numerica"].get("unidade", "")
        else:
            c["alternativas"] = {x["id"]: x["texto"] for x in q["alternativas"]}
        cega.append(c)
        g = {"id": q["id"], "feedback_curto": q["feedback"]["curto"], "explicacao": q["feedback"]["explicacao"],
             "dificuldade_declarada": q["dificuldade"], "bloom": q["bloom"]}
        if q["tipo"] == "numerico":
            g["correta"] = q["resposta_numerica"]["valor"]
        else:
            g["correta"] = next(x["id"] for x in q["alternativas"] if x["correta"])
            g["feedback_por_alternativa"] = {x["id"]: ("correta" if x["correta"] else x["feedback"]) for x in q["alternativas"]}
        gab.append(g)
    os.makedirs(PT, exist_ok=True)
    json.dump(cega, open(os.path.join(PT, "amostra_cega.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(gab, open(os.path.join(PT, "gabarito_feedback.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"amostra: {len(cega)} questões", dict(Counter(c["mecanica"] for c in cega)))


def consolidar():
    qs = {q["id"]: q for q in todas()}
    gab = {g["id"]: g for g in json.load(open(os.path.join(PT, "gabarito_feedback.json"), encoding="utf-8"))}
    resp = {}
    for p in sorted(glob.glob(os.path.join(PT, "resp-*.json"))):
        resp[os.path.basename(p)[5:-5]] = {r["id"]: r for r in json.load(open(p, encoding="utf-8"))}
    pers = list(resp)

    def acertou(r, g):
        v = r.get("resposta")
        if isinstance(g["correta"], (int, float)):
            rn = qs[g["id"]]["resposta_numerica"]
            try:
                return abs(float(v) - rn["valor"]) <= rn.get("tolerancia", 0)
            except (TypeError, ValueError):
                return False
        return str(v).strip().lower() == g["correta"]

    def media(rs, k):
        v = [r[k] for r, _ in rs if isinstance(r.get(k), (int, float))]
        return mean(v) if v else 0

    def linha(rs):
        n = len(rs)
        return (f"{100 * sum(acertou(r, g) for r, g in rs) / n:.0f}%", f"{media(rs, 'tempo_estimado_s'):.0f} s",
                f"{100 * sum(1 for r, _ in rs if r.get('cabe_no_timer')) / n:.0f}%", f"{media(rs, 'dificuldade_percebida'):.1f}",
                f"{media(rs, 'clareza'):.1f}", f"{media(rs, 'diversao'):.1f}", f"{media(rs, 'feedback_ensina'):.1f}")

    L = ["# Relatório do playtest com agentes-persona", "",
         f"Amostra cega de {len(gab)} questões (por área: 4 Duelo + 4 Giro + 2 Coroa, mais os desempates). "
         "Cada persona respondeu sem ver o gabarito, estimou o tempo e avaliou a questão; depois leu o feedback e avaliou se ele ensina. "
         "Notas de 1 a 5.", "",
         "## Por persona", "",
         "| Persona | Acerto | Tempo estimado | Cabe no timer | Dificuldade | Clareza | Diversão | Feedback ensina |",
         "|---|---|---|---|---|---|---|---|"]
    for p in pers:
        rs = [(r, gab[i]) for i, r in resp[p].items() if i in gab]
        L.append(f"| {p} | " + " | ".join(linha(rs)) + " |")
    L += ["", "## Por mecânica (todas as personas)", "",
          "| Mecânica | Timer | Acerto | Tempo estimado | Cabe no timer | Dificuldade | Clareza | Diversão | Feedback ensina |",
          "|---|---|---|---|---|---|---|---|---|"]
    por_m, por_a = defaultdict(list), defaultdict(list)
    for p in pers:
        for i, r in resp[p].items():
            if i in gab:
                por_m[qs[i]["mecanicas"][0]].append((r, gab[i]))
                por_a[qs[i]["area"]].append((r, gab[i]))
    for m, rs in por_m.items():
        L.append(f"| {m} | {qs[rs[0][1]['id']]['tempo_seg']} s | " + " | ".join(linha(rs)) + " |")
    L += ["", "## Por área (todas as personas)", "",
          "| Área | Acerto | Tempo estimado | Cabe no timer | Dificuldade | Clareza | Diversão | Feedback ensina |",
          "|---|---|---|---|---|---|---|---|"]
    for a in NOMES:
        if por_a.get(a):
            L.append(f"| {NOMES[a]} | " + " | ".join(linha(por_a[a])) + " |")
    L += ["", "## Questões sinalizadas", "", "| ID | Mec. | Acertos | Sinais | O que as personas disseram |", "|---|---|---|---|---|"]
    sinal = []
    for i, g in gab.items():
        rs = {p: resp[p][i] for p in pers if i in resp[p]}
        if not rs:
            continue
        ac = [p for p, r in rs.items() if acertou(r, g)]
        s = []
        if not ac:
            s.append("ninguém acertou")
        if any("prof" in p for p in rs) and not any("prof" in p for p in ac):
            s.append("professora errou")
        if len(ac) == len(rs) and all(r.get("dificuldade_percebida", 3) <= 1 for r in rs.values()):
            s.append("fácil demais?")
        if any(r.get("cabe_no_timer") is False for r in rs.values()):
            s.append("estoura timer")
        s += sorted({r["problema"] for r in rs.values() if r.get("problema")})
        if s:
            com = " · ".join(f"*{p}*: {r.get('sugestao') or r.get('comentario', '')}" for p, r in rs.items() if r.get("problema") or r.get("sugestao"))
            sinal.append((-len(s), i, f"| {i} | {qs[i]['mecanicas'][0]} | {len(ac)}/{len(rs)} | {', '.join(s)} | {com} |"))
    L += [x[2] for x in sorted(sinal)]
    L += ["", "## Comentários gerais das personas", ""]
    for p in pers:
        f = os.path.join(PT, f"geral-{p}.md")
        if os.path.exists(f):
            L += [f"### {p}", "", open(f, encoding="utf-8").read().strip(), ""]
    open(os.path.join(PT, "RELATORIO-PLAYTEST.md"), "w", encoding="utf-8").write("\n".join(L))
    print("\n".join(L[:45]))
    print(f"... {len(sinal)} questões sinalizadas")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    {"amostra": amostra, "consolidar": consolidar}[sys.argv[1]]()
