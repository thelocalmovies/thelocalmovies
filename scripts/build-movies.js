import { writeFile, mkdir } from 'node:fs/promises';

const SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIiZPy4x2y8nUIu9W3ZISLTuD7cm6kQ2wsJlq07gbSnPhc7Avong2zDaJ9PI7PJfrHP6blBQT8wVRb/pub?gid=367444898&single=true&output=csv';
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const headerAliases = {
  no: ['no', 'no.', 'number', '#'],
  title: ['title', 'movie title'],
  year: ['year', 'release year'],
  certification: ['certification', 'rating', 'classification'],
  boughtFrom: ['bought from', 'disc region / bought from', 'region', 'source'],
  format: ['format', 'disc format'],
  edition: ['edition'],
  imdbId: ['imdb id', 'imdbid', 'imdb'],
  notes: ['notes', 'note'],
  dateAdded: ['date added', 'added date'],
  posterOverrideUrl: ['poster override url', 'poster url', 'poster']
};

async function main() {
  console.log('Downloading Google Sheet CSV...');
  const csv = await fetchText(SHEET_CSV_URL);
  const rows = parseCsv(csv);
  const movies = rows.map(mapRow).filter(movie => movie.title);
  console.log(`Found ${movies.length} rows with titles.`);

  const enriched = [];
  for (const [index, movie] of movies.entries()) {
    console.log(`[${index + 1}/${movies.length}] ${movie.title}`);
    const tmdb = TMDB_API_KEY && movie.imdbId ? await getTmdbData(movie.imdbId) : null;
    enriched.push({ ...movie, tmdb });
    await delay(175);
  }

  await mkdir('data', { recursive: true });
  await writeFile('data/movies.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'Google Sheets CSV',
    sourceUrl: SHEET_CSV_URL,
    tmdbEnabled: Boolean(TMDB_API_KEY),
    count: enriched.length,
    movies: enriched
  }, null, 2));

  console.log('Wrote data/movies.json');
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map(normaliseHeader);
  return rows.slice(1).map(values => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || '').trim();
    });
    return record;
  });
}

function mapRow(row) {
  const value = key => getByAliases(row, headerAliases[key]);
  const title = value('title');
  const year = cleanYear(value('year'));
  const imdbId = cleanImdbId(value('imdbId'));

  return {
    no: value('no'),
    title,
    year,
    imdbId,
    ownership: {
      certification: value('certification'),
      boughtFrom: value('boughtFrom'),
      format: value('format'),
      edition: value('edition'),
      notes: value('notes'),
      dateAdded: normaliseDate(value('dateAdded')),
      posterOverrideUrl: value('posterOverrideUrl')
    }
  };
}

function normaliseHeader(header) {
  return String(header || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getByAliases(row, aliases) {
  for (const alias of aliases) {
    const key = normaliseHeader(alias);
    if (row[key]) return row[key];
  }
  return '';
}

function cleanYear(value) {
  const match = String(value || '').match(/\d{4}/);
  return match ? match[0] : String(value || '').trim();
}

function cleanImdbId(value) {
  const match = String(value || '').match(/tt\d+/i);
  return match ? match[0].toLowerCase() : '';
}

function normaliseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

async function getTmdbData(imdbId) {
  try {
    const findUrl = `${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}?api_key=${encodeURIComponent(TMDB_API_KEY)}&external_source=imdb_id`;
    const findData = await fetchJson(findUrl);
    const result = findData.movie_results?.[0];
    if (!result?.id) return null;

    const detailsUrl = `${TMDB_BASE_URL}/movie/${result.id}?api_key=${encodeURIComponent(TMDB_API_KEY)}`;
    const details = await fetchJson(detailsUrl);

    return {
      id: details.id,
      title: details.title,
      originalTitle: details.original_title,
      releaseDate: details.release_date,
      runtime: details.runtime,
      overview: details.overview,
      voteAverage: details.vote_average,
      voteCount: details.vote_count,
      posterUrl: details.poster_path ? `${TMDB_IMAGE_BASE_URL}${details.poster_path}` : '',
      backdropUrl: details.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${details.backdrop_path}` : '',
      genres: Array.isArray(details.genres) ? details.genres.map(genre => genre.name) : []
    };
  } catch (error) {
    console.warn(`TMDb lookup failed for ${imdbId}: ${error.message}`);
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
