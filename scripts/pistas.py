"""Lista, por item da refatoração compacta, as questões em que a correta é a mais longa com folga."""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")
for it in json.load(open(sys.argv[1], encoding="utf-8")):
    L = [(len(a[1:]) if isinstance(a, str) else len(a[0]), isinstance(a, str)) for a in it["a"]]
    s = sorted(L, reverse=True)
    if s[0][1] and s[0][0] >= 30 and s[0][0] > 1.15 * s[1][0]:
        cor = next(a[1:] for a in it["a"] if isinstance(a, str))
        print(f"r{it['r']}: {[l for l,_ in L]} | {cor}")
