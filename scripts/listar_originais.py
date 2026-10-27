import json, sys
sys.stdout.reconfigure(encoding="utf-8")
d = json.load(open("base-original/questions_original.json", encoding="utf-8"))
for i, q in enumerate(d[sys.argv[1]], 1):
    print(f"{i}|{q['diff'][0]}|{q['q']}|A:{q['a']}|B:{q['b']}|C:{q['c']}|D:{q['d']}|={q['ans']}|{q['ex']}")
