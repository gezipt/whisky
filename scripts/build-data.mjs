import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = new URL("../", import.meta.url).pathname;

const nameCorrections = new Map([
  ["Ardberg", "Ardbeg"],
]);

const groups = [
  {
    key: "color",
    label: "Kleur",
    file: "Data/color109x14",
    features: ["wine", "yellow", "very pale", "pale", "pale gold", "gold", "old gold", "full gold", "bronze", "pale amber", "amber", "full amber", "red", "sherry"],
  },
  {
    key: "nose",
    label: "Neus",
    file: "Data/nose109x12",
    features: ["aroma", "peat", "sweet", "light", "fresh", "dry", "fruit", "grass", "sea", "sherry", "spicy", "rich"],
  },
  {
    key: "body",
    label: "Body",
    file: "Data/body09x8",
    features: ["soft", "medium", "full", "round", "smooth", "light", "firm", "oily"],
  },
  {
    key: "palate",
    label: "Smaak",
    file: "Data/palate109x15",
    features: ["full", "dry", "sherry", "big", "light", "smooth", "clean", "fruit", "grass", "smoke", "sweet", "spice", "oil", "salt", "aroma"],
  },
  {
    key: "finish",
    label: "Afdronk",
    file: "Data/finish109x19",
    features: ["full", "dry", "warm", "big", "light", "smooth", "clean", "fruit", "grass", "smoke", "sweet", "spice", "oil", "salt", "aroma", "lingering", "long", "very long", "quick"],
  },
];

function parseMatrix(text, expectedColumns) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((row) => row.every(Number.isFinite));

  const headerless = rows[0]?.length === 2 && rows[0][1] === expectedColumns ? rows.slice(1) : rows;
  return headerless;
}

function parseCoordinates(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/))
    .filter(Boolean)
    .map((match) => ({
      name: match[1].replace(/\s+/g, " ").trim(),
      longitudeWest: Number(match[2]),
      latitudeNorth: Number(match[3]),
    }));
}

const coordinates = parseCoordinates(await readFile(join(root, "Data/Distillery coordinates"), "utf8"));
if (coordinates.length !== 109) {
  throw new Error(`Expected 109 distilleries, found ${coordinates.length}`);
}

const matrices = [];
for (const group of groups) {
  const matrix = parseMatrix(await readFile(join(root, group.file), "utf8"), group.features.length);
  if (matrix.length !== coordinates.length) {
    throw new Error(`${group.key}: expected ${coordinates.length} rows, found ${matrix.length}`);
  }
  matrices.push(matrix);
}

const features = groups.flatMap((group, groupIndex) =>
  group.features.map((name, offset) => ({
    id: `${group.key}:${name.replaceAll(" ", "-")}`,
    name,
    group: group.key,
    groupLabel: group.label,
    index: groups.slice(0, groupIndex).reduce((sum, item) => sum + item.features.length, 0) + offset,
  })),
);

const whiskies = coordinates.map((coordinate, rowIndex) => {
  const name = nameCorrections.get(coordinate.name) || coordinate.name;
  const values = matrices.flatMap((matrix) => matrix[rowIndex]);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    coordinates: {
      longitude: -coordinate.longitudeWest,
      latitude: coordinate.latitudeNorth,
    },
    values,
    tags: features.filter((feature) => values[feature.index] === 1).map((feature) => feature.id),
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  source: "Lapointe and Legendre Scotch whisky descriptors, 109 distilleries",
  groups: groups.map(({ key, label, features }) => ({ key, label, features })),
  features,
  whiskies,
};

const target = join(root, "public/data/whiskies.json");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${whiskies.length} whiskies and ${features.length} features to ${target}`);
