# Clones sem travar: 20 rodadas da saída dos 16 clones (simulação dentro do jogo, passo de 1/30 s, 60 s cada,
# capturando um clone a cada 3 s depois de 20 s). Conta "tremidas" (anda-para-anda em menos de 0,3 s),
# paradas longas, a maior parada e o tempo em que dois clones ficaram encostados.
from base import *
import sys
RODADAS = int(sys.argv[1]) if len(sys.argv) > 1 else 20
with sync_playwright() as p:
    b, pg, erros = abrir(p, 640, 400)
    entrar_pc(pg)
    tot = {'tremidas': 0, 'paradas': 0, 'paradoMax': 0, 'encostados': 0, 'trocasClipe': 0}
    ruins = 0
    for s in range(1, RODADAS + 1):
        r = J(pg, f'return j.simularClones(60, {s * 7919})')
        for k in ('tremidas', 'paradas', 'trocasClipe'): tot[k] += r[k]
        tot['encostados'] += r['encostados']; tot['paradoMax'] = max(tot['paradoMax'], r['paradoMax'])
        ok = r['tremidas'] == 0 and r['paradoMax'] <= 1.0
        ruins += 0 if ok else 1
        print(f"rodada {s:2d}: tremidas {r['tremidas']:3d} · paradas {r['paradas']:2d} · maior parada {r['paradoMax']:.2f} s · encostados {r['encostados']:.2f} s · trocas de animação {r['trocasClipe']:3d} · escondidos {r['escondidos']} tubo {r['tubo']}", '' if ok else '  <- não passou')
    print('TOTAL', {k: (round(v, 2) if isinstance(v, float) else v) for k, v in tot.items()}, '· rodadas que não passaram:', ruins)
    print('\n'.join(erros[:10]) or 'sem erros')
    b.close()
