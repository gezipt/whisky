# Whisky vergelijker

Een dependency-free JavaScript rebuild van de oude Streamlit whisky-vergelijker.
De app draait als statische frontend achter een kleine Node-server.

## Starten

```bash
node scripts/build-data.mjs
node server.mjs
```

Open daarna `http://127.0.0.1:3000`.

Op een server kun je de host en poort instellen:

```bash
HOST=0.0.0.0 PORT=3000 node server.mjs
```

Als `npm` beschikbaar is, werken dezelfde stappen ook via:

```bash
npm run build:data
npm start
```

## Podman

Build de container image:

```bash
podman build -t whisky-vergelijker .
```

Draai de app:

```bash
podman run --rm -p 3000:3000 whisky-vergelijker
```

Open daarna `http://localhost:3000`.

## Model

De originele app gebruikte cosine similarity op de vooraf berekende matrix.
Deze versie berekent de score in de browser met gewogen Jaccard/Tanimoto:

- geschikt voor sparse binaire descriptoren;
- IDF-weging maakt zeldzame smaakkenmerken belangrijker;
- sliders laten kleur, neus, body, smaak en afdronk zwaarder of lichter meetellen;
- het liefhebbersprofiel herkent bredere stijloverlap, zoals turf/rook, zee/zout,
  sherry/rijk, zoet/kruidig, licht/fris en body/textuur;
- Islay-whisky's krijgen in dat profiel een kleine extra affiniteit;
- geografie kan licht worden meegewogen via afstand tussen distilleerderijen.

De brondata blijft in `Data/`; `scripts/build-data.mjs` zet die om naar
`public/data/whiskies.json`.
