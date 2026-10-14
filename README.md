# Tower security walkthrough

An interactive browser adaptation of the three authored Blender tower compounds. No central hub is included.

## Controls

- **W/A/S/D:** move; **mouse:** look after clicking Start or Resume.
- **0:** free flight; **1:** walking with ground and obstacle collision.
- **Space / C:** fly up / down; **Shift:** faster movement.
- **E:** interact with the object under the crosshair.
- At a **keypad**, E moves closer and opens the PIN controls. The public demo code is **1234**.
- At a **cabinet**, the first E opens it; E again inspects its contents. Open **Items** to choose equipment, and **About** for its description.
- **R:** close the cabinet under the crosshair.
- **Escape:** leave inspection or release the mouse.
- Touch devices support dragging to look, movement buttons, and Use/inspect.
- The top-right menu contains controls and Return to entrance. During inspection, the back arrow returns to exploration.

This is a presentation simulation. The PIN is public and is not real authentication. Security devices are visual models and do not control or record real equipment. The original Blender file is preserved; the web adaptation adds keypad access in place of the gate key.

## Development

Use Node.js 22 or later:

```sh
npm ci
npm run dev
npm test
npm run build
```

The built site is in `dist/`. URLs use relative paths so the site works under a GitHub Pages repository path.

## GitHub Pages

Push this project to the repository's `main` branch. In Settings → Pages, choose **GitHub Actions** as the build source. The included workflow tests, builds and publishes the static site.

Only the web project needs to be published. The exported GLB and scene manifest are in `public/assets/`; Blender project sources are not required by the browser. `export_web_scene.py` records the export process and requires the adjacent original source folder if run again locally.

The scene retains detailed tower steelwork, fences, supported cameras/floodlights, sensors, protected equipment compartments, and interior records/electronics. Static geometry is batched by material, while nine hinge assemblies remain separate for animation.

Third-party license notices for Three.js and the Barlow font are included in public/THIRD-PARTY-NOTICES.txt.
