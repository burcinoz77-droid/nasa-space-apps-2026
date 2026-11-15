# Team workflow

## 1. Clone the repository (once)
```bash
git clone https://github.com/burcinoz77-droid/nasa-space-apps-2026.git
cd nasa-space-apps-2026
```

## 2. Start every change on your own branch
Never push to `main` directly. Open your own branch:
```bash
git checkout main
git pull
git checkout -b name/feature     # example: ayse/data-processing
```

## 3. Commit and push
```bash
git add .
git commit -m "Short description of what you did"
git push -u origin name/feature
```

## 4. Open a pull request
Go to the repository on GitHub and press "Compare & pull request".
It is merged into `main` once a teammate reviews and approves it.

## Folder layout
- `src/`  → code
- `data/` → small sample data (do not put large files in the repository, share a link)
- `docs/` → presentation, notes, images

## Tips
- Run `git pull` before you start.
- Never commit passwords, API keys or the `.env` file.
