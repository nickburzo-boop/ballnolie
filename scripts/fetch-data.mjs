import { mkdir, writeFile } from "node:fs/promises";

const outputDir = new URL("../data/", import.meta.url);

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

async function fetchJson(url, headers = {}) {
  if (!url) {
    return null;
  }

  const response = await fetch(url, { headers });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text.slice(0, 160)}`);
  }

  return JSON.parse(text);
}

function normalizeCrypto(payload) {
  if (!payload) {
    return {
      updatedAt: new Date().toISOString(),
      message: "CRYPTO_API_URL is not configured.",
      assets: []
    };
  }

  const rawAssets =
    payload.data?.cryptoCurrencyList ||
    payload.data?.coins ||
    payload.data ||
    payload.assets ||
    payload.coins ||
    [];

  const assets = (Array.isArray(rawAssets) ? rawAssets : Object.values(rawAssets))
    .slice(0, 8)
    .map((asset) => {
      const quote = asset.quotes?.[0] || asset.quote?.USD || asset.quote || {};
      const priceUsd = asset.priceUsd ?? asset.price_usd ?? asset.current_price ?? quote.price;
      const change24h =
        asset.change24h ??
        asset.percent_change_24h ??
        asset.price_change_percentage_24h ??
        quote.percentChange24h ??
        quote.percent_change_24h;

      return {
        name: asset.name || asset.fullName || asset.slug || asset.symbol,
        symbol: asset.symbol || asset.ticker || "",
        priceUsd: Number(priceUsd || 0),
        change24h: Number(change24h || 0)
      };
    });

  return {
    updatedAt: new Date().toISOString(),
    assets
  };
}

function normalizeSports(payload) {
  if (!payload) {
    return {
      updatedAt: new Date().toISOString(),
      message: "SPORTS_API_URL is not configured.",
      games: []
    };
  }

  const rawGames =
    payload.events ||
    payload.response ||
    payload.games ||
    payload.data ||
    [];

  const games = (Array.isArray(rawGames) ? rawGames : Object.values(rawGames))
    .slice(0, 10)
    .map((game) => {
      const competition = game.competitions?.[0] || {};
      const competitors = competition.competitors || [];
      const home = competitors.find((team) => team.homeAway === "home") || game.home || game.teams?.home || competitors[0] || {};
      const away = competitors.find((team) => team.homeAway === "away") || game.away || game.teams?.away || competitors[1] || {};

      return {
        league: game.league?.name || game.league || game.sport_key || "Sports",
        status: game.status?.type?.description || game.status?.long || game.status || game.strStatus || "",
        startTime: game.date || game.commence_time || game.fixture?.date || game.gameTime || "",
        homeTeam: home.team?.displayName || home.team?.name || home.name || home.displayName || game.home_team || game.teams?.home?.name || "",
        awayTeam: away.team?.displayName || away.team?.name || away.name || away.displayName || game.away_team || game.teams?.away?.name || "",
        homeScore: home.score ?? game.scores?.home ?? game.goals?.home ?? game.home_score ?? "",
        awayScore: away.score ?? game.scores?.away ?? game.goals?.away ?? game.away_score ?? ""
      };
    });

  return {
    updatedAt: new Date().toISOString(),
    games
  };
}

function authHeaders(prefix, defaultHeaderName) {
  const key = env(`${prefix}_API_KEY`);
  const headerName = env(`${prefix}_API_HEADER`, defaultHeaderName);

  return key ? { [headerName]: key } : {};
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const cryptoPayload = await fetchJson(
    env("CRYPTO_API_URL"),
    authHeaders("CRYPTO", "X-CMC_PRO_API_KEY")
  );

  const sportsPayload = await fetchJson(
    env("SPORTS_API_URL"),
    authHeaders("SPORTS", "x-apisports-key")
  );

  await writeFile(new URL("crypto.json", outputDir), `${JSON.stringify(normalizeCrypto(cryptoPayload), null, 2)}\n`);
  await writeFile(new URL("sports.json", outputDir), `${JSON.stringify(normalizeSports(sportsPayload), null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
