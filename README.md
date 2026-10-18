# Experiência VR no GaburaVERSO: a Nave

**Link:** https://gaburadigital.github.io/jogo-xp-vr-gaburaverso/

<img src="docs/qrcode.png" alt="QR code do link do jogo" width="180">

> O Quest 3S não lê QR codes sozinho: o QR serve para abrir o link no celular ou com um app leitor de QR da loja do Quest. No óculos, o mais rápido é digitar o link no navegador.

Jogo em **Realidade Virtual** para o **Meta Quest 3S**, feito com WebXR. O jogador acorda na nave do Gaburaverso e ajuda a tripulação a religar as luzes, uma missão por sala. Tem também uma **versão adaptada para PC** (teclado e mouse), para testar e para quem não tem o óculos.

## Primeira visita no Quest

1. Abra o link no navegador do Quest.
2. Toque em **Salvar para jogar sem internet** e espere chegar a 100%. Depois disso o jogo abre mesmo sem Wi-Fi.
3. Instale como app (menu do navegador → *Instalar app*) ou adicione aos favoritos.
4. Toque em **Jogar no VR**. Nas próximas vezes, o Quest já mostra só esse botão (o resto fica em **Mais opções**).

**Verificar atualização** (na tela inicial) procura a versão nova quando houver internet.

## Controles

| Meta Quest | | Computador | |
|---|---|---|---|
| Analógico esquerdo | andar | W A S D | andar |
| Analógico direito | girar (em passos ou contínuo, nas Opções) | Mouse | olhar |
| Grip (lateral) | segurar / soltar | Clique direito | segurar / soltar |
| Gatilho | usar, apertar, girar a peça 45° | Clique esquerdo | usar, apertar |
| X ou levantar o pulso | relógio | R | relógio |
| Y | menu (pausa) | Esc | menu (pausa) |
| | | Roda ou clique direito | girar a peça do tangram |
| | | Espaço | pular a fala |

O botão ≡ do controle esquerdo não chega ao navegador no WebXR; por isso o menu abre no **Y**.

## O que já dá para jogar (entrega 1)

- Tela inicial, aviso da versão PC, menu de pausa, Opções (Música, Efeitos, Vozes, giro, conforto, iluminação, legendas), Como jogar e Missão.
- **Abertura** completa na sala central: relógio vibrando, janela com o título, caixas para pegar, jogar, empurrar e empilhar.
- **Ponte**: achar o cyberdeck da Gabura, encaixar no console e montar o foguete do tangram. A luz da ponte acende no fim.
- Todas as portas funcionam: dá para explorar a nave inteira. As outras missões chegam nas próximas entregas.
- O progresso fica salvo no navegador.

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:5173/jogo-xp-vr-gaburaverso/
npm run build    # gera dist/ (o GitHub Pages publica sozinho pela Action)
```

**Testar no Quest pelo cabo:** ligue o modo desenvolvedor do Quest, conecte o USB e abra `chrome://inspect` no Chrome do computador para ver o console do navegador do óculos.

**Publicar:** commit e push pelo GitHub Desktop → aguarde a Action (aba *Actions*) → no Quest, **Verificar atualização**. No GitHub: *Settings → Pages → Source: GitHub Actions*.

### Mapa do código (`src/`)

| Pasta | O que tem |
|---|---|
| `nucleo/` | dados (pacote de cenas e falas), áudio (Músicas, Efeitos, Vozes), opções e progresso |
| `mundo/` | Three.js: renderizador com WebXR, modelos, holograma, boca pela voz, paredes, luzes |
| `cenas/` | o tocador de cenas (igual ao Editor de Cenas) e o diretor, que liga as cenas ao jogo |
| `xr/` | entrada (VR e PC viram as mesmas ações) e o jogador (andar, girar, relógio) |
| `interacao/` | objetos que dá para pegar e as portas |
| `missoes/` | abertura, ponte e os efeitos que ficam no mundo (faixas, luzes) |
| `interface/` | tela inicial, painéis do VR, legenda e os desenhos em SVG |

As cenas vêm do **Editor de Cenas Gabura** (`public/dados/cenas_nave.json`): falas, movimentos, sons, eventos e os "aguardar" (o jogo segue quando o jogador faz o que a cena pede).

## Licença

O **código** está sob a licença MIT (veja `LICENSE`): pode estudar, copiar e mudar. A marca Gaburaverso, os personagens, os textos do roteiro, as vozes e a identidade visual são **reservados** à Gabura Digital e não entram na MIT. Fontes Baloo 2 e Nunito: SIL Open Font License 1.1. Feito com Vite, TypeScript e Three.js 0.170.
