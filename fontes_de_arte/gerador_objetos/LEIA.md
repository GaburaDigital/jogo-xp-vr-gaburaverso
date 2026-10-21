# Gerador dos objetos da Nave

`gerar_objetos.js` gera os GLB dos objetos (portas, mesa, console, protoboard, LED, resistor, jumpers...).
Roda no navegador com o Three.js 0.170 do `node_modules` (veja o `importmap` em `gerar_o.html`):
`gerar_o.html?o=led_paralela` devolve o GLB em `window.resultado.glb` (base64).

Revisão de 20/10 (aprovada pelo autor):
- **LED A "pernas paralelas"** (`o=led_paralela`, vira `led.glb`): cabeça numa peça só (torneada), parte acesa 3 mm por dentro,
  lado chato de verdade no −, sinais + e − em branco na aba; pernas de fio contínuo; a do + desce quase até a placa.
  Os pés continuam nos mesmos furos da protoboard.
- **Resistor** (`o=resistor_novo` e `o=resistor_queimado_novo`): um fio só de furo a furo, dobras arredondadas.

Depois de gerar: conferência de faces no mesmo plano (zero achados) antes de copiar para `public/modelos/`.
