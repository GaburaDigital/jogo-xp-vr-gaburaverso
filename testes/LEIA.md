# Testes automáticos (computador)

Rodam o jogo no Chrome sem janela (Playwright) e jogam sozinhos, tirando fotos em `testes/fotos/`.

```bash
pip install playwright && python3 -m playwright install chromium
npm run build
python3 testes/rodar_todos.py           # todos os testes (liga o servidor uma vez e desliga no fim)
python3 testes/rodar_todos.py treino    # só os que têm "treino" no nome
python3 testes/teste_abertura.py        # um teste sozinho (também liga e desliga o servidor)
```

Os testes **ligam e desligam o servidor sozinhos** (`servidor()` em `base.py`): nada fica rodando depois deles, nem se um teste falhar.

| Arquivo | O que confere |
|---|---|
| `teste_abertura.py` | abertura inteira: andar, mirante, janela, pegar e soltar caixa, relógio, faixas do chão |
| `teste_ponte.py` | ponte: pizzas, cyberdeck, encaixe e tangram (peças trocadas, giro simétrico, paralelogramo virado) com a câmera de foco do PC |
| `teste_vr_simulado.py` | lógica do Quest com controles simulados: luvas, relógio, grip de longe (sem encostar), caixa que não foge da cabeça, vibrações, pizzas sobre o cyberdeck, botão da porta, tangram com a peça na mão (fora da mesa volta), tocar no Gabura, arma do treinamento, LED virado com A |
| `teste_paineis.py` | menu de pausa e painéis |
| `teste_offline_e_progresso.py` | salvar para jogar sem internet, abrir sem internet, progresso salvo, clique de verdade no painel |
| `teste_recomecar_e_sair.py` | recomeçar a missão, sair e voltar |
| `teste_menus.py` | jogo salvo na tela inicial, "Jogar do início", pausa 4 × 2, "Reiniciar missão", "Recomeçar jogo" e a colisão da mesa |
| `teste_treino.py` | treinamento: clones saindo da máquina e se escondendo, posto (só para os lados), pegar a arma, errar o esconderijo, capturar os 16, luz acesa, botão "não aperte" |
| `teste_oficina.py` | oficina: posto, câmera de foco, pegadinhas (resistor queimado e jumper curto não encaixam), LED ao contrário e virado com F, motor ligando |
| `teste_clones.py` | clones sem travar: 20 rodadas da saída dos 16 clones (simulação a 30 qps, sem desenhar); conta tremidas (anda-para-anda em menos de 0,3 s), paradas e clones encostados |
| `teste_entrega21.py` | portas com botão (abre, fecha, abre por dentro, fecha ao voltar), seta que some no posto, capturas rápidas sem uma fala por cima da outra, clones com a cor normal |
| `teste_final.py` | final: as 3 luzes acendem a faixa do portal, alavanca travada sem as luzes, puxar a alavanca, atravessar, túnel (a plataforma leva o jogador, hologramas), créditos em ordem com Sair e Recomeçar |
| `teste_missoes.py` | reiniciar o treinamento no meio, trocar de sala com uma missão pela metade, recarregar com tudo feito |

O jogo expõe `window.__jogo` (estado e funções) só para estes testes. `j.testeTempo.escala` acelera a simulação (o Chrome sem placa de vídeo roda a uns 5 quadros por segundo). O teste final continua sendo no Quest.
