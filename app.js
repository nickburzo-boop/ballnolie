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
const locationConsent = document.querySelector("#location-consent");
const locationAllow = document.querySelector("#location-allow");
const locationSkip = document.querySelector("#location-skip");
const forumForm = document.querySelector("#forum-form");
const forumName = document.querySelector("#forum-name");
const forumMessage = document.querySelector("#forum-message");
const forumList = document.querySelector("#forum-list");
const forumStatus = document.querySelector("#forum-status");
const quakeForm = document.querySelector("#quake-form");
const quakeDays = document.querySelector("#quake-days");
const quakeMinMag = document.querySelector("#quake-minmag");
const quakeOrder = document.querySelector("#quake-order");
const quakeLatitude = document.querySelector("#quake-latitude");
const quakeLongitude = document.querySelector("#quake-longitude");
const quakeRadius = document.querySelector("#quake-radius");
const quakeLocate = document.querySelector("#quake-locate");
const quakeList = document.querySelector("#quake-list");
const quakeStatus = document.querySelector("#quake-status");

const supabaseUrl = "https://negyqhvbbfoekrnxlmrk.supabase.co";
const supabaseKey = "sb_publishable_EuQa1qmL66Rqbifu7gfQqw_Ttc2D5GK";
const forumEndpoint = `${supabaseUrl}/rest/v1/forum_posts`;
const usgsEndpoint = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const locationCookieName = "mastanicks_quake_location";
const unitedStatesBounds = {
  minlatitude: "18",
  maxlatitude: "72",
  minlongitude: "-179",
  maxlongitude: "-65"
};

function setStatus(element, text) {
  element.textContent = text;
}

function showEmpty(target, text) {
  target.innerHTML = `<p class="empty">${text}</p>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax; Secure`;
}

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

function readSavedLocation() {
  const raw = getCookie(locationCookieName);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch {
    return null;
  }
}

function saveLocation(latitude, longitude) {
  setCookie(locationCookieName, JSON.stringify({ latitude, longitude }), 180);
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

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${forumEndpoint}${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Supabase returned ${response.status}`);
  }

  return text ? JSON.parse(text) : null;
}

function renderForumPosts(posts) {
  if (!posts.length) {
    showEmpty(forumList, "No posts yet. Be first at the table.");
    return;
  }

  forumList.innerHTML = posts.map((post) => `
    <article class="forum-post">
      <div class="row-main">
        <p class="name">${escapeHtml(post.name)}</p>
        <p class="meta">${new Date(post.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
      </div>
      <p class="forum-message">${escapeHtml(post.message)}</p>
    </article>
  `).join("");
}

async function loadForumPosts() {
  try {
    setStatus(forumStatus, "Loading");
    const posts = await supabaseRequest("?select=id,name,message,created_at&order=created_at.desc&limit=20");
    renderForumPosts(posts);
    setStatus(forumStatus, `${posts.length} posts`);
  } catch (error) {
    console.error(error);
    setStatus(forumStatus, "Setup needed");
    showEmpty(forumList, "Create the Supabase forum_posts table to open the forum.");
  }
}

async function submitForumPost(event) {
  event.preventDefault();

  const name = forumName.value.trim();
  const message = forumMessage.value.trim();

  if (!name || !message) {
    return;
  }

  try {
    setStatus(forumStatus, "Posting");
    await supabaseRequest("", {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ name, message })
    });
    localStorage.setItem("forumName", name);
    forumMessage.value = "";
    await loadForumPosts();
  } catch (error) {
    console.error(error);
    setStatus(forumStatus, "Post failed");
  }
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Number(days));
  return date.toISOString();
}

function hasLocationFilter() {
  return quakeLatitude.value.trim() !== "" || quakeLongitude.value.trim() !== "";
}

function isValidLocationFilter() {
  const latitude = Number(quakeLatitude.value);
  const longitude = Number(quakeLongitude.value);
  const radius = Number(quakeRadius.value);

  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(radius) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    radius > 0 &&
    radius <= 20001.6;
}

function applyLocation(latitude, longitude) {
  quakeLatitude.value = Number(latitude).toFixed(4);
  quakeLongitude.value = Number(longitude).toFixed(4);
  quakeRadius.value = quakeRadius.value || "500";
  saveLocation(quakeLatitude.value, quakeLongitude.value);
}

function renderQuakes(features) {
  if (!features.length) {
    showEmpty(quakeList, "No earthquakes matched that search.");
    return;
  }

  quakeList.innerHTML = features.map((feature) => {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [];
    const magnitude = Number(props.mag || 0).toFixed(1);
    const depth = Number(coords[2] || 0).toFixed(1);
    const place = props.place || "Unknown location";
    const time = props.time ? new Date(props.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
    const detailUrl = props.url || "#";

    return `
      <article class="quake-card">
        <div class="quake-main">
          <p class="quake-mag">M ${escapeHtml(magnitude)}</p>
          <div>
            <p class="name">${escapeHtml(place)}</p>
            <p class="meta">${escapeHtml(time)} | ${escapeHtml(depth)} km deep</p>
          </div>
        </div>
        <a class="quake-link" href="${escapeHtml(detailUrl)}" target="_blank" rel="noreferrer">USGS</a>
      </article>
    `;
  }).join("");
}

async function loadEarthquakes(event) {
  event?.preventDefault();

  const params = new URLSearchParams({
    format: "geojson",
    eventtype: "earthquake",
    starttime: isoDaysAgo(quakeDays.value),
    endtime: new Date().toISOString(),
    minmagnitude: quakeMinMag.value || "0",
    orderby: quakeOrder.value,
    limit: "12"
  });

  if (hasLocationFilter()) {
    if (!isValidLocationFilter()) {
      setStatus(quakeStatus, "Check location");
      showEmpty(quakeList, "Enter both latitude and longitude with a radius between 1 and 20001.6 km.");
      return;
    }

    params.set("latitude", quakeLatitude.value);
    params.set("longitude", quakeLongitude.value);
    params.set("maxradiuskm", quakeRadius.value || "500");
  } else {
    Object.entries(unitedStatesBounds).forEach(([key, value]) => {
      params.set(key, value);
    });
  }

  try {
    setStatus(quakeStatus, "Searching");
    showEmpty(quakeList, "Reading the USGS table.");
    const response = await fetch(`${usgsEndpoint}?${params.toString()}`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`USGS returned ${response.status}`);
    }

    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    renderQuakes(features);
    setStatus(quakeStatus, `${features.length} events`);
  } catch (error) {
    console.error(error);
    setStatus(quakeStatus, "Search failed");
    showEmpty(quakeList, "The USGS search did not respond. Try again in a moment.");
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    setStatus(quakeStatus, "No location");
    showEmpty(quakeList, "This browser does not support location lookup.");
    return;
  }

  setStatus(quakeStatus, "Locating");
  quakeLocate.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      quakeLocate.disabled = false;
      locationConsent.hidden = true;
      applyLocation(position.coords.latitude, position.coords.longitude);
      loadEarthquakes();
    },
    (error) => {
      quakeLocate.disabled = false;
      const message = error.code === error.PERMISSION_DENIED
        ? "Location access was blocked. Check the browser site permissions, or enter latitude and longitude manually."
        : "The browser could not determine location. You can enter latitude and longitude manually.";
      setStatus(quakeStatus, "Location blocked");
      showEmpty(quakeList, message);
    },
    {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 10000
    }
  );
}

function showLocationConsent() {
  if (readSavedLocation() || localStorage.getItem("locationConsentSkipped") === "true") {
    return;
  }

  locationConsent.hidden = false;
}

function hydrateSavedLocation() {
  const saved = readSavedLocation();

  if (!saved) {
    return;
  }

  quakeLatitude.value = saved.latitude.toFixed(4);
  quakeLongitude.value = saved.longitude.toFixed(4);
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

forumName.value = localStorage.getItem("forumName") || "";
hydrateSavedLocation();
showLocationConsent();
forumForm.addEventListener("submit", submitForumPost);
quakeForm.addEventListener("submit", loadEarthquakes);
quakeLocate.addEventListener("click", useCurrentLocation);
locationAllow.addEventListener("click", useCurrentLocation);
locationSkip.addEventListener("click", () => {
  localStorage.setItem("locationConsentSkipped", "true");
  locationConsent.hidden = true;
});

boot();
loadForumPosts();
loadEarthquakes();
