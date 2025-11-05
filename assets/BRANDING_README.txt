Mobile app branding assets

Replace these files with your logo-based designs:
- icon.png           -> App icon (1024x1024 PNG, no transparency needed but recommended)
- adaptive-icon.png  -> Android adaptive icon foreground (1024x1024 PNG with transparency)
- splash-icon.png    -> Splash screen image (e.g., 1500-3000px PNG, centered graphic on transparent/brand bg)
- favicon.png        -> Web (PWA) favicon if you export to web

Suggested workflow from your source image (palliative care.jpg):
1) Open it in an editor (Figma/Photoshop/Canva).
2) Export a square, margin-safe version as 1024x1024 transparent PNG for icon/adaptive-icon.
3) Export a large centered version for splash (PNG) on brand background color (#667eea in app.json by default).
4) Overwrite the files in this folder keeping the same names.

No config changes needed: app.json already points to these filenames.
