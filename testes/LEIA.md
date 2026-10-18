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
| `teste_ponte.py` | ponte: pizzas, cyberdeck, encaixe e tangram com a câmera de foco do PC |
| `teste_vr_simulado.py` | lógica do Quest com controles simulados: relógio, grip, botão da porta, tangram com gatilho |
| `teste_paineis.py` | menu de pausa e painéis |
| `teste_offline_e_progresso.py` | salvar para jogar sem internet, abrir sem internet, progresso salvo, clique de verdade no painel |
| `teste_recomecar_e_sair.py` | recomeçar a missão, sair e voltar |

O jogo expõe `window.__jogo` (estado e funções) só para estes testes. O teste final continua sendo no Quest.
