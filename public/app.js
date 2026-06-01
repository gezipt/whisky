const data = await fetch("/data/whiskies.json").then((response) => response.json());

const select = document.querySelector("#whiskySelect");
const searchInput = document.querySelector("#searchInput");
const limitInput = document.querySelector("#limitInput");
const limitOutput = document.querySelector("#limitOutput");
const weightControls = document.querySelector("#weightControls");
const geoToggle = document.querySelector("#geoToggle");
const enthusiastToggle = document.querySelector("#enthusiastToggle");
const selectedName = document.querySelector("#selectedName");
const selectedTags = document.querySelector("#selectedTags");
const resultsBody = document.querySelector("#resultsBody");

const groupDefaults = {
  color: 0.45,
  nose: 1.3,
  body: 0.75,
  palate: 1.35,
  finish: 1,
};

const featureFrequency = data.features.map((feature) =>
  data.whiskies.reduce((count, whisky) => count + whisky.values[feature.index], 0),
);

const idf = featureFrequency.map((count) => Math.log((data.whiskies.length + 1) / (count + 1)) + 1);
const featureById = new Map(data.features.map((feature) => [feature.id, feature]));
const featureIndexById = new Map(data.features.map((feature) => [feature.id, feature.index]));

const styleDimensions = [
  {
    label: "turf/rook",
    features: [
      ["nose:peat", 1.1],
      ["palate:smoke", 1.25],
      ["finish:smoke", 1.25],
      ["nose:dry", 0.35],
    ],
  },
  {
    label: "zee/zout",
    features: [
      ["nose:sea", 1.2],
      ["palate:salt", 1],
      ["finish:salt", 1],
      ["body:oily", 0.45],
    ],
  },
  {
    label: "sherry/rijk",
    features: [
      ["color:sherry", 0.6],
      ["nose:sherry", 1],
      ["palate:sherry", 1],
      ["nose:rich", 0.6],
      ["body:full", 0.35],
    ],
  },
  {
    label: "zoet/kruidig",
    features: [
      ["nose:sweet", 0.75],
      ["nose:spicy", 0.75],
      ["palate:sweet", 0.9],
      ["palate:spice", 0.9],
      ["finish:sweet", 0.7],
      ["finish:spice", 0.7],
    ],
  },
  {
    label: "licht/fris",
    features: [
      ["nose:fresh", 1],
      ["nose:light", 0.75],
      ["body:light", 0.8],
      ["palate:clean", 0.7],
      ["finish:quick", 0.45],
    ],
  },
  {
    label: "body/textuur",
    features: [
      ["body:full", 0.7],
      ["body:firm", 0.55],
      ["body:oily", 0.75],
      ["palate:big", 0.65],
      ["finish:long", 0.6],
      ["finish:very-long", 0.7],
    ],
  },
];

const state = {
  selectedId: data.whiskies[0].id,
  limit: Number(limitInput.value),
  query: "",
  useGeo: false,
  useEnthusiastProfile: true,
  weights: Object.fromEntries(data.groups.map((group) => [group.key, groupDefaults[group.key] || 1])),
};

function formatTag(id) {
  const feature = featureById.get(id);
  return feature ? `${feature.groupLabel}: ${feature.name}` : id;
}

function haversineKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const lat1 = toRad(a.coordinates.latitude);
  const lat2 = toRad(b.coordinates.latitude);
  const deltaLat = toRad(b.coordinates.latitude - a.coordinates.latitude);
  const deltaLon = toRad(b.coordinates.longitude - a.coordinates.longitude);
  const x =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function hasFeature(whisky, featureId) {
  const index = featureIndexById.get(featureId);
  return index !== undefined && whisky.values[index] === 1;
}

function styleValue(whisky, definitions) {
  let value = 0;
  let max = 0;

  for (const [featureId, weight] of definitions) {
    max += weight;
    if (hasFeature(whisky, featureId)) value += weight;
  }

  return max === 0 ? 0 : value / max;
}

function styleVector(whisky) {
  return styleDimensions.map((dimension) => styleValue(whisky, dimension.features));
}

function cosine(a, b) {
  let dot = 0;
  let lengthA = 0;
  let lengthB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    lengthA += a[index] ** 2;
    lengthB += b[index] ** 2;
  }

  return lengthA === 0 || lengthB === 0 ? 0 : dot / Math.sqrt(lengthA * lengthB);
}

function isIslay(whisky) {
  const { longitude, latitude } = whisky.coordinates;
  return longitude >= -6.6 && longitude <= -5.8 && latitude >= 55.55 && latitude <= 55.95;
}

function baseSimilarity(a, b) {
  let intersection = 0;
  let union = 0;

  for (const feature of data.features) {
    const weight = state.weights[feature.group] * idf[feature.index];
    const av = a.values[feature.index];
    const bv = b.values[feature.index];
    intersection += Math.min(av, bv) * weight;
    union += Math.max(av, bv) * weight;
  }

  return union === 0 ? 0 : intersection / union;
}

function enthusiastSimilarity(a, b) {
  const profileScore = cosine(styleVector(a), styleVector(b));
  const islayScore = isIslay(a) && isIslay(b) ? 1 : 0;
  return profileScore * 0.66 + islayScore * 0.34;
}

function similarity(a, b) {
  let score = baseSimilarity(a, b);

  if (state.useEnthusiastProfile) {
    score = score * 0.62 + enthusiastSimilarity(a, b) * 0.38;
  }

  if (!state.useGeo) return score;

  const geoScore = Math.exp(-haversineKm(a, b) / 140);
  return score * 0.88 + geoScore * 0.12;
}

function matchingStyleLabels(a, b) {
  const aVector = styleVector(a);
  const bVector = styleVector(b);
  return styleDimensions
    .filter((dimension, index) => aVector[index] >= 0.28 && bVector[index] >= 0.28)
    .map((dimension) => `Profiel: ${dimension.label}`);
}

function sharedTags(a, b) {
  return a.tags
    .filter((tag) => b.tags.includes(tag))
    .map(formatTag)
    .slice(0, 8);
}

function renderWeights() {
  weightControls.innerHTML = data.groups
    .map((group) => {
      const value = state.weights[group.key];
      return `
        <label class="weight-row">
          <span>${group.label}</span>
          <input data-weight="${group.key}" type="range" min="0" max="2" step="0.05" value="${value}">
          <output>${value.toFixed(2)}</output>
        </label>
      `;
    })
    .join("");
}

function renderSelect() {
  select.innerHTML = data.whiskies
    .map((whisky) => `<option value="${whisky.id}">${whisky.name}</option>`)
    .join("");
  select.value = state.selectedId;
}

function render() {
  const selected = data.whiskies.find((whisky) => whisky.id === state.selectedId) || data.whiskies[0];
  selectedName.textContent = selected.name;
  selectedTags.innerHTML = selected.tags.map((tag) => `<span>${formatTag(tag)}</span>`).join("");
  limitOutput.textContent = state.limit;

  const query = state.query.trim().toLowerCase();
  const results = data.whiskies
    .filter((whisky) => whisky.id !== selected.id)
    .map((whisky) => ({
      whisky,
      score: similarity(selected, whisky),
      distance: haversineKm(selected, whisky),
      shared: sharedTags(selected, whisky),
      profiles: matchingStyleLabels(selected, whisky),
    }))
    .filter((result) => {
      if (!query) return true;
      const haystack = [result.whisky.name, ...result.shared, ...result.profiles].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, state.limit);

  resultsBody.innerHTML = results
    .map((result) => {
      const pct = Math.round(result.score * 100);
      const tagItems = [...result.profiles, ...result.shared].slice(0, 9);
      const tags = tagItems.length
        ? tagItems.map((tag) => `<span>${tag}</span>`).join("")
        : "<span>Geen exacte overlap in topkenmerken</span>";

      return `
        <tr>
          <td>
            <div class="score">
              <strong>${pct}</strong>
              <div><span style="width: ${pct}%"></span></div>
            </div>
          </td>
          <td>${result.whisky.name}</td>
          <td><div class="tag-list compact">${tags}</div></td>
          <td>${Math.round(result.distance)} km</td>
        </tr>
      `;
    })
    .join("");
}

select.addEventListener("change", (event) => {
  state.selectedId = event.target.value;
  render();
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

limitInput.addEventListener("input", (event) => {
  state.limit = Number(event.target.value);
  render();
});

geoToggle.addEventListener("change", (event) => {
  state.useGeo = event.target.checked;
  render();
});

enthusiastToggle.addEventListener("change", (event) => {
  state.useEnthusiastProfile = event.target.checked;
  render();
});

weightControls.addEventListener("input", (event) => {
  const key = event.target.dataset.weight;
  if (!key) return;
  state.weights[key] = Number(event.target.value);
  event.target.nextElementSibling.textContent = state.weights[key].toFixed(2);
  render();
});

renderWeights();
renderSelect();
render();
