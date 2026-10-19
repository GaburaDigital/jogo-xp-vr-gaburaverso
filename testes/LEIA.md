# Testes automáticos (computador)

Rodam o jogo no Chrome sem janela (Playwright) e jogam sozinhos, tirando fotos em `testes/fotos/`.

```bash
pip install playwright && python3 -m playwright install chromium
npm run build && npx vite preview --port 4180 --strictPort   # num terminal
cd testes && python3 teste_abertura.py                       # em outro
```

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
| `teste_missoes.py` | reiniciar o treinamento no meio, trocar de sala com uma missão pela metade, recarregar com tudo feito |

O jogo expõe `window.__jogo` (estado e funções) só para estes testes. `j.testeTempo.escala` acelera a simulação (o Chrome sem placa de vídeo roda a uns 5 quadros por segundo). O teste final continua sendo no Quest.
