# Ifrane offline basemap

`ifrane.pmtiles` is an extract of the Protomaps Basemap daily build dated
2026-09-25, from `https://build.protomaps.com/20260925.pmtiles`.

Extraction command:

```sh
pmtiles extract https://build.protomaps.com/20260925.pmtiles ifrane.pmtiles --bbox=-5.9,32.95,-4.6,34.1 --maxzoom=14
```

The basemap is an Open Database License Produced Work derived from OpenStreetMap.
Display attribution: **© OpenStreetMap contributors · Protomaps**.

The bundled font PBFs and sprite sheets come from
https://github.com/protomaps/basemaps-assets (Noto Sans font license in
`fonts/OFL.txt`). The map archive is deliberately bounded to Ifrane Province
and nearby areas. NASA GIBS imagery is requested online and is not part of
the offline package.
