# PROJETO

- linha: gaburaverso
- nome: Experiência VR no GaburaVERSO (a Nave)
- repositorio: jogo-xp-vr-gaburaverso
- publico: alunos de 11 a 22 anos
- plataforma: vr-quest (com versão adaptada para PC)
- duracao: 15 a 20 minutos
- licenca_codigo: MIT
- licenca_arte_marca: reservada (Gabura Digital)
- engine: Three.js 0.170 + WebXR, Vite, TypeScript strict
- perfil: ver skill gaburaverso

## Resumo

O jogador acorda na nave do Gaburaverso. A Gabu_IA, pelo relógio do pulso, guia a abertura; depois cada sala tem uma missão para religar uma luz da nave (ponte, treinamento, oficina) e, com as três acesas, o portal abre para a despedida no túnel. Feito para o Meta Quest 3S, funciona offline e tem uma versão adaptada para PC.

## Decisões fixas

- Locomoção: só andar (analógico); giro em passos (30° ou 45°) ou contínuo, escolhido nas Opções. Sem teletransporte.
- Relógio: botão X ou levantar o pulso esquerdo. Menu: Y (o ≡ não chega ao WebXR).
- Volumes: trilha 15% a 20%, efeitos 35% a 50% (mesa de som do Editor de Cenas). Opções: Música, Efeitos, Vozes.
- Clones: um som cada (Gojo "Miau", Fred "bada-bada-bada"), de vez em quando, nunca os dois juntos, nunca na captura.
- Iluminação: modo "Jogo no Quest"; opção "Reduzir efeitos de iluminação".
- PC: tela inicial com "Jogar no VR" grande e "Jogar na versão adaptada para PC" menor; o Quest lembra que entrou no VR, o PC não lembra.
- Legendas ligadas (P/M/G); bordas de conforto desligadas por padrão.
- Modo de teste: link na tela inicial e em Opções, com senha (não aparece no jogo).
- Tangram: peça encaixa ao chegar bem perto (4,5 cm) com o giro certo; gatilho gira 45° no VR; roda ou clique direito no PC, com a câmera parada sobre o console.

## Entregas

1. Base, interface, abertura e ponte (esta).
2. Treinamento (captura dos clones).
3. Oficina (circuito).
4. Portal, túnel e créditos.
5. Desempenho e acabamento final.
