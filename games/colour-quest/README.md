# 🎨 Colour Quest

Charlie's idea. The Grey has drained the colour from the world. You're a stick figure with a giant paint brush: collect the colour drops (the bright splashes the Grey missed) and give them to the stick-folk who need them, and their house, car, fruit stall and slide burst back into colour. Grey Gloomies drift about and knock colours out of your bag. Help everyone and the whole world floods with colour.

## Controls
| | Controller | Keyboard | Mouse / touch |
| --- | --- | --- | --- |
| Start | any button | any key | click / tap |
| Move | Left stick / d-pad | WASD / arrows | on-screen joystick |
| Talk / give colours, or jump | A | Space / Enter | A button (talk only; faded when nobody is near) |
| Jump | B | J / Left Shift | Jump button |
| Turn the camera | Right stick | Q / E | drag the screen |
| Camera behind you | L / ZL (hold) | R (hold) | |

The on-screen controls appear after the first click or tap. Pressing a controller button hands control to the controller.

## Code
| File | What's in it |
| --- | --- |
| `src/main.ts` | Start-up, input, HUD, the frame loop, debug bridge |
| `src/pointer.ts` | Mouse/touch: on-screen joystick and buttons, drag to turn the camera |
| `src/game.ts` | Game state and per-frame update: hero, follow camera, drops, quests, Gloomies, the finale |
| `src/world.ts` | The village: quest targets (house, car, stall, slide), trees, rocks, flowers, colliders |
| `src/stick.ts` | Stick figures and their walk cycle |
| `src/scene.ts` | Renderer, ink-on-paper look, the ground shader that colour splats onto |
| `src/palette.ts` | The six colours |

Build `npm run build -w colour-quest`, test `npm test -w colour-quest`.
