# Rock 'n' Roll Racing 3D

Remake 3D de *Rock n' Roll Racing* para navegador (PC e celular). Plano completo em [PLANO.md](PLANO.md).

## Rodar

```bash
cd rock-n-roll-racing-3d
npm install
npm run dev      # abre em http://localhost:5173 — e na rede local, para testar no celular
npm test         # testes da simulação (pistas, física, voltas)
npm run build    # gera a versão estática em dist/
```

Para jogar no celular: rode `npm run dev` no PC e abra no celular o endereço "Network" que aparece
no terminal (mesmo Wi‑Fi). O `dist/` pode ser publicado em qualquer hospedagem estática.

## Controles

| | Teclado | Controle | Celular |
|---|---|---|---|
| Acelerar | ↑ / W | RT ou A | ACEL |
| Frear / ré | ↓ / S | LT | FREIO |
| Virar | ← → / A D | analógico / direcional | ◀ ▶ |
| Nitro | Shift | L3 / R3 | NITRO |
| Câmera (aérea → cockpit → perseguição) | C | Y | 🎥 |
| Pausa | Esc / P | Start | ❚❚ |

## Estrutura

- `src/sim/` — simulação pura (pista, física, voltas), sem Three.js: a mesma que rodará no servidor online.
- `src/render/` — pista, carro, cenário, câmeras e pós-processamento, tudo gerado por código.
- `src/input/`, `src/ui/`, `src/audio/`, `src/core/` — controles, HUD/menus, som e loop do jogo.
