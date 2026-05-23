# The Local Movies

A static GitHub Pages movie collection site powered by a published Google Sheet and enriched with TMDb metadata through GitHub Actions.

## How it works

1. Google Sheets is the master list.
2. GitHub Actions downloads the published CSV.
3. The build script uses IMDb IDs from the sheet to find matching TMDb records.
4. The action writes `data/movies.json`.
5. GitHub Pages displays the collection as movie cards.

## Required GitHub secret

Create this repository secret:

- `TMDB_API_KEY` — your TMDb API key.

Optional:

- `GOOGLE_SHEET_CSV_URL` — only needed if you want to override the hard-coded published CSV URL in `scripts/build-movies.js`.

## Google Sheet columns supported

- NO.
- TITLE
- YEAR
- CERTIFICATION
- BOUGHT FROM
- FORMAT
- EDITION
- IMDb ID
- NOTES
- DATE ADDED
- Poster URL / Poster Override URL, optional

## First run

After uploading these files:

1. Go to **Settings → Secrets and variables → Actions**.
2. Add `TMDB_API_KEY`.
3. Go to **Actions → Update movie data from Google Sheets**.
4. Click **Run workflow**.
5. Enable GitHub Pages from **Settings → Pages** and deploy from the `main` branch, root folder.

