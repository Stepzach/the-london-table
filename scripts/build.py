"""Assemble the static GitHub Pages site. Web app configuration is public to browsers."""
import json, os, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
fields={'FIREBASE_API_KEY':'apiKey','FIREBASE_AUTH_DOMAIN':'authDomain','FIREBASE_PROJECT_ID':'projectId','FIREBASE_APP_ID':'appId'}
config={dst:os.environ.get(src,'').strip() for src,dst in fields.items()}
count=sum(bool(v) for v in config.values())
if count not in (0,len(fields)):
    raise SystemExit('Incomplete Firebase configuration: add all four repository secrets')
if dist.exists(): shutil.rmtree(dist)
dist.mkdir()
for name in ('index.html','style.css','script.js','favicon.svg'):
    shutil.copy2(root/name,dist/name)
(dist/'.nojekyll').write_text('')
(dist/'firebase-config.js').write_text('/* Firebase browser config is public. Never use service account keys here. */\nwindow.FIREBASE_CONFIG = '+json.dumps(config if count else None)+';\n')
print('Built website:', 'Firebase configured' if count else 'Firebase pending')
