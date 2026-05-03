const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero"
});

const cryptoList = document.querySelector("#crypto-list");
const sportsList = document.querySelector("#sports-list");
const cryptoStatus = document.querySelector("#crypto-status");
const sportsStatus = document.querySelector("#sports-status");
const updated = document.querySelector("#updated");

function setStatus(element, text) {
  element.textContent = text;
}

function showEmpty(target, text) {
  target.innerHTML = `<p class="empty">${text}</p>`;
}

function renderUpdatedAt(records) {
  const newest = records
    .map((record) => record.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  updated.textContent = newest
    ? `Updated ${new Date(newest).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
    : "Waiting for data";
}

function renderCrypto(data) {
  const assets = Array.isArray(data.assets) ? data.assets : [];
  setStatus(cryptoStatus, assets.length ? `${assets.length} assets` : "No data");

  if (!assets.length) {
    showEmpty(cryptoList, data.message || "No crypto prices available yet.");
    return;
  }

  cryptoList.innerHTML = assets.map((asset) => {
    const change = Number(asset.change24h || 0);
    const direction = change >= 0 ? "positive" : "negative";

    return `
      <div class="asset">
        <div class="row-main">
          <div>
            <p class="name">${asset.name || asset.symbol || "Asset"}</p>
            <p class="symbol">${asset.symbol || ""}</p>
          </div>
          <p class="price">${money.format(Number(asset.priceUsd || 0))}</p>
        </div>
        <p class="change ${direction}">${percent.format(change)}% 24h</p>
      </div>
    `;
  }).join("");
}

function renderSports(data) {
  const games = Array.isArray(data.games) ? data.games : [];
  setStatus(sportsStatus, games.length ? `${games.length} games` : "No games");

  if (!games.length) {
    showEmpty(sportsList, data.message || "No games available yet.");
    return;
  }

  sportsList.innerHTML = games.map((game) => `
    <div class="match">
      <div class="match-teams">
        <div class="team-line">
          <p class="team">${game.awayTeam || "Away"}</p>
          <p class="team">${game.homeTeam || "Home"}</p>
        </div>
        <div class="team-line">
          <p class="score">${game.awayScore ?? "-"}</p>
          <p class="score">${game.homeScore ?? "-"}</p>
        </div>
      </div>
      <p class="meta">${[game.league, game.status, game.startTime].filter(Boolean).join(" | ")}</p>
    </div>
  `).join("");
}

async function readJson(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }

  return response.json();
}

async function boot() {
  try {
    const [crypto, sports] = await Promise.all([
      readJson("data/crypto.json"),
      readJson("data/sports.json")
    ]);

    renderCrypto(crypto);
    renderSports(sports);
    renderUpdatedAt([crypto, sports]);
  } catch (error) {
    console.error(error);
    setStatus(cryptoStatus, "Offline");
    setStatus(sportsStatus, "Offline");
    showEmpty(cryptoList, "Data files are not available yet.");
    showEmpty(sportsList, "Data files are not available yet.");
    updated.textContent = "Data unavailable";
  }
}

boot();
