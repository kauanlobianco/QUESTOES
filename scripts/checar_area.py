"""Checa uma área compacta (base-original/refatoradas/<area>.json) contra o validador, sem gravar nada.
Uso: python scripts/checar_area.py financas"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from collections import Counter
import montar_base as mb, validar as v

sys.stdout.reconfigure(encoding="utf-8")
area = sys.argv[1]
orig = json.load(open(os.path.join(mb.BASE, "base-original", "questions_original.json"), encoding="utf-8"))
itens = json.load(open(os.path.join(mb.BASE, "base-original", "refatoradas", f"{area}.json"), encoding="utf-8"))
qs = mb.expandir(area, itens, orig, {})
erros, avisos = [], []
for q in qs:
    v.checar(q, erros, avisos)
    ls = sorted(((len(x["texto"]), x["correta"]) for x in q["alternativas"]), reverse=True)
    if ls[0][1] and ls[0][0] >= 30 and ls[0][0] > 1.15 * ls[1][0]: avisos.append(f"{q['id']} (r{q['origem_questao']['ref'].split('/')[-1]}): correta mais longa com folga")
rid = {q["id"]: q["origem_questao"]["ref"].split("/")[-1] for q in qs}
print(f"{area}: {len(qs)} itens | mecânica principal: {dict(Counter(q['mecanicas'][0] for q in qs))} | dificuldade: {dict(sorted(Counter(q['dificuldade'] for q in qs).items()))}")
print("posição da correta:", dict(sorted(Counter(next(x['id'] for x in q['alternativas'] if x['correta']) for q in qs).items())))
print(f"ERROS ({len(erros)}):"); [print("  -", f"r{rid.get(x.split(':')[0], '?')}", x) for x in erros]
print(f"AVISOS ({len(avisos)}):"); [print("  -", x) for x in avisos]
