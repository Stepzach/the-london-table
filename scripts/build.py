"""Build the static GitHub Pages site and inject public Firebase web-app config."""
import json
import os
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dist = root / "dist"

fields = {
    "FIREBASE_API_KEY": "apiKey",
    "FIREBASE_AUTH_DOMAIN": "authDomain",
    "FIREBASE_PROJECT_ID": "projectId",
    "FIREBASE_APP_ID": "appId",
}
config = {target: os.environ.get(secret, "").strip() for secret, target in fields.items()}
missing = [secret for secret, target in fields.items() if not config[target]]
if missing:
    raise SystemExit(
        "Firebase configuration is incomplete. Add these GitHub Actions repository secrets: "
        + ", ".join(missing)
    )

# Version asset URLs on every commit so browsers/CDNs cannot reuse stale Firebase config.
version = os.environ.get("GITHUB_SHA", "local")[:12]

if dist.exists():
    shutil.rmtree(dist)
dist.mkdir()

for name in ("style.css", "script.js", "favicon.svg"):
    shutil.copy2(root / name, dist / name)

html = (root / "index.html").read_text(encoding="utf-8")
replacements = {
    'href="style.css"': f'href="style.css?v={version}"',
    'src="firebase-config.js" defer': f'src="firebase-config.js?v={version}" defer',
    'src="script.js" defer': f'src="script.js?v={version}" defer',
}
for old, new in replacements.items():
    if old not in html:
        raise SystemExit(f"Expected asset reference not found in index.html: {old}")
    html = html.replace(old, new, 1)

(dist / "index.html").write_text(html, encoding="utf-8")
(dist / ".nojekyll").write_text("")
(dist / "firebase-config.js").write_text(
    "/* Firebase web-app config is public. Never put service-account credentials here. */\n"
    "window.FIREBASE_CONFIG = " + json.dumps(config) + ";\n",
    encoding="utf-8",
)
print(f"Built website with Firebase configured (build {version}).")
