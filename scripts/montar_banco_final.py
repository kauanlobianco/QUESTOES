"""Junta todos os lotes num banco único para o app: banco-final/banco-questoes.json.
Sem divisão base × inéditas: o campo origem_questao (auditoria) fica só nos lotes de trabalho.
Uso: python scripts/montar_banco_final.py   (depois de montar_base.py, se a base mudou)"""
import glob, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDEM = ["EMP", "EST", "FIN", "LID", "MKT", "OPE"]


def main():
    todas = []
    for p in sorted(glob.glob(os.path.join(BASE, "lotes", "*.json"))):
        for q in json.load(open(p, encoding="utf-8"))["questoes"]:
            q.pop("origem_questao", None)
            todas.append(q)
    todas.sort(key=lambda q: (ORDEM.index(q["area"]), q["tipo"] != "multipla_escolha", q["subtema"], q["id"]))
    banco = {"lote": {"id": "banco-final", "descricao": f"Banco único do jogo: {len(todas)} questões no padrão modo jogo.",
                      "gerado_em": "2026-10-27", "protocolo": "docs/03-PROTOCOLO.md", "schema": "schema/questao.schema.json"},
             "questoes": todas}
    os.makedirs(os.path.join(BASE, "banco-final"), exist_ok=True)
    json.dump(banco, open(os.path.join(BASE, "banco-final", "banco-questoes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("banco-final/banco-questoes.json:", len(todas), "questões")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
