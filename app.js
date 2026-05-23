const state = {
  movies: [],
  filtered: []
};

const els = {
  grid: document.querySelector('#movieGrid'),
  template: document.querySelector('#movieCardTemplate'),
  movieCount: document.querySelector('#movieCount'),
  updatedAt: document.querySelector('#updatedAt'),
  status: document.querySelector('#status'),
  searchInput: document.querySelector('#searchInput'),
  formatFilter: document.querySelector('#formatFilter'),
  certFilter: document.querySelector('#certFilter'),
  sortSelect: document.querySelector('#sortSelect')
};

async function init() {
  try {
    const response = await fetch('./data/movies.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load movies.json (${response.status})`);
    const payload = await response.json();
    state.movies = payload.movies || [];

    els.movieCount.textContent = `${state.movies.length} movies`;
    els.updatedAt.textContent = payload.generatedAt
      ? `Updated ${new Date(payload.generatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
      : 'Run the GitHub Action to load movies';

    if (!state.movies.length) {
      showStatus('No movies found yet. After uploading these files, add the TMDB_API_KEY secret and run the “Update movie data from Google Sheets” GitHub Action.');
    }

    populateFilters();
    bindEvents();
    applyFilters();
  } catch (error) {
    showStatus(`Unable to load collection: ${error.message}`);
    els.movieCount.textContent = 'No data';
  }
}

function showStatus(message) {
  els.status.hidden = false;
  els.status.textContent = message;
}

function populateFilters() {
  const formats = uniqueValues(state.movies.map(movie => movie.ownership.format));
  const certs = uniqueValues(state.movies.map(movie => movie.ownership.certification));

  addOptions(els.formatFilter, formats);
  addOptions(els.certFilter, certs);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map(value => String(value).trim()))].sort((a, b) => a.localeCompare(b));
}

function addOptions(select, values) {
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function bindEvents() {
  [els.searchInput, els.formatFilter, els.certFilter, els.sortSelect].forEach(element => {
    element.addEventListener('input', applyFilters);
    element.addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const term = els.searchInput.value.trim().toLowerCase();
  const format = els.formatFilter.value;
  const cert = els.certFilter.value;

  state.filtered = state.movies.filter(movie => {
    const searchable = [
      movie.title,
      movie.year,
      movie.ownership.format,
      movie.ownership.edition,
      movie.ownership.certification,
      movie.ownership.boughtFrom,
      movie.ownership.notes,
      movie.tmdb?.genres?.join(' '),
      movie.tmdb?.overview
    ].filter(Boolean).join(' ').toLowerCase();

    return (!term || searchable.includes(term))
      && (!format || movie.ownership.format === format)
      && (!cert || movie.ownership.certification === cert);
  });

  sortMovies(state.filtered, els.sortSelect.value);
  renderMovies(state.filtered);
}

function sortMovies(movies, sortMode) {
  const title = movie => normaliseTitle(movie.title || '');
  const year = movie => Number(movie.year || 0);
  const rating = movie => Number(movie.tmdb?.voteAverage || 0);
  const dateAdded = movie => Date.parse(movie.ownership.dateAdded || '') || 0;

  const sorters = {
    'title-asc': (a, b) => title(a).localeCompare(title(b)),
    'year-desc': (a, b) => year(b) - year(a) || title(a).localeCompare(title(b)),
    'date-desc': (a, b) => dateAdded(b) - dateAdded(a) || title(a).localeCompare(title(b)),
    'rating-desc': (a, b) => rating(b) - rating(a) || title(a).localeCompare(title(b))
  };

  movies.sort(sorters[sortMode] || sorters['title-asc']);
}

function normaliseTitle(value) {
  return value.replace(/^(the|a|an)\s+/i, '').trim();
}

function renderMovies(movies) {
  els.grid.innerHTML = '';
  els.movieCount.textContent = `${movies.length} movie${movies.length === 1 ? '' : 's'}`;

  const fragment = document.createDocumentFragment();
  movies.forEach(movie => fragment.append(createMovieCard(movie)));
  els.grid.append(fragment);
}

function createMovieCard(movie) {
  const node = els.template.content.cloneNode(true);
  const card = node.querySelector('.movie-card');
  const poster = node.querySelector('.poster');
  const fallback = node.querySelector('.poster-fallback');
  const title = node.querySelector('h2');
  const year = node.querySelector('.year');
  const meta = node.querySelector('.meta-line');
  const overview = node.querySelector('.overview');
  const details = node.querySelector('.details');
  const links = node.querySelector('.links');

  const posterUrl = movie.ownership.posterOverrideUrl || movie.tmdb?.posterUrl;

  title.textContent = movie.title || 'Untitled';
  year.textContent = movie.year || '';
  meta.textContent = [movie.ownership.format, movie.ownership.edition, movie.ownership.certification].filter(Boolean).join(' • ');
  overview.textContent = movie.tmdb?.overview || movie.ownership.notes || 'No overview available.';

  if (posterUrl) {
    poster.src = posterUrl;
    poster.alt = `${movie.title} poster`;
    fallback.hidden = true;
    poster.onerror = () => {
      poster.hidden = true;
      fallback.hidden = false;
      fallback.textContent = movie.title || 'No poster';
    };
  } else {
    poster.hidden = true;
    fallback.textContent = movie.title || 'No poster';
  }

  addDetail(details, 'Owned', [movie.ownership.boughtFrom, movie.ownership.dateAdded].filter(Boolean).join(' • '));
  addDetail(details, 'Genre', movie.tmdb?.genres?.join(', '));
  addDetail(details, 'Runtime', movie.tmdb?.runtime ? `${movie.tmdb.runtime} min` : '');
  addDetail(details, 'Rating', movie.tmdb?.voteAverage ? `${movie.tmdb.voteAverage.toFixed(1)} / 10` : '');
  addDetail(details, 'Notes', movie.ownership.notes);

  if (movie.imdbId) {
    const imdb = document.createElement('a');
    imdb.href = `https://www.imdb.com/title/${movie.imdbId}/`;
    imdb.target = '_blank';
    imdb.rel = 'noopener noreferrer';
    imdb.textContent = 'IMDb';
    links.append(imdb);
  }

  if (movie.tmdb?.id) {
    const tmdb = document.createElement('a');
    tmdb.href = `https://www.themoviedb.org/movie/${movie.tmdb.id}`;
    tmdb.target = '_blank';
    tmdb.rel = 'noopener noreferrer';
    tmdb.textContent = 'TMDb';
    links.append(tmdb);
  }

  if (!links.children.length) links.remove();
  if (!meta.textContent) meta.remove();

  card.dataset.title = movie.title || '';
  return node;
}

function addDetail(container, label, value) {
  if (!value) return;
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = value;
  container.append(dt, dd);
}

init();
