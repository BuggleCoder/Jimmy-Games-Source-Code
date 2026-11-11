
import games from "./games.json" with { type: "json" };

const page = document.getElementById("page-container");
const STORAGE_KEY = "jimmyGamesRecentlyPlayed";
const MAX_RECENT = 5;
const MAX_POPULAR = 3;

let globalCounts = {};
let currentBlobURL = null;

function getGameKey(game) {
  return game.slug || game.url;
}

async function fetchGlobalPlayCounts() {
  try {
    const response = await fetch("/api/play-count");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    alert("Could not load global play counts: " + error.message);
    return {};
  }
}

async function incrementGlobalPlayCount(gameData) {
  try {
    const response = await fetch("/api/play-count", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        gameKey: getGameKey(gameData)
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.counts) {
      globalCounts = data.counts;
    }

    return true;
  } catch (error) {
    alert("Could not update global plays: " + error.message);
    return false;
  }
}

function getMostPopular() {
  return [...games]
    .filter(game => (globalCounts[getGameKey(game)] || 0) > 0)
    .sort((a, b) =>
      (globalCounts[getGameKey(b)] || 0) -
      (globalCounts[getGameKey(a)] || 0)
    )
    .slice(0, MAX_POPULAR);
}

function getRecentlyPlayed() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

    return saved
      .map(key => games.find(game => getGameKey(game) === key))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveRecentlyPlayed(gameData) {
  const key = getGameKey(gameData);

  let recent = getRecentlyPlayed().filter(
    game => getGameKey(game) !== key
  );

  recent.unshift(gameData);
  recent = recent.slice(0, MAX_RECENT);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(recent.map(getGameKey))
    );
  } catch {
    alert("Could not save recently played games.");
  }
}

function createGameButton(gameData, id) {
  const btn = document.createElement("button");

  const key = getGameKey(gameData);
  const plays = globalCounts[key] || 0;

  btn.id = `game-${id}`;
  btn.className = "game-card";
  btn.textContent = `${gameData.name}`;

  btn.addEventListener("click", () => {
    loadGame(gameData);
  });

  return btn;
}

function createSection(title, gamesList, sectionId) {
  if (!gamesList.length) return null;

  const section = document.createElement("section");
  section.className = "game-section";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const menu = document.createElement("div");
  menu.className = "game-grid";

  if (sectionId) {
    menu.id = sectionId;
  }

  gamesList.forEach((game, index) => {
    menu.appendChild(createGameButton(game, `${sectionId || "all"}-${index}`));
  });

  section.append(heading, menu);

  return section;
}

async function createGameButtons() {
  page.innerHTML = "";

  globalCounts = await fetchGlobalPlayCounts();

  const allSection = createSection("All Games", games, "all-games");
  const popularSection = createSection(
    "Most Popular",
    getMostPopular(),
    "popular-games"
  );
  const recentSection = createSection(
    "Recently Played",
    getRecentlyPlayed(),
    "recent-games"
  );

  if (allSection) page.appendChild(allSection);
  if (popularSection) page.appendChild(popularSection);
  if (recentSection) page.appendChild(recentSection);
}

async function loadGame(gameData) {
  page.innerHTML = `
    <div id="loading" style="
      font-family: monospace;
      color: #07f5f5;
      text-align: center;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      letter-spacing: 1px;
    ">
      Loading ${gameData.name}...
    </div>
  `;

  try {
    const response = await fetch(gameData.url);

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    let html = await response.text();

    const baseUrl = new URL(".", gameData.url).href;
    const baseTag = `<base href="${baseUrl}">`;

    if (/<base\s/i.test(html)) {
      html = html.replace(/<base[^>]*>/i, baseTag);
    } else if (/<head[^>]*>/i.test(html)) {
      html = html.replace(
        /<head[^>]*>/i,
        match => match + baseTag
      );
    } else {
      html = baseTag + html;
    }

    const blob = new Blob([html], {
      type: "text/html"
    });

    const blobURL = URL.createObjectURL(blob);

    await incrementGlobalPlayCount(gameData);
    saveRecentlyPlayed(gameData);

    if (currentBlobURL) {
      URL.revokeObjectURL(currentBlobURL);
    }

    currentBlobURL = blobURL;

    page.innerHTML = `
      <button id="back-button" style="
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 10000;
      ">BACK</button>

      <iframe
        id="game-frame"
        sandbox="allow-scripts allow-same-origin allow-downloads"
        style="
          width: 100%;
          height: 100%;
          border: none;
          position: absolute;
          top: 0;
          left: 0;
          background: black;
        "
        src="${blobURL}">
      </iframe>
    `;

    document.getElementById("back-button").addEventListener(
      "click",
      () => {
        if (currentBlobURL) {
          URL.revokeObjectURL(currentBlobURL);
          currentBlobURL = null;
        }

        createGameButtons();
      }
    );

  } catch (error) {
    page.innerHTML = `
      <div style="color: red; font-family: monospace;">
        FAILED TO LOAD ${gameData.name.toUpperCase()}<br>
        ${error.message}
        <br><br>
        <button id="retry-button">RETRY</button>
        <button id="back-button">BACK</button>
      </div>
    `;

    document.getElementById("retry-button").addEventListener(
      "click",
      () => loadGame(gameData)
    );

    document.getElementById("back-button").addEventListener(
      "click",
      createGameButtons
    );
  }
}

createGameButtons();
