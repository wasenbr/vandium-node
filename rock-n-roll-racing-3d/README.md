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
| Arma frontal (laser/míssil) | Espaço / J | X / RB | TIRO |
| Arma traseira (mina/óleo) | X / K | B / LB | MINA / ÓLEO |
| Nitro | Shift | L3 / R3 | NITRO |
| Câmera (aérea → cockpit → perseguição) | C | Y | 🎥 |
| Pausa | Esc / P | Start | ❚❚ |
| Som liga/desliga | M | | |

Armas e nitro recarregam a cada volta, como no original. Parâmetros de URL para testes:
`?autopilot` (a IA pilota o seu carro) e `?laps=1` (corrida curta).

## Estrutura

- `src/sim/` — simulação pura e determinística (pista, física, voltas, armas, IA), sem Three.js:
  a mesma que rodará no servidor online. `world.ts` é o estado da corrida; `ai.ts` os pilotos da CPU.
- `src/render/` — pista, carro, cenário, câmeras e pós-processamento, tudo gerado por código.
- `src/input/`, `src/ui/`, `src/audio/`, `src/core/` — controles, HUD/menus, som e loop do jogo.
