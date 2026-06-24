// ══════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════
const API = 'http://127.0.0.1:8000/api';

const GENRES = [
  { value: 'Action',      label: 'Ação' },
  { value: 'Adventure',   label: 'Aventura' },
  { value: 'Animation',   label: 'Animação' },
  { value: 'Biography',   label: 'Biografia' },
  { value: 'Comedy',      label: 'Comédia' },
  { value: 'Crime',       label: 'Crime' },
  { value: 'Documentary', label: 'Documentário' },
  { value: 'Drama',       label: 'Drama' },
  { value: 'Fantasy',     label: 'Fantasia' },
  { value: 'History',     label: 'História' },
  { value: 'Horror',      label: 'Terror' },
  { value: 'Music',       label: 'Música' },
  { value: 'Mystery',     label: 'Mistério' },
  { value: 'Romance',     label: 'Romance' },
  { value: 'Sci-Fi',      label: 'Ficção Científica' },
  { value: 'Sport',       label: 'Esporte' },
  { value: 'Thriller',    label: 'Suspense' },
  { value: 'War',         label: 'Guerra' },
  { value: 'Western',     label: 'Faroeste' },
  { value: 'Family',      label: 'Família' },
];
const GENRE_LABEL = Object.fromEntries(GENRES.map(g => [g.value, g.label]));

const PLATFORMS = [
  { value: 'Todas',       label: 'Todas',      emoji: '🌐' },
  { value: 'Netflix',     label: 'Netflix',     emoji: '🔴' },
  { value: 'Prime Video', label: 'Prime Video', emoji: '🔵' },
  { value: 'Disney+',     label: 'Disney+',     emoji: '🏰' },
  { value: 'Max',         label: 'Max',         emoji: '🟣' },
  { value: 'Apple TV+',   label: 'Apple TV+',   emoji: '🍎' },
  { value: 'Paramount+',  label: 'Paramount+',  emoji: '⭐' },
  { value: 'Globoplay',   label: 'Globoplay',   emoji: '🟠' },
  { value: 'Star+',       label: 'Star+',       emoji: '💫' },
  { value: 'Crunchyroll', label: 'Crunchyroll', emoji: '🍥' },
  { value: 'Mubi',        label: 'Mubi',        emoji: '🎞️' },
];

const MOODS = [
  { id: 'light',    emoji: '😌', label: 'Leve e divertido',    desc: 'Algo para relaxar' },
  { id: 'tense',    emoji: '😰', label: 'Tenso e intenso',     desc: 'Suspense e thriller' },
  { id: 'curious',  emoji: '🤔', label: 'Curioso e reflexivo', desc: 'Documentários e bio' },
  { id: 'excited',  emoji: '⚡', label: 'Animado e empolgado', desc: 'Ação e aventura' },
  { id: 'sad',      emoji: '🥺', label: 'Melancólico',         desc: 'Dramas e romances' },
  { id: 'inspired', emoji: '🌟', label: 'Inspirado',           desc: 'Histórias que motivam' },
];

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════
const state = {
  sessionKey:      null,
  view:            'explore',
  page:            1,
  currentMood:     null,
  selectedGenres:  [],
  selectedPlats:   [],
  contentType:     'both',
  favorites:       new Set(),
  loading:         false,
  // Funcionalidade B
  bubbleMode:      false,
  // Funcionalidade C
  maxRuntime:      null,
  // Funcionalidade A (volátil — nunca persiste)
  groupSize:       2,
  groupSession:    false,
  groupPrefs:      [],   // array de { contentType, genres[], adult }
};

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
async function init() {
  state.sessionKey = getOrCreateSession();
  buildGenreGrid();
  buildPlatformGrid();
  buildMoodGrid();
  bindContentTypeButtons();

  try {
    const res  = await fetch(`${API}/user/check?session_key=${state.sessionKey}`);
    const data = await res.json();
    if (data.has_profile) {
      showApp();
      await updateFavCount();
      loadExplore();
    } else {
      showSurvey();
    }
  } catch {
    showSurvey();
  }
}

function getOrCreateSession() {
  let key = localStorage.getItem('cm_session');
  if (!key) {
    key = 'user_' + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem('cm_session', key);
  }
  return key;
}

// ══════════════════════════════════════════════════════
// SURVEY
// ══════════════════════════════════════════════════════
function buildGenreGrid() {
  document.getElementById('genreGrid').innerHTML = GENRES.map(g => `
    <button class="tag-chip" data-genre="${g.value}" onclick="toggleGenre(this)">${g.label}</button>
  `).join('');
}

function toggleGenre(el) {
  const genre = el.dataset.genre;
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) state.selectedGenres.push(genre);
  else state.selectedGenres = state.selectedGenres.filter(g => g !== genre);
}

function buildPlatformGrid() {
  document.getElementById('platformGrid').innerHTML = PLATFORMS.map(p => `
    <button class="tag-chip" data-platform="${p.value}" onclick="togglePlatform(this)">${p.emoji} ${p.label}</button>
  `).join('');
}

function togglePlatform(el) {
  const plat = el.dataset.platform;
  if (plat === 'Todas') {
    document.querySelectorAll('#platformGrid .tag-chip').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    state.selectedPlats = ['Todas'];
    return;
  }
  const todasBtn = document.querySelector('#platformGrid [data-platform="Todas"]');
  if (todasBtn) todasBtn.classList.remove('selected');
  state.selectedPlats = state.selectedPlats.filter(p => p !== 'Todas');
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) state.selectedPlats.push(plat);
  else state.selectedPlats = state.selectedPlats.filter(p => p !== plat);
}

function bindContentTypeButtons() {
  document.querySelectorAll('.ctype-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.ctype-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      state.contentType = this.dataset.value;
    });
  });
}

async function submitSurvey() {
  if (state.selectedGenres.length === 0) { showToast('Selecione pelo menos um gênero ✨'); return; }
  if (state.selectedPlats.length === 0)  { showToast('Selecione pelo menos uma plataforma 📺'); return; }
  try {
    const res = await fetch(`${API}/user/survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_key:  state.sessionKey,
        genres:       state.selectedGenres,
        content_type: state.contentType,
        platforms:    state.selectedPlats,
      }),
    });
    if (!res.ok) throw new Error();
    hideSurvey(); showApp(); loadExplore();
    showToast('Perfil salvo! Boas descobertas 🎬');
  } catch {
    showToast('Erro ao salvar. Verifique se o servidor está rodando.');
  }
}

// ══════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════
function navigate(view) {
  state.view = view; state.page = 1; state.currentMood = null;
  state.bubbleMode = false;
  document.getElementById('bubbleToggle').classList.remove('active');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view)
  );
  document.getElementById('moodBadge').classList.add('hidden');
  if (view === 'explore') {
    setPageTitle('Explorar', 'Títulos selecionados para você');
    loadExplore();
  } else if (view === 'favorites') {
    setPageTitle('Favoritos', 'Títulos que você salvou');
    loadFavorites();
  }
}

function setPageTitle(title, subtitle) {
  document.getElementById('pageTitle').innerHTML =
    `<h1 class="text-2xl font-bold text-text">${title}</h1>
     <p class="text-muted text-sm mt-0.5">${subtitle}</p>`;
}

// ══════════════════════════════════════════════════════
// EXPLORE
// ══════════════════════════════════════════════════════
async function loadExplore(append = false) {
  if (state.loading) return;
  state.loading = true;
  if (!append) { showSkeletons(); state.page = 1; }

  let url;
  if (state.currentMood) {
    url = `${API}/movies/mood?session_key=${state.sessionKey}&mood=${state.currentMood}`;
  } else if (state.bubbleMode) {
    url = `${API}/movies/out-of-bubble?session_key=${state.sessionKey}`;
  } else {
    url = `${API}/movies/explore?session_key=${state.sessionKey}&page=${state.page}&limit=24`;
    if (state.maxRuntime) url += `&max_runtime=${state.maxRuntime}`;
  }

  try {
    const movies = await fetch(url).then(r => r.json());
    if (!append) clearGrid();
    if (movies.length === 0 && !append) {
      showEmpty();
    } else {
      hideEmpty();
      movies.forEach(m => appendCard(m));
      const canLoadMore = !state.currentMood && !state.bubbleMode && movies.length >= 24;
      document.getElementById('loadMoreBtn').classList.toggle('hidden', !canLoadMore);
    }
  } catch {
    showToast('Erro ao carregar filmes. Servidor offline?');
    clearGrid(); showEmpty();
  }
  state.loading = false;
}

function loadMore() { state.page++; loadExplore(true); }

// ══════════════════════════════════════════════════════
// FAVORITES
// ══════════════════════════════════════════════════════
async function loadFavorites() {
  showSkeletons();
  try {
    const movies = await fetch(`${API}/movies/favorites?session_key=${state.sessionKey}`).then(r => r.json());
    clearGrid();
    document.getElementById('loadMoreBtn').classList.add('hidden');
    if (movies.length === 0) {
      showEmpty();
      document.getElementById('emptyState').innerHTML =
        `<div class="text-5xl mb-4">💔</div>
         <h3 class="text-lg font-semibold text-text mb-2">Nenhum favorito ainda</h3>
         <p class="text-muted text-sm">Clique no ❤️ nos cards para salvar títulos aqui</p>`;
    } else {
      hideEmpty(); movies.forEach(m => appendCard(m));
    }
  } catch { showToast('Erro ao carregar favoritos.'); }
}

async function updateFavCount() {
  try {
    const movies = await fetch(`${API}/movies/favorites?session_key=${state.sessionKey}`).then(r => r.json());
    movies.forEach(m => state.favorites.add(m.tconst));
    const badge = document.getElementById('favCount');
    badge.textContent = movies.length;
    badge.classList.toggle('hidden', movies.length === 0);
  } catch {}
}

async function toggleFav(tconst, btn) {
  try {
    const data = await fetch(`${API}/movies/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_key: state.sessionKey, tconst }),
    }).then(r => r.json());
    if (data.action === 'added') {
      state.favorites.add(tconst); btn.classList.add('favorited'); btn.textContent = '❤️';
      showToast('Adicionado aos favoritos!');
    } else {
      state.favorites.delete(tconst); btn.classList.remove('favorited'); btn.textContent = '🤍';
      showToast('Removido dos favoritos');
      if (state.view === 'favorites') loadFavorites();
    }
    updateFavCount();
  } catch { showToast('Erro ao atualizar favoritos.'); }
}

// ══════════════════════════════════════════════════════
// LUCKY
// ══════════════════════════════════════════════════════
async function openLucky() {
  const modal   = document.getElementById('luckyModal');
  const content = document.getElementById('luckyContent');
  modal.style.display = 'flex'; modal.classList.remove('hidden');
  content.innerHTML = `<div class="p-6 text-center"><div class="text-4xl mb-3">🎲</div><p class="text-muted text-sm">Lucky Lucky!</p></div>`;

  try {
    let url = `${API}/movies/lucky?session_key=${state.sessionKey}`;
    if (state.maxRuntime) url += `&max_runtime=${state.maxRuntime}`;
    const m     = await fetch(url).then(r => r.json());
    const isFav = state.favorites.has(m.tconst);
    content.innerHTML = `
      <div class="overflow-hidden rounded-2xl">
        <div class="relative" style="height:280px">
          ${m.poster_url
            ? `<img src="${m.poster_url}" alt="${esc(m.title)}" class="poster-img" onerror="this.parentElement.innerHTML='<div class=poster-placeholder>🎬</div>'">`
            : `<div class="poster-placeholder">🎬</div>`}
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          <button onclick="closeLuckyModal()" class="absolute top-3 right-3 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm hover:bg-black/80">✕</button>
          <div class="absolute top-3 left-3">${m.rating ? `<span class="rating-badge">⭐ ${m.rating.toFixed(1)}</span>` : ''}</div>
        </div>
        <div class="p-5 bg-card">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 class="font-bold text-text text-lg leading-tight">${esc(m.title)}</h3>
              <p class="text-muted text-xs mt-0.5">${m.year ?? ''} · ${typeLabel(m.type)}${m.runtime ? ' · '+m.runtime+'min' : ''}</p>
            </div>
            <button id="luckyFavBtn" onclick="toggleFav('${m.tconst}',this)" class="heart-btn text-2xl flex-shrink-0 ${isFav?'favorited':''}">${isFav?'❤️':'🤍'}</button>
          </div>
          <div class="flex flex-wrap gap-1.5 mb-3">
            ${translateGenres(m.genres).map(g=>`<span class="tag-chip text-xs py-0.5 px-2">${g}</span>`).join('')}
          </div>
          ${m.platforms ? `<p class="text-xs text-muted mb-1">📺 ${esc(m.platforms)}</p>` : ''}
          ${m.actors    ? `<p class="text-xs text-muted mb-1">🎭 ${esc(m.actors)}</p>` : ''}
          ${m.directors ? `<p class="text-xs text-muted mb-4">🎬 ${esc(m.directors)}</p>` : ''}
          <button onclick="openLucky()" class="w-full bg-accent hover:bg-accent-dim text-surface font-semibold py-2.5 rounded-lg transition-colors text-sm">🎲 Role outro Dado</button>
        </div>
      </div>`;
  } catch {
    content.innerHTML = `<div class="p-6 text-center"><p class="text-muted mb-4">Erro ao buscar 😔</p><button onclick="closeLuckyModal()" class="text-accent text-sm">Fechar</button></div>`;
  }
}

function closeLuckyModal() {
  const m = document.getElementById('luckyModal');
  m.style.display = 'none'; m.classList.add('hidden');
}

// ══════════════════════════════════════════════════════
// MOOD
// ══════════════════════════════════════════════════════
function buildMoodGrid() {
  document.getElementById('moodGrid').innerHTML = MOODS.map(m => `
    <button onclick="applyMood('${m.id}')" class="bg-card border border-border hover:border-accent rounded-xl p-4 text-left transition-all group">
      <div class="text-2xl mb-1">${m.emoji}</div>
      <div class="text-sm font-medium text-text group-hover:text-accent transition-colors">${m.label}</div>
      <div class="text-xs text-muted mt-1">${m.desc}</div>
    </button>
  `).join('');
}

function openMoodModal() {
  const m = document.getElementById('moodModal');
  m.style.display = 'flex'; m.classList.remove('hidden');
}
function closeMoodModal() {
  const m = document.getElementById('moodModal');
  m.style.display = 'none'; m.classList.add('hidden');
}

function applyMood(moodId) {
  state.currentMood = moodId; state.view = 'explore'; state.bubbleMode = false;
  document.getElementById('bubbleToggle').classList.remove('active');
  closeMoodModal();
  const mood  = MOODS.find(m => m.id === moodId);
  const badge = document.getElementById('moodBadge');
  badge.textContent = `${mood.emoji} ${mood.label}`; badge.classList.remove('hidden');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'explore'));
  setPageTitle('Recomendações por Humor', mood.desc);
  loadExplore();
}

// ══════════════════════════════════════════════════════
// FUNCIONALIDADE B — FORA DA BOLHA
// ══════════════════════════════════════════════════════
function toggleBubble() {
  state.bubbleMode  = !state.bubbleMode;
  state.currentMood = null;
  state.view        = 'explore';
  document.getElementById('bubbleToggle').classList.toggle('active', state.bubbleMode);
  document.getElementById('moodBadge').classList.add('hidden');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'explore'));

  if (state.bubbleMode) {
    setPageTitle('Fora da Bolha 🫧', 'Obras aclamadas fora do seu perfil habitual');
    showToast('Modo Fora da Bolha ativado 🫧');
  } else {
    setPageTitle('Explorar', 'Títulos selecionados para você');
  }
  loadExplore();
}

// ══════════════════════════════════════════════════════
// FUNCIONALIDADE C — FILTRO DE TEMPO
// ══════════════════════════════════════════════════════
function setTimeFilter(btn, minutes) {
  document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));

  if (minutes === null) {
    // "2h+" = sem restrição
    state.maxRuntime = null;
    showToast('Sem limite de duração');
  } else {
    btn.classList.add('active');
    state.maxRuntime = minutes;
    const label = minutes === 30 ? '30 minutos' : minutes === 60 ? '1 hora' : '1h30';
    showToast(`Filtrando títulos até ${label}`);
  }

  // Aplica filtro na view ativa
  if (state.view === 'explore' && !state.currentMood && !state.bubbleMode && !state.groupSession) {
    loadExplore();
  }
}

// ══════════════════════════════════════════════════════
// FUNCIONALIDADE A — SESSÃO EM GRUPO (VOLÁTIL)
// ══════════════════════════════════════════════════════
function openGroupModal() {
  state.groupSize = 2;
  document.getElementById('groupSizeDisplay').textContent = 2;
  document.getElementById('groupStep1').classList.remove('hidden');
  document.getElementById('groupStep2').classList.add('hidden');
  const m = document.getElementById('groupModal');
  m.style.display = 'flex'; m.classList.remove('hidden');
}

function closeGroupModal() {
  const m = document.getElementById('groupModal');
  m.style.display = 'none'; m.classList.add('hidden');
}

function changeGroupSize(delta) {
  const next = state.groupSize + delta;
  if (next < 2 || next > 9) return;
  state.groupSize = next;
  document.getElementById('groupSizeDisplay').textContent = next;
}

function goGroupStep2() {
  document.getElementById('groupStep1').classList.add('hidden');
  document.getElementById('groupStep2').classList.remove('hidden');
  buildPersonBlocks();
}

function buildPersonBlocks() {
  const container = document.getElementById('personBlocks');
  container.innerHTML = '';

  for (let i = 1; i <= state.groupSize; i++) {
    const block = document.createElement('div');
    block.className = 'person-block';
    block.dataset.person = i;
    block.innerHTML = `
      <h3>Pessoa ${i}</h3>

      <!-- Tipo de mídia -->
      <p class="text-xs text-muted uppercase tracking-wider mb-2">Tipo de mídia</p>
      <div class="flex gap-2 mb-4">
        <button class="tag-chip p-ctype flex-1 justify-center" data-person="${i}" data-value="movie">🎬 Filmes</button>
        <button class="tag-chip p-ctype flex-1 justify-center" data-person="${i}" data-value="tvSeries">📺 Séries</button>
        <button class="tag-chip p-ctype flex-1 justify-center selected" data-person="${i}" data-value="both">✨ Ambos</button>
      </div>

      <!-- Gêneros (scrollbox) -->
      <p class="text-xs text-muted uppercase tracking-wider mb-2">Gêneros</p>
      <div class="genre-scrollbox mb-4" id="genreBox${i}">
        ${GENRES.map(g => `
          <div class="genre-scroll-item" data-person="${i}" data-genre="${g.value}" onclick="togglePersonGenre(this)">
            ${g.label}
          </div>
        `).join('')}
      </div>

      <!-- Faixa etária -->
      <label class="styled-checkbox">
        <input type="checkbox" id="adult${i}" checked>
        <div class="check-box">✓</div>
        <span>Maior de idade (18+)</span>
      </label>
    `;
    container.appendChild(block);
  }

  // Bind dos botões de tipo de mídia por pessoa
  document.querySelectorAll('.p-ctype').forEach(btn => {
    btn.addEventListener('click', function () {
      const person = this.dataset.person;
      document.querySelectorAll(`.p-ctype[data-person="${person}"]`).forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
}

function togglePersonGenre(el) {
  el.classList.toggle('selected');
}

async function calcGroupMatch() {
  // ── Aggregação em memória (JS puro, nada vai pro banco) ──
  const genreVotes = {};   // genre → count de pessoas que querem
  let   allowAdult = true;
  const contentTypes = [];

  for (let i = 1; i <= state.groupSize; i++) {
    // Tipo de conteúdo desta pessoa
    const ctypeBtn = document.querySelector(`.p-ctype[data-person="${i}"].selected`);
    if (ctypeBtn) contentTypes.push(ctypeBtn.dataset.value);

    // Gêneros selecionados
    document.querySelectorAll(`#genreBox${i} .genre-scroll-item.selected`).forEach(el => {
      const g = el.dataset.genre;
      genreVotes[g] = (genreVotes[g] || 0) + 1;
    });

    // Regra crítica: 1 menor = bloqueia adulto para todos
    const adultCb = document.getElementById(`adult${i}`);
    if (adultCb && !adultCb.checked) allowAdult = false;
  }

  // Interseção: pega gêneros votados por pelo menos metade do grupo
  const threshold   = Math.max(1, Math.floor(state.groupSize / 2));
  const commonGenres = Object.entries(genreVotes)
    .filter(([, v]) => v >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);

  // Tipo de conteúdo agregado: se todos querem filmes → movie, todos série → tvSeries, else both
  const allMovie  = contentTypes.every(t => t === 'movie');
  const allSeries = contentTypes.every(t => t === 'tvSeries');
  const aggType   = allMovie ? 'movie' : allSeries ? 'tvSeries' : 'both';

  const payload = {
    genres:       commonGenres.length > 0 ? commonGenres : GENRES.map(g => g.value),
    content_type: aggType,
    allow_adult:  allowAdult,
    max_runtime:  state.maxRuntime,
  };

  closeGroupModal();
  showSkeletons();
  state.groupSession = true;
  document.getElementById('groupBanner').classList.remove('hidden');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'explore'));
  setPageTitle('Sessão em Grupo 🎭', `${state.groupSize} pessoas · ${allowAdult ? 'Livre' : 'Classificação Livre (menor presente)'}`);

  try {
    const movies = await fetch(`${API}/movies/group-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json());

    clearGrid();
    document.getElementById('loadMoreBtn').classList.add('hidden');
    if (movies.length === 0) {
      showEmpty();
      showToast('Nenhum match encontrado. Tente ampliar os gêneros!');
    } else {
      hideEmpty();
      movies.forEach(m => appendCard(m));
      showToast(`🎯 ${movies.length} títulos que agradam o grupo!`);
    }
  } catch {
    showToast('Erro ao calcular match. Servidor offline?');
  }
}

function exitGroupSession() {
  state.groupSession = false;
  document.getElementById('groupBanner').classList.add('hidden');
  navigate('explore');
}

// ══════════════════════════════════════════════════════
// CARD
// ══════════════════════════════════════════════════════
function appendCard(m) {
  const isFav  = m.is_favorite || state.favorites.has(m.tconst);
  const genre1 = m.genres ? translateGenres(m.genres)[0] : '';
  const card   = document.createElement('div');
  card.className = 'movie-card bg-card rounded-xl overflow-hidden border border-border group fade-in';
  card.innerHTML = `
    <div class="relative" style="padding-top:150%">
      <div class="absolute inset-0">
        ${m.poster_url
          ? `<img src="${m.poster_url}" alt="${esc(m.title)}" class="poster-img" loading="lazy"
               onerror="this.parentElement.innerHTML='<div class=poster-placeholder>🎬</div>'">`
          : `<div class="poster-placeholder">🎬</div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
      <div class="absolute top-2 left-2">
        ${m.rating ? `<span class="rating-badge">⭐ ${m.rating.toFixed(1)}</span>` : ''}
      </div>
      <button class="heart-btn absolute top-2 right-2 text-xl bg-black/60 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isFav?'favorited':''}"
        onclick="event.stopPropagation(); toggleFav('${m.tconst}', this)">${isFav?'❤️':'🤍'}</button>
      <div class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span class="bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">${typeLabel(m.type)}</span>
      </div>
    </div>
    <div class="p-3">
      <h3 class="font-semibold text-text text-sm leading-tight truncate" title="${esc(m.title)}">${esc(m.title)}</h3>
      <p class="text-muted text-xs mt-0.5">${m.year ?? ''}${genre1 ? ' · '+genre1 : ''}</p>
    </div>`;
  document.getElementById('contentGrid').appendChild(card);
}

// ══════════════════════════════════════════════════════
// HELPERS — TRADUÇÃO
// ══════════════════════════════════════════════════════
function translateGenres(genresStr) {
  if (!genresStr) return [];
  return genresStr.split(',').map(g => GENRE_LABEL[g.trim()] || g.trim());
}

// ══════════════════════════════════════════════════════
// HELPERS — DOM
// ══════════════════════════════════════════════════════
function showSkeletons() {
  clearGrid();
  const grid = document.getElementById('contentGrid');
  for (let i = 0; i < 12; i++) {
    const sk = document.createElement('div');
    sk.className = 'rounded-xl overflow-hidden';
    sk.innerHTML = `
      <div class="skeleton" style="padding-top:150%"></div>
      <div class="p-3 space-y-2">
        <div class="skeleton h-4 rounded w-full"></div>
        <div class="skeleton h-3 rounded w-2/3"></div>
      </div>`;
    grid.appendChild(sk);
  }
}

function clearGrid() { document.getElementById('contentGrid').innerHTML = ''; }
function showEmpty()  { document.getElementById('emptyState').classList.remove('hidden'); }
function hideEmpty()  { document.getElementById('emptyState').classList.add('hidden'); }

function showSurvey() {
  document.getElementById('surveyModal').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}
function hideSurvey() { document.getElementById('surveyModal').classList.add('hidden'); }
function showApp() {
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('surveyModal').classList.add('hidden');
}

function resetProfile() {
  if (!confirm('Isso vai apagar seu perfil e preferências. Continuar?')) return;
  localStorage.removeItem('cm_session');
  location.reload();
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 2800);
}

function typeLabel(type) { return type === 'tvSeries' ? 'Série' : 'Filme'; }
function esc(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════
// EVENTOS GLOBAIS
// ══════════════════════════════════════════════════════
document.getElementById('luckyModal').addEventListener('click', e => { if(e.target===e.currentTarget) closeLuckyModal(); });
document.getElementById('moodModal').addEventListener('click',  e => { if(e.target===e.currentTarget) closeMoodModal(); });
document.getElementById('groupModal').addEventListener('click', e => { if(e.target===e.currentTarget) closeGroupModal(); });

document.addEventListener('DOMContentLoaded', init);
