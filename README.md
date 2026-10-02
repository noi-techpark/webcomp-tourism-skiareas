<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: CC0-1.0
-->

# Generic Map to show Open Data Hub Skiarea Information

[![REUSE Compliance](https://github.com/noi-techpark/webcomp-tourism-skiareas/actions/workflows/reuse.yml/badge.svg)](https://github.com/noi-techpark/odh-docs/wiki/REUSE#badges)
[![REUSE status](https://api.reuse.software/badge/github.com/noi-techpark/webcomp-tourism-skiareas)](https://api.reuse.software/info/github.com/noi-techpark/webcomp-tourism-skiareas)
[![CI/CD](https://github.com/noi-techpark/webcomp-tourism-skiareas/actions/workflows/main.yml/badge.svg)](https://github.com/noi-techpark/webcomp-tourism-skiareas/actions/workflows/main.yml)

This project is a rewrite taken from the repository webcomp-generic-map (thanks
to pmoser). It is a webcomponent to display data from the [Open Data
Hub](https://opendatahub.com).

The Open Data Hub Team wants to generate reusable and independent visualization
components to display data from the Open Data Hub easily. Using these
webcomponents, a developer can easily integrate the functionality of the single
components into any website.

Map that displays ski areas, lifts and slopes from the Open Data Hub
tourism API (`ODHActivityPoi` and `SkiArea` endpoints).

Do you want to see it in action? Go to our [web component
store](https://webcomponents.opendatahub.com/webcomponent/8282479b-dc13-5012-939f-7a0196348dca)!

- [Generic Map to show Open Data Hub Skiarea Information](#generic-map-to-show-open-data-hub-skiarea-information)
  - [Usage](#usage)
    - [Attributes](#attributes)
      - [types](#types)
      - [source](#source)
      - [language](#language)
      - [centermap](#centermap)
  - [What is shown on the map](#what-is-shown-on-the-map)
    - [Ski areas](#ski-areas)
    - [Lifts](#lifts)
    - [Slopes](#slopes)
    - [Loading of tracks (KML/GPX)](#loading-of-tracks-kmlgpx)
    - [Colours](#colours)
  - [GPS data filtering](#gps-data-filtering)
  - [Getting started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Source code](#source-code)
    - [Dependencies](#dependencies)
    - [Build](#build)
  - [Deployment](#deployment)
  - [Docker environment](#docker-environment)
    - [Installation](#installation)
    - [Dependenices](#dependenices)
    - [Start and stop the containers](#start-and-stop-the-containers)
    - [Running commands inside the container](#running-commands-inside-the-container)
  - [Information](#information)
    - [Support](#support)
    - [Contributing](#contributing)
    - [Documentation](#documentation)
    - [Boilerplate](#boilerplate)
    - [License](#license)

## Usage

Include the Javascript file `dist/map_widget.min.js` in your HTML and define the web component like this:

```html
<map-widget types="slopes,lifts" source="dss" language="de" centermap=""></map-widget>
```

### Attributes

#### types

Type: multiselect (comma separated)
Options: "slopes", "lifts", default "slopes,lifts" (passed as `tagfilter` to the ODHActivityPoi endpoint)

The old bitmask values `256` (slopes), `512` (lifts) and `768` (both) are still accepted.

#### source

Type: multiselect (comma separated)
Options: "lts", "dss", "discoverswiss", default "dss"
Data provider for slopes, lifts and ski areas:

| source | slopes and lifts | ski areas |
|---|---|---|
| lts | lts | all idm ski areas |
| dss | dss | dss ski areas and the idm ski areas of the ski region Dolomiti Superski |
| discoverswiss | discoverswiss | discoverswiss |

The mapping is defined in `DATA_PROVIDERS` in `packages/map_widget/map_widget.js`.

The web component store ignores the default of a multiselect and passes an empty
value when nothing is selected. An empty or missing `types` / `source` therefore
falls back to the defaults defined in the code (`DEFAULT_TYPES`, `DEFAULT_SOURCES`).

#### language

Type: string
Options: "de,it,en"

Used for the texts from the API (titles, descriptions, categories) and for the
labels of the widget itself (open/closed, station and lift types, see
`packages/map_widget/i18n.js`). Fallback is English.

#### centermap

Type: string
Options: "latitude,longitude,zoomlevel"
Pass latitude, longitude and zoomlevel separated by "," if map should be centered an a specific gps point

## What is shown on the map

### Ski areas

Every ski area is shown as a round teal badge with a mountain symbol at its
centre (`Latitude`/`Longitude` of the `SkiArea` record). The popup shows the ski
region, the season dates and the description.

If the ski area has an outline (`Geo.track`, a WKT `LINESTRING` /
`MULTILINESTRING`), it is drawn as a lightly filled teal area while the popup of
the ski area is open, and removed again when the popup is closed. Ski areas
without `Latitude`/`Longitude` (or with `0,0`, as DSS ski areas) are placed in
the centre of their outline. Ski areas with neither position nor outline are not
shown.

### Lifts

Lifts are drawn as straight lines between their stations (valley, middle and
mountain station from `GpsInfo`), for all data providers. Open lifts are drawn as
solid dark teal lines, closed lifts as dashed grey lines.

The station points are shown as small dots from zoom level 13 on
(`stationMinZoom`). Below that only the lines are drawn. Stations are not
clustered, because a cluster would detach them from their lift line.

If a lift has a detailed track (e.g. DSS lifts provide a KML file), the track is
loaded the first time the line or a station is hovered or clicked. Once loaded,
the real track replaces the straight line. See
[Loading of tracks](#loading-of-tracks-kmlgpx).

The lift type (chairlift with number of seats, ski lift, gondola, cable car,
funicular, ...) is read from `TagIds`, with the LTS `SmgTags` as fallback. Lifts
without a known type get a generic lift icon.

### Slopes

Every slope is shown as a small icon (skier on a disc in the piste colour) at its
start point: `startingpoint` from `GpsInfo`, or `position` if there is no start
point (DSS slopes). Like lift stations, slope icons are shown from zoom level 13
on.

The slope track is **not** loaded on startup. It is loaded the first time the
slope icon is hovered or clicked, and then drawn in the piste colour. Slopes
without a track (currently all LTS slopes) stay a single icon.

Slopes without any usable GPS point cannot be shown.

### Loading of tracks (KML/GPX)

Loading all tracks at once (more than 1000 KML files) gets the requests blocked
by the track provider, so tracks are only loaded on demand:

- a track is requested on the first hover or click on its slope icon, lift line
  or lift station, and only once
- at most 6 requests run at the same time (`fetchMaxParallel`), further requests
  are queued
- a response that contains no KML track (e.g. an HTML error page of a blocked
  request) is logged to the console and ignored, the straight line or icon stays

KML files can be loaded directly from the provider or through the Open Data Hub
proxy. This is switched in the code in `packages/map_widget/api/config.js`:

```js
USE_KML_PROXY: false,
KML_PROXY: 'https://images.opendatahub.testingmachine.eu/api/ODHProxyCustomCached/kml/'
```

The proxy is currently switched off because dolomitisuperski.com (Cloudflare)
blocks it and the proxy returns the Cloudflare error page instead of the KML.
Set `USE_KML_PROXY` back to `true` once the proxy works again. Loading directly
only works if the provider allows cross-origin requests (CORS).

### Colours

All colours are defined in one palette in `packages/map_widget/colors.js`. Lines
use the values directly, markers and popups get them as CSS custom properties
(`--color-*`).

| Element | Colour |
|---|---|
| Lifts, lift stations | dark teal, closed: grey dashed |
| Ski areas | teal |
| Slopes easy / medium / difficult (`Ratings.Difficulty` 2 / 4 / 6) | blue / red / black |
| Slopes without difficulty (currently all LTS slopes) | grey |
| Status open / closed | green / grey |

## GPS data filtering

Some records in the source data contain wrong GPS points. They are filtered out
before drawing, so they do not produce misleading lines across the map
(`isUsableGps` in `packages/map_widget/map_widget.js`). A point is skipped if:

- **it is a known placeholder coordinate.** Some lift stations (LTS and DSS) were
  never geocoded and carry a default coordinate instead, which drew straight lines
  of 8 up to 270 km:

  | Placeholder | Location | Example lifts |
  |---|---|---|
  | 46.5742, 11.6739 | St. Ulrich / Ortisei centre | Pobist, Raut, Waldheim, Erschbaum, Hawaii, Gaisjoch, Sonne, Absam-Maierl, Campo Scuola Gardoné, Pralongiá II, Risaccia 1, Città dei Sassi |
  | 47.3688, 8.5375 | Zurich centre | Maria, Val Setus |

  The list is maintained in `isPlaceholderGps`, remove entries once the source
  data has been corrected.
- **its coordinates are not numbers.** The API sometimes sends e.g.
  `"Latitude": "NaN"` (DSS lift `dss_491` Koenig Laurin 1).
- **it is more than 200 km from the centre of South Tyrol**, only if the optional
  attribute `checkgpspoints="true"` is set. This check is not offered in the web
  component store because it would hide all discoverswiss data.

A lift with only one usable station is shown as a single station without line.
Ski areas with invalid coordinates are skipped as well. If a single record still
fails to draw, it is logged to the console (`could not draw <Id>`) and skipped,
the rest of the map is drawn anyway.


## Getting started

These instructions will get you a copy of the project up and running
on your local machine for development and testing purposes.

### Prerequisites

To build the project, the following prerequisites must be met:

- Node 16 / NPM 8 (see `.nvmrc`)

For a ready to use Docker environment with all prerequisites already installed and prepared, you can check out the [Docker environment](#docker-environment) section.

### Source code

Get a copy of the repository:

```bash
git clone https://github.com/noi-techpark/webcomp-tourism-skiareas
```

Change directory:

```bash
cd  webcomp-tourism-skiareas/
```

### Dependencies

Download all dependencies:

```bash
npm install
```

### Environment

Copy .env.example to .env and set all needed Environment Variables.

### Build

Build and start the project:

```bash
npm run watch
```

The application will be served and can be accessed at [http://localhost:8080](http://localhost:8080).

## Deployment

To create the distributable files, execute the following command:

```bash
npm run build
```

## Docker environment

For the project a Docker environment is already prepared and ready to use with all necessary prerequisites.

These Docker containers are the same as used by the continuous integration servers.

### Installation

Install [Docker](https://docs.docker.com/install/) (with Docker Compose) locally on your machine.

### Dependenices

First, install all dependencies:

```bash
docker-compose run --rm app /bin/bash -c "npm install"
```

### Start and stop the containers

Before start working you have to start the Docker containers:

```
docker-compose up --build --detach
```

After finished working you can stop the Docker containers:

```
docker-compose stop
```

### Running commands inside the container

When the containers are running, you can execute any command inside the environment. Just replace the dots `...` in the following example with the command you wish to execute:

```bash
docker-compose run --rm app /bin/bash -c "..."
```

Some examples are:

```bash
docker-compose run --rm app /bin/bash -c "npm run build"
```

## Information

### Support

For support, please contact [help@opendatahub.com](mailto:help@opendatahub.com).

### Contributing

If you'd like to contribute, please follow the Contributor Guidelines that can be found at [https://github.com/noi-techpark/odh-docs/wiki/Contributor-Guidelines%3A-Getting-started](https://github.com/noi-techpark/odh-docs/wiki/Contributor-Guidelines%3A-Getting-started).

### Documentation

More documentation can be found at [https://opendatahub.readthedocs.io/en/latest/index.html](https://opendatahub.readthedocs.io/en/latest/index.html).

### Boilerplate

The project uses this boilerplate: [https://github.com/noi-techpark/webcomp-boilerplate](https://github.com/noi-techpark/webcomp-boilerplate).

### License

The code in this project is licensed under the GNU AFFERO GENERAL PUBLIC LICENSE Version 3 license. See the [LICENSE.md](LICENSE.md) file for more information.

### REUSE

This project is [REUSE](https://reuse.software) compliant, more information about the usage of REUSE in NOI Techpark repositories can be found [here](https://github.com/noi-techpark/odh-docs/wiki/Guidelines-for-developers-and-licenses#guidelines-for-contributors-and-new-developers).

Since the CI for this project checks for REUSE compliance you might find it useful to use a pre-commit hook checking for REUSE compliance locally. The [pre-commit-config](.pre-commit-config.yaml) file in the repository root is already configured to check for REUSE compliance with help of the [pre-commit](https://pre-commit.com) tool.

Install the tool by running:
```bash
pip install pre-commit
```
Then install the pre-commit hook via the config file by running:
```bash
pre-commit install
```
