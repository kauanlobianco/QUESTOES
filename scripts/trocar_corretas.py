"""Substitui o texto da alternativa correta em itens da refatoração compacta. Uso: trocar_corretas.py arquivo.json patch.json  (patch = {"r": "novo texto"})"""
import json, sys
p, patch = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
itens = json.load(open(p, encoding="utf-8"))
for it in itens:
    novo = patch.get(str(it["r"]))
    if novo:
        it["a"] = ["*" + novo if isinstance(a, str) else a for a in it["a"]]
json.dump(itens, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", len(patch))
