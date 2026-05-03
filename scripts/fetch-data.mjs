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

function responseCount(payload) {
  const response = payload?.response || payload?.events || payload?.games || payload?.data || [];
  return Array.isArray(response) ? response.length : Object.keys(response || {}).length;
}

function isoDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function fetchSportsJson(url, headers = {}) {
  const payload = await fetchJson(url, headers);

  if (!url || responseCount(payload) > 0 || !/[?&]date=\d{4}-\d{2}-\d{2}/.test(url)) {
    return payload;
  }

  for (let daysAgo = 1; daysAgo <= 10; daysAgo += 1) {
    const fallbackUrl = url.replace(/([?&]date=)\d{4}-\d{2}-\d{2}/, `$1${isoDateDaysAgo(daysAgo)}`);
    const fallbackPayload = await fetchJson(fallbackUrl, headers);

    if (responseCount(fallbackPayload) > 0) {
      fallbackPayload.fallbackDate = isoDateDaysAgo(daysAgo);
      return fallbackPayload;
    }
  }

  return payload;
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

function normalizeSports(...payloads) {
  const activePayloads = payloads.filter(Boolean);

  if (!activePayloads.length) {
    return {
      updatedAt: new Date().toISOString(),
      message: "No sports API URLs are configured.",
      games: []
    };
  }

  const games = activePayloads.flatMap((payload) => {
    const rawGames =
    payload.events ||
    payload.response ||
    payload.games ||
    payload.data ||
    [];

    return (Array.isArray(rawGames) ? rawGames : Object.values(rawGames))
    .slice(0, 7)
    .map((game) => {
      const competition = game.competitions?.[0] || {};
      const competitors = competition.competitors || [];
      const home = competitors.find((team) => team.homeAway === "home") || game.home || game.teams?.home || competitors[0] || {};
      const away = competitors.find((team) => team.homeAway === "away") || game.away || game.teams?.away || competitors[1] || {};
      const visitors = game.teams?.visitors || {};
      const firstFighter = game.fighters?.first || {};
      const secondFighter = game.fighters?.second || {};

      return {
        league: payload.feedName === "NBA" ? "NBA" : game.slug || game.league?.name || game.league || game.sport_key || payload.feedName || "Sports",
        status: game.status?.type?.description || game.status?.long || game.status || game.strStatus || "",
        startTime: game.date?.start || game.date || game.commence_time || game.fixture?.date || game.gameTime || game.fallbackDate || "",
        homeTeam: home.team?.displayName || home.team?.name || home.name || home.displayName || firstFighter.name || game.home_team || game.teams?.home?.name || "",
        awayTeam: away.team?.displayName || away.team?.name || away.name || away.displayName || secondFighter.name || game.away_team || visitors.name || "",
        homeScore: firstFighter.winner === true ? "W" : firstFighter.winner === false ? "L" : home.score ?? game.scores?.home?.points ?? game.goals?.home ?? game.home_score ?? "",
        awayScore: secondFighter.winner === true ? "W" : secondFighter.winner === false ? "L" : away.score ?? game.scores?.visitors?.points ?? game.scores?.away?.points ?? game.goals?.away ?? game.away_score ?? ""
      };
    });
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

  const sportsPayload = await fetchSportsJson(
    env("SPORTS_API_URL"),
    authHeaders("SPORTS", "x-apisports-key")
  );

  if (sportsPayload) {
    sportsPayload.feedName = "MMA";
  }

  const nbaPayload = await fetchSportsJson(
    env("NBA_API_URL"),
    authHeaders("NBA", "x-apisports-key")
  );

  if (nbaPayload) {
    nbaPayload.feedName = "NBA";
  }

  await writeFile(new URL("crypto.json", outputDir), `${JSON.stringify(normalizeCrypto(cryptoPayload), null, 2)}\n`);
  await writeFile(new URL("sports.json", outputDir), `${JSON.stringify(normalizeSports(sportsPayload, nbaPayload), null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
