# The Local Movies

A static GitHub Pages movie collection site powered by a published Google Sheet and enriched with TMDb metadata through GitHub Actions.

## How it works

1. Google Sheets is the master list.
2. GitHub Actions downloads the published CSV.
3. The build script uses IMDb IDs from the sheet to find matching TMDb records.
4. The action writes `data/movies.json`.
5. GitHub Pages displays the collection as movie cards.
