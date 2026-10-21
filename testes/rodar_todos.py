"""Roda todos os testes de uma vez: monta o jogo, liga o servidor UMA vez, roda a lista e desliga no fim.
Uso: python3 testes/rodar_todos.py            (todos)
     python3 testes/rodar_todos.py treino ponte (só os que têm esses nomes)"""
import subprocess, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from base import servidor, RAIZ

TESTES = ['teste_clones.py', 'teste_abertura.py', 'teste_ponte.py', 'teste_treino.py', 'teste_oficina.py', 'teste_final.py', 'teste_missoes.py',
          'teste_entrega21.py', 'teste_vr_simulado.py', 'teste_menus.py', 'teste_paineis.py', 'teste_offline_e_progresso.py', 'teste_recomecar_e_sair.py']
filtro = sys.argv[1:]
lista = [t for t in TESTES if not filtro or any(f in t for f in filtro)]
aqui = os.path.dirname(os.path.abspath(__file__))
print('montando o jogo (npm run build)...'); subprocess.run(['npm', 'run', 'build'], cwd=RAIZ, check=True, stdout=subprocess.DEVNULL)
falhas = []
with servidor():
    for t in lista:
        inicio = time.time()
        r = subprocess.run([sys.executable, os.path.join(aqui, t)], cwd=aqui, capture_output=True, text=True, timeout=1500)
        saida = (r.stdout + r.stderr).strip().splitlines()
        ok = r.returncode == 0 and any('sem erros' in l for l in saida[-3:])
        if not ok: falhas.append(t)
        print(f"{'OK  ' if ok else 'FALHOU'} {t} ({time.time() - inicio:.0f} s)")
        for l in [l for l in saida if not l.startswith(('- ', '[agent-proxy]', 'Allowed', 'For details'))][-12:]: print('    ' + l)
print('servidor desligado ·', 'todos passaram' if not falhas else 'falharam: ' + ', '.join(falhas))
sys.exit(1 if falhas else 0)
