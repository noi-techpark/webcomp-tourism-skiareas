# Generic Map to show Open Data Hub Skiarea Information

[![REUSE status](https://api.reuse.software/badge/github.com/noi-techpark/webcomp-tourism-skiareas)](https://api.reuse.software/info/github.com/noi-techpark/webcomp-tourism-skiareas)

This project is a rewrite taken from the repository webcomp-generic-map (thanks
to pmoser). It is a webcomponent to display data from the [Open Data
Hub](https://opendatahub.bz.it).

The Open Data Hub Team wants to generate reusable and independent visualization
components to display data from the Open Data Hub easily. Using these
webcomponents, a developer can easily integrate the functionality of the single
components into any website.

Map that displays Lifts and Skiareas from Opendatahub Activity Endpoint

Do you want to see it in action? Go to our [web component
store](https://webcomponents.opendatahub.bz.it/webcomponent/8282479b-dc13-5012-939f-7a0196348dca)!

- [Generic Map to show Open Data Hub Skiarea Information](#generic-map-to-show-open-data-hub-skiarea-information)
  - [Usage](#usage)
    - [Attributes](#attributes)
      - [types](#types)
      - [language](#language)
      - [centermap](#centermap)
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
<map-widget types="512" language="de" centermap=""></map-widget>
```

### Attributes

#### types

Type: bitmask
Options: Refer to https://tourism.opendatahub.bz.it/api/ActivityTypes

#### language

Type: string
Options: "de,it,en"

#### centermap

Type: string
Options: "latitude,longitude,zoomlevel"
Pass latitude, longitude and zoomlevel separated by "," if map should be centered an a specific gps point


## Getting started

These instructions will get you a copy of the project up and running
on your local machine for development and testing purposes.

### Prerequisites

To build the project, the following prerequisites must be met:

- Node 12 / Yarn 1

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
yarn install
```

### Build

Build and start the project:

```bash
yarn run watch
```

The application will be served and can be accessed at [http://localhost:8080](http://localhost:8080).

## Deployment

To create the distributable files, execute the following command:

```bash
yarn run build
```

## Docker environment

For the project a Docker environment is already prepared and ready to use with all necessary prerequisites.

These Docker containers are the same as used by the continuous integration servers.

### Installation

Install [Docker](https://docs.docker.com/install/) (with Docker Compose) locally on your machine.

### Dependenices

First, install all dependencies:

```bash
docker-compose run --rm app /bin/bash -c "yarn install"
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
docker-compose run --rm app /bin/bash -c "yarn run build"
```

## Information

### Support

For support, please contact [help@opendatahub.bz.it](mailto:help@opendatahub.bz.it).

### Contributing

If you'd like to contribute, please follow the following instructions:

- Fork the repository.

- Checkout a topic branch from the `development` branch.

- Make sure the tests are passing.

- Create a pull request against the `development` branch.

A more detailed description can be found here: [https://github.com/noi-techpark/documentation/blob/master/contributors.md](https://github.com/noi-techpark/documentation/blob/master/contributors.md).

### Documentation

More documentation can be found at [https://opendatahub.readthedocs.io/en/latest/index.html](https://opendatahub.readthedocs.io/en/latest/index.html).

### Boilerplate

The project uses this boilerplate: [https://github.com/noi-techpark/webcomp-boilerplate](https://github.com/noi-techpark/webcomp-boilerplate).

### License

The code in this project is licensed under the GNU AFFERO GENERAL PUBLIC LICENSE Version 3 license. See the [LICENSE.md](LICENSE.md) file for more information.
