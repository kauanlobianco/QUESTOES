"""Valida lotes do banco de questões no padrão Perguntados: 4 alternativas (1 correta + 3 distratores)
em Giro, Coroa e Duelo; tipo numérico só no desempate do Duelo.
Uso: python validar.py ../lotes/lote-00-piloto.json [outros.json]"""
import json, re, sys
from collections import Counter

AREAS = {"EMP", "EST", "FIN", "LID", "MKT", "OPE"}
SUBTEMAS = {"EMP": {"FEM", "MOD", "INO"}, "EST": {"EST", "DEC", "ASG"}, "FIN": {"CTB", "INV", "ECO"},
            "LID": {"LCO", "GPE", "NEG"}, "MKT": {"MKT"}, "OPE": {"PRO", "PRJ", "QLD"}}
BLOOM = ["lembrar", "entender", "aplicar", "analisar", "avaliar", "criar"]
# Modo jogo (07-GUIA-MODO-JOGO.md): enunciado, cenário (mín, máx), alternativa e leitura total em caracteres
MEC = {
    "giro": {"bloom": {"lembrar", "entender", "aplicar", "analisar"}, "dif": (1, 3), "xp": 10, "tempo": 30,
             "enun": 130, "cen": (40, 160), "alt": 55, "total": 380},
    "coroa": {"bloom": {"aplicar", "analisar", "avaliar"}, "dif": (3, 4), "xp": 30, "tempo": 45,
              "enun": 110, "cen": (80, 240), "alt": 60, "total": 500},
    "duelo": {"bloom": {"lembrar", "entender"}, "dif": (1, 2), "xp": 15, "tempo": 20,
              "enun": 110, "cen": (0, 0), "alt": 45, "total": 280},
    "desempate": {"bloom": {"lembrar", "aplicar"}, "dif": (1, 3), "xp": 5, "tempo": 20,
                  "enun": 110, "cen": (0, 0), "alt": 0, "total": 110},
}
OBRIG = ["id", "versao", "area", "subtema", "microtema", "tipo", "formato", "enunciado", "feedback", "bloom",
         "dificuldade", "mecanicas", "tempo_seg", "xp", "fonte", "validade", "revisao"]
CRITERIOS = ["compreensivel", "relacionada_ao_tema", "gramatical", "clara", "respondivel", "central", "usaria", "nivel_bloom_ok"]
VAZAMENTO = ["percebe", "visando", "a fim de", "para melhorar", "o problema é", "a solução", "estratégia correta",
             "infelizmente", "erroneamente", "felizmente", "corretamente"]
ABSOLUTOS = re.compile(r"\b(sempre|nunca|todos|todas|nenhum|nenhuma|jamais)\b", re.I)
SEQUENCIA = re.compile(r"→|->|\s>\s")
ROMANOS = re.compile(r"(I|II|III|IV).*(I|II|III|IV)")
NEGATIVO = re.compile(r"(NÃO|EXCETO|INCORRETA|INCORRETO)")
NAO_CONTA = re.compile(r"(Lei|LC|art\.|ISO|Portaria|Resolução|CVM|PMBOK|nº|n\.º)\s*[\d./]+|(19|20)\d{2}", re.I)


def numeros(txt):
    return re.findall(r"\d+(?:[.,]\d+)*", NAO_CONTA.sub(" ", txt))


GENERICAS = re.compile(r"^(todas as (alternativas|anteriores)|nenhuma das (alternativas|anteriores))", re.I)


def checar(q, erros, avisos):
    i = q.get("id", "?")
    e = lambda m: erros.append(f"{i}: {m}")
    w = lambda m: avisos.append(f"{i}: {m}")
    for c in OBRIG:
        if c not in q: e(f"campo obrigatório ausente: {c}")
    if not re.fullmatch(r"(EMP|EST|FIN|LID|MKT|OPE)-[A-Z]{3}-\d{3}", i): e("id fora do padrão AREA-SUB-NNN")
    a, s = q.get("area"), q.get("subtema")
    if a not in AREAS: e(f"área inválida {a}")
    elif s not in SUBTEMAS[a]: e(f"subtema {s} não pertence à área {a}")
    if not i.startswith(f"{a}-{s}-"): e("id não bate com área/subtema")
    if q.get("bloom") not in BLOOM: e("bloom inválido")
    t, mecs = q.get("tipo"), q.get("mecanicas", [])
    alts = q.get("alternativas") or []
    if t == "multipla_escolha":
        if len(alts) != 4: e(f"padrão Perguntados exige 4 alternativas (tem {len(alts)})")
        if [x.get("id") for x in alts] != ["a", "b", "c", "d"]: e("ids das alternativas devem ser a, b, c, d")
        if sum(1 for x in alts if x.get("correta")) != 1: e("deve haver exatamente 1 alternativa correta")
        for x in alts:
            if not x.get("correta") and (not x.get("erro_comum") or not x.get("feedback")):
                e(f"distrator {x.get('id')} sem erro_comum/feedback")
            if GENERICAS.match(x.get("texto", "")): e(f"alternativa {x.get('id')} genérica ('todas/nenhuma das anteriores') quebra o 'eliminar 2'")
        if len({x.get('texto', '').strip().lower() for x in alts}) < 4: e("alternativas repetidas")
        if "desempate" in mecs: e("desempate deve ser numérico")
    elif t == "numerico":
        if mecs != ["desempate"]: e("tipo numerico só é permitido com mecanicas = ['desempate']")
        r = q.get("resposta_numerica") or {}
        if "valor" not in r: e("numerico exige resposta_numerica.valor")
        if alts: e("numerico não tem alternativas")
    else:
        e(f"tipo inválido: {t} (use multipla_escolha ou numerico)")
    cen = q.get("cenario")
    if q.get("formato") == "cenario":
        if not cen: e("formato cenario sem bloco cenario")
        else:
            for c in ("texto", "artefato", "restricao"):
                if not cen.get(c): e(f"cenario sem {c}")
            txt = cen.get("texto", "").lower()
            for p in VAZAMENTO:
                if p in txt: e(f"cenário não neutro: contém '{p}'")
    elif cen: e("formato direta não deve ter cenario")
    fb = q.get("feedback", {})
    if len(fb.get("curto", "")) > 120: e(f"feedback.curto com {len(fb.get('curto',''))} > 120 caracteres")
    if not fb.get("explicacao"): e("feedback.explicacao vazio")
    if not mecs: e("sem mecânica")
    for m in mecs:
        r = MEC.get(m)
        if not r: e(f"mecânica inválida {m}"); continue
        if q.get("bloom") not in r["bloom"]: e(f"bloom '{q.get('bloom')}' não permitido em {m}")
        lo, hi = r["dif"]
        if not (lo <= q.get("dificuldade", 0) <= hi): e(f"dificuldade {q.get('dificuldade')} fora de {lo}–{hi} para {m}")
        if m == "coroa" and q.get("formato") != "cenario": e("coroa exige formato cenario")
        if m in ("duelo", "desempate"):
            if q.get("formato") != "direta": e(f"{m} exige formato direta")
        # modo jogo: tudo precisa caber na leitura rápida da mecânica mais curta da lista
        ctxt = (cen or {}).get("texto", "") if q.get("formato") == "cenario" else ""
        lo, hi = r["cen"]
        if ctxt and not (lo <= len(ctxt) <= hi): e(f"{m}: cenário com {len(ctxt)} car. (limite {lo}–{hi})")
        if len(q.get("enunciado", "")) > r["enun"]: e(f"{m}: enunciado com {len(q['enunciado'])} car. > {r['enun']}")
        for x in alts:
            if len(x.get("texto", "")) > r["alt"]: e(f"{m}: alternativa {x.get('id')} com {len(x['texto'])} car. > {r['alt']}")
        total = len(ctxt) + len(q.get("enunciado", "")) + sum(len(x.get("texto", "")) for x in alts)
        if total > r["total"]: e(f"{m}: leitura total {total} car. > {r['total']}")
    stem = ((cen or {}).get("texto", "") + " " + q.get("enunciado", ""))
    if len(numeros(stem)) > 3: e(f"conta de cabeça: {len(numeros(stem))} números no enunciado/cenário (máx. 3)")
    for x in alts:
        if SEQUENCIA.search(x.get("texto", "")): e(f"alternativa {x.get('id')} é sequência/encadeamento (não cabe no timer)")
        if ROMANOS.search(x.get("texto", "")): e(f"alternativa {x.get('id')} combina afirmativas I/II/III")
    if NEGATIVO.search(q.get("enunciado", "")): w("enunciado negativo (NÃO/EXCETO)")
    if mecs and mecs[0] in MEC:
        p = mecs[0]
        esp = MEC[p]["tempo"]
        if q.get("tempo_seg") != esp: e(f"tempo_seg {q.get('tempo_seg')} ≠ {esp} da mecânica principal {p}")
        if q.get("xp") != MEC[p]["xp"]: e(f"xp {q.get('xp')} ≠ {MEC[p]['xp']} da mecânica principal {p}")
    f = q.get("fonte", {})
    if f.get("origem") not in {"NLM", "WEB", "NLM+WEB"}: e("fonte.origem inválida")
    if "WEB" in f.get("origem", "") and not f.get("urls"): e("origem WEB exige urls")
    if "NLM" in f.get("origem", "") and not f.get("arquivos"): e("origem NLM exige arquivos")
    v = q.get("validade", {})
    if v.get("tipo") == "datado" and not v.get("referencia"): e("validade datado exige referencia")
    crit = q.get("revisao", {}).get("criterios", {})
    for c in CRITERIOS:
        if crit.get(c) is not True: e(f"critério de qualidade não atendido/ausente: {c}")
    oq = q.get("origem_questao", {})
    if oq.get("tipo") == "base_original" and not oq.get("ref"): e("base_original exige ref")
    if t == "multipla_escolha" and len(alts) == 4:
        cor = next((x for x in alts if x.get("correta")), None)
        if cor and ABSOLUTOS.search(cor["texto"]) and not any(ABSOLUTOS.search(x["texto"]) for x in alts if not x.get("correta")):
            w("só a correta tem termo absoluto (pista)")
        if cor and not ABSOLUTOS.search(cor["texto"]) and sum(1 for x in alts if not x.get("correta") and ABSOLUTOS.search(x["texto"])) == 3:
            w("todos os distratores têm termos absolutos (pista)")


def main(paths):
    sys.stdout.reconfigure(encoding="utf-8")
    erros, avisos, todas = [], [], []
    for p in paths:
        todas += json.load(open(p, encoding="utf-8"))["questoes"]
    for k, n in Counter(q.get("id") for q in todas).items():
        if n > 1: erros.append(f"{k}: id duplicado ({n}x)")
    for q in todas:
        checar(q, erros, avisos)
    mc = [q for q in todas if q.get("tipo") == "multipla_escolha" and len(q.get("alternativas", [])) == 4]

    def pista_tamanho(q):
        ls = sorted(((len(x["texto"]), x["correta"]) for x in q["alternativas"]), reverse=True)
        return ls[0][1] and ls[0][0] >= 30 and ls[0][0] > 1.15 * ls[1][0]
    vies = [q["id"] for q in mc if pista_tamanho(q)]
    for i in vies: avisos.append(f"{i}: correta é a mais longa com folga (pista de tamanho)")
    pos = Counter(next(x["id"] for x in q["alternativas"] if x["correta"]) for q in mc)
    print(f"Questões: {len(todas)}")
    print("Por área:", dict(sorted(Counter(q['area'] for q in todas).items())))
    print("Por tipo:", dict(Counter(q['tipo'] for q in todas)))
    print("Por Bloom:", {b: c for b, c in sorted(Counter(q['bloom'] for q in todas).items(), key=lambda x: BLOOM.index(x[0]))})
    print("Por mecânica (com sobreposição):", dict(Counter(m for q in todas for m in q['mecanicas'])))
    print("Por origem do conteúdo:", dict(Counter(q['fonte']['origem'] for q in todas)))
    print("Base original × inéditas:", dict(Counter(q.get('origem_questao', {}).get('tipo', 'inedita') for q in todas)))
    print("Interdisciplinares:", sum(1 for q in todas if q.get('areas_secundarias')))
    if mc:
        pct = 100 * len(vies) / len(mc)
        print(f"Pista de tamanho: {len(vies)}/{len(mc)} ({pct:.0f}%) | posição da correta: {dict(sorted(pos.items()))}")
        if pct > 15: avisos.append(f"LOTE: viés de comprimento — {pct:.0f}% (meta ≤ 15%)")
        if max(pos.values()) > 0.4 * len(mc): avisos.append("LOTE: posição da correta concentrada")
    print(f"\nERROS ({len(erros)}):"); [print("  -", x) for x in erros]
    print(f"AVISOS ({len(avisos)}):"); [print("  -", x) for x in avisos]
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
