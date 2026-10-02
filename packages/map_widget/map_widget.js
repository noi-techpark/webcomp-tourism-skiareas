// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { html, LitElement } from 'lit-element';
import L from 'leaflet';
import style__leaflet from 'leaflet/dist/leaflet.css';
import '@maplibre/maplibre-gl-leaflet';
import style__maplibre from 'maplibre-gl/dist/maplibre-gl.css';
import style from './scss/main.scss';
import { getStyle, rainbow, getDistanceFromLatLonInKm } from './utils.js';
import { fetchActivities, fetchSkiAreas } from './api/api.js';
import colors, { slopeColor, cssVariables } from './colors.js';
import { t } from './i18n.js';
import config from './api/config.js';
import moment from 'moment';
import L2 from 'leaflet-gpx';
import L3 from 'leaflet-kml';

/**
 * Defaults for types and source. They are applied in the code because the web component
 * store ignores the default of a multiselect and may pass an empty value.
 */
const DEFAULT_TYPES = ['slopes', 'lifts'];
const DEFAULT_SOURCES = ['dss'];

// SkiRegion "Dolomiti Superski"
const SKIREGION_DOLOMITI_SUPERSKI = '8260DC5B815D40B98A1B53E84EC2B419';

/**
 * Data providers selectable with the source attribute and the Open Data Hub data they stand for:
 *  - activities: source of the slopes and lifts (ODHActivityPoi)
 *  - skiareas: which ski areas (SkiArea) are shown, a ski area is shown if it matches one of the rules,
 *    a rule matches on Source and optionally on SkiRegionId
 */
const DATA_PROVIDERS = {
  lts: {
    activities: 'lts',
    skiareas: [{ source: 'idm' }]
  },
  dss: {
    activities: 'dss',
    skiareas: [{ source: 'dss' }, { source: 'idm', skiRegionId: SKIREGION_DOLOMITI_SUPERSKI }]
  },
  discoverswiss: {
    activities: 'discoverswiss',
    skiareas: [{ source: 'discoverswiss' }]
  }
};

// Multiselect values arrive as comma separated string or as JSON array, an empty selection may come as "" or "null"
function parseList(value)
{
  if (Array.isArray(value))
    return value;
  if (!value)
    return [];

  let text = String(value).trim();
  if (text.startsWith('['))
  {
    try { return JSON.parse(text); } catch (e) { }
  }
  return text.split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(x => x && x != 'null' && x != 'undefined');
}

/**
 * Parses the coordinate groups of a WKT geometry (LINESTRING, MULTILINESTRING, POLYGON, MULTIPOLYGON)
 * into rings of [lat, lng] points. WKT uses "lng lat" order.
 */
function parseWktRings(wkt)
{
  if (typeof wkt !== 'string')
    return [];

  return (wkt.match(/\(([^()]+)\)/g) || [])
    .map(group => group.slice(1, -1).split(',')
      .map(point =>
      {
        const [lng, lat] = point.trim().split(/\s+/).map(Number);
        return [lat, lng];
      })
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)))
    .filter(ring => ring.length > 2);
}

class MapWidget extends LitElement
{

  static get properties()
  {
    return {
      propTypes: {
        type: String,
        attribute: 'types'
      },
      // propDomain: {
      //   type: String,
      //   attribute: 'domain'
      // },
      propLanguage: {
        type: String,
        attribute: 'language'
      },
      propSource: {
        type: String,
        attribute: 'source'
      },
      propCenterMap: {
        type: String,
        attribute: 'centermap'
      },
      propCheckGps: {
        type: Boolean,
        attribute: 'checkgpspoints'
      }
    };
  }

  constructor()
  {
    super();

    /* Map configuration */
    this.map_center = [46.479, 11.331];
    this.map_zoom = 9;
    this.map_layer = "https://tiles.openfreemap.org/styles/positron";
    this.map_attribution = '<a target="_blank" href="https://opendatahub.com">OpenDataHub.com</a> | &copy; <a target="_blank" href="https://openfreemap.org">OpenFreeMap</a> &copy; <a target="_blank" href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a target="_blank" href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    //OSM
    // this.map_layer = "http://a.tile.openstreetmap.org/{z}/{x}/{y}.png";
    // this.map_attribution = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>';

    //OA MAP needs OA JS


    /* Internationalization */
    // this.language_default = 'en';
    // this.language = 'de';

    /* KML download queue, firing ~1000 requests at once makes most of them fail */
    this.fetchQueue = [];
    this.fetchActive = 0;
    this.fetchMaxParallel = 6;

    /* Lifts and slopes (see addFeature), ski areas and the currently selected ski area */
    this.features = [];
    this.skiAreaEntries = [];
    this.focusedSkiArea = null;

    /* Ski area outlines: always shown, highlighted when the ski area is selected */
    this.outlineStyle = { color: colors.skiarea, weight: 1.5, opacity: 0.6, fillColor: colors.skiarea, fillOpacity: 0.04 };
    this.outlineStyleFocused = { color: colors.skiarea, weight: 3, opacity: 1, fillColor: colors.skiarea, fillOpacity: 0.12 };
    this.outlineStyleFaded = { color: colors.skiarea, weight: 1, opacity: 0.25, fillColor: colors.skiarea, fillOpacity: 0 };

    /* Lift station and slope point markers are shown from this zoom level on, below it the lift lines alone are drawn */
    this.stationMinZoom = 13;

    /* Data fetched from Open Data Hub */
    this.nodes = [];
    this.types = {};

    /* Requests */
    //this.fetchStations = fetchStations.bind(this);
    this.fetchActivities = fetchActivities.bind(this);
    this.fetchSkiAreas = fetchSkiAreas.bind(this);
  }

  async initializeMap()
  {
    let root = this.shadowRoot;
    let mapref = root.getElementById('map');

    if (this.propCenterMap)
    {
      var splittedgps = this.propCenterMap.split(',');
      this.map_center = [parseFloat(splittedgps[0]), parseFloat(splittedgps[1])]
      this.map_zoom = parseInt(splittedgps[2]);
    }

    this.map = L.map(mapref, {
      zoomControl: false,
      minZoom: 0,
      maxZoom: 19
    }).setView(this.map_center, this.map_zoom);

    L.maplibreGL({
      style: this.map_layer,
      attribution: this.map_attribution
    }).addTo(this.map);

    // Draw lifts above slopes, ski area outlines below everything else
    this.map.createPane('lifts');
    this.map.getPane('lifts').style.zIndex = 450;
    this.map.createPane('skiareas');
    this.map.getPane('skiareas').style.zIndex = 350;
  }

  hasTag(activity, tagId)
  {
    return Array.isArray(activity.TagIds) && activity.TagIds.includes(tagId);
  }

  getCategories(activity)
  {
    let info = activity.AdditionalPoiInfos && activity.AdditionalPoiInfos[this.propLanguage];
    return info && Array.isArray(info.Categories) ? info.Categories.join(', ') : '';
  }

  /**
   * Returns true if a GpsInfo point is a known placeholder coordinate.
   *
   * Some lifts in the source data (LTS and DSS) have a station point that was
   * never geocoded and instead carries a default coordinate. Connecting such a
   * point with the real station produces straight lines of 8 up to 270 km on the map.
   *
   * Known placeholders (rounded to 4 decimals, ~10 m):
   *  - 46.5742, 11.6739  St. Ulrich / Ortisei village centre
   *                      (also stored as 46.57416, 11.67389)
   *                      e.g. Pobist, Raut, Waldheim, Erschbaum, Hawaii, Gaisjoch, Sonne,
   *                      Absam-Maierl, Campo Scuola Gardoné, Pralongiá II, Risaccia 1, Città dei Sassi
   *  - 47.3688, 8.5375   Zurich city centre
   *                      e.g. Maria, Val Setus
   *
   * Points matching a placeholder are skipped, so the lift shows only its valid station(s).
   * Remove entries here once the source data has been corrected.
   */
  isPlaceholderGps(gps)
  {
    const placeholders = [
      [46.5742, 11.6739], // St. Ulrich / Ortisei centre
      [47.3688, 8.5375]   // Zurich centre
    ];
    const tolerance = 0.0001;

    return placeholders.some(p => Math.abs(gps.Latitude - p[0]) < tolerance && Math.abs(gps.Longitude - p[1]) < tolerance);
  }

  // KML tracks are loaded directly or through the Open Data Hub proxy, see USE_KML_PROXY in api/config.js
  kmlUrl(url)
  {
    return config.USE_KML_PROXY ? config.KML_PROXY + url : url;
  }

  /**
   * Loads a track (KML or GPX) and draws it with the given style.
   * onloaded(layer) is called once the track is on the map.
   */
  loadTrack(track, style, popupcontent, onloaded)
  {
    if (track.Format == "kml")
    {
      let url = this.kmlUrl(track.GpxTrackUrl);

      this.fetchText(url)
        .then(kmltext =>
        {
          const kml = new DOMParser().parseFromString(kmltext, 'text/xml');

          // A blocked request returns an html error page instead of a kml
          if (kml.getElementsByTagName('Placemark').length == 0)
          {
            console.log('no kml track in response: ' + url);
            return;
          }

          let layer = new L.KML(kml);
          layer.eachLayer(l => { if (style.pane) l.options.pane = style.pane; });
          layer.setStyle(style).addTo(this.map).bindPopup(popupcontent);

          if (onloaded)
            onloaded(layer);
        })
        .catch(e => console.log('kml load failed: ' + url, e));
    }
    else
    {
      let url = track.GpxTrackUrl.replace('https://lcs.lts.it/downloads/gpx/', 'https://tourism.opendatahub.com/v1/Activity/Gpx/');

      let layer = new L2.GPX(url, {
        async: true,
        gpx_options: { parseElements: 'track' },
        polyline_options: style,
        marker_options: { startIconUrl: null, endIconUrl: null }
      }).on('loaded', () =>
      {
        if (onloaded)
          onloaded(layer);
      }).addTo(this.map).bindPopup(popupcontent);
    }
  }

  liftPopupContent(activity, lifttype, stationtype)
  {
    let content = '<div class="popup"><div class="popup__title">' + activity["Detail." + this.propLanguage + ".Title"] + '</div>';
    if (stationtype)
      content += '<div class="popup__meta">' + t(stationtype, this.language) + '</div>';
    content += '<div class="popup__meta">' + this.getCategories(activity) + '</div>';
    content += '<div class="popup__lifttype">' + '<span class="icon ' + lifttype.icon + '"></span>' + '<span>' + lifttype.label + '</span></div>';
    content += '<div>' + this.statusBadge(activity.IsOpen) + '</div>';

    if (stationtype && activity["Detail." + this.propLanguage + ".BaseText"] != null)
    {
      content += '<div>' + activity["Detail." + this.propLanguage + ".BaseText"] + '</div>';
    }
    content += '</div>';

    return content;
  }

  // Fetches a url as text, running at most fetchMaxParallel requests at the same time
  fetchText(url)
  {
    return new Promise((resolve, reject) =>
    {
      this.fetchQueue.push({ url, resolve, reject });
      this.nextFetch();
    });
  }

  nextFetch()
  {
    while (this.fetchActive < this.fetchMaxParallel && this.fetchQueue.length > 0)
    {
      const job = this.fetchQueue.shift();
      this.fetchActive++;

      fetch(job.url)
        .then(res => res.text())
        .then(job.resolve, job.reject)
        .finally(() =>
        {
          this.fetchActive--;
          this.nextFetch();
        });
    }
  }

  slopePopupContent(activity)
  {
    let content = '<div class="popup"><div class="popup__title">' + activity["Detail." + this.propLanguage + ".Title"] + '</div>';
    content += '<div class="popup__meta">' + this.getCategories(activity) + '</div>';
    content += '<div>' + this.statusBadge(activity.IsOpen) + '</div>';

    if (activity["Detail." + this.propLanguage + ".BaseText"] != null)
    {
      content += '<div>' + activity["Detail." + this.propLanguage + ".BaseText"] + '</div>';
    }
    content += '</div>';

    return content;
  }

  // A GpsInfo point can be drawn: numeric coordinates (the API sometimes sends "NaN"), no placeholder, inside the area
  isUsableGps(gps)
  {
    return !!gps &&
      Number.isFinite(gps.Latitude) && Number.isFinite(gps.Longitude) &&
      !this.isPlaceholderGps(gps) &&
      this.isInsideArea(gps);
  }

  // With checkgpspoints set, points more than 200 km from the centre of South Tyrol are ignored
  isInsideArea(gps)
  {
    if (this.propCheckGps != true)
      return true;

    return getDistanceFromLatLonInKm(46.655781, 11.4296877, gps.Latitude, gps.Longitude) < 200;
  }

  // A ski area is shown if it matches one of the ski area rules of the selected data providers
  matchesSkiAreaRules(skiarea, rules)
  {
    return rules.some(rule =>
      rule.source == skiarea.Source &&
      (!rule.skiRegionId || rule.skiRegionId == skiarea.SkiRegionId));
  }

  // Resolves the selected data providers to the sources of the ODHActivityPoi and SkiArea endpoints
  dataSources()
  {
    let activities = new Set();
    let skiareaRules = [];

    let providers = parseList(this.propSource);
    if (providers.length == 0)
      providers = DEFAULT_SOURCES;

    providers.forEach(provider =>
    {
      let mapping = DATA_PROVIDERS[provider] || { activities: provider, skiareas: [{ source: provider }] };
      activities.add(mapping.activities);
      skiareaRules.push(...mapping.skiareas);
    });

    return {
      activities: [...activities].join(','),
      skiareas: [...new Set(skiareaRules.map(rule => rule.source))].join(','),
      skiareaRules: skiareaRules
    };
  }

  get language()
  {
    return this.propLanguage || 'en';
  }

  statusBadge(isOpen)
  {
    return isOpen == false
      ? '<span class="badge badge--closed">' + t('closed', this.language) + '</span>'
      : '<span class="badge badge--open">' + t('open', this.language) + '</span>';
  }

  /**
   * Determines the lift type, returns { icon, label }.
   * TagIds (ODH categories) are checked first. For lifts without a matching tag
   * the known SmgTags values (LTS categories) are used as fallback, e.g. "gondelbahn"
   * has no ODH category. Unknown types get a generic lift icon.
   */
  liftType(activity)
  {
    const tagIds = activity.TagIds || [];
    const smgTags = activity.SmgTags || [];
    const has = (list, ...values) => values.some(v => list.includes(v));

    let type = 'unknown';
    let seats = null;

    const chairTag = tagIds.find(tag => /^chairlift \d+ person/.test(tag));
    const chairSmg = smgTags.find(tag => /^\d+er sessellift/.test(tag));

    if (chairTag || chairSmg || has(tagIds, 'chairlift') || has(smgTags, 'sessellift'))
    {
      type = 'chairlift';
      seats = (chairTag || chairSmg || '').match(/\d+/);
    }
    else if (has(tagIds, 'ski lift') || has(smgTags, 'skilift', 'kleinskilift'))
      type = 'skilift';
    else if (has(tagIds, 'orbit') || has(smgTags, 'umlaufbahn', 'gondelbahn'))
      type = 'gondola';
    else if (has(tagIds, 'cabinet train') || has(smgTags, 'kabinenbahn'))
      type = 'cabin';
    else if (has(tagIds, 'funicular railwaycog railway') || has(smgTags, 'standseilbahn', 'standseilbahn zahnradbahn', 'standseilbahn/zahnradbahn', 'schrägaufzug', 'unterirdische seilbahn', 'unterirdische bahn'))
      type = 'funicular';
    else if (has(tagIds, 'ropeway') || has(smgTags, 'seilbahn'))
      type = 'ropeway';
    else if (has(tagIds, 'telemix') || has(smgTags, 'telemix'))
      type = 'telemix';
    else if (has(tagIds, 'moving carpet') || has(smgTags, 'förderband'))
      type = 'carpet';
    else if (has(tagIds, 'train') || has(smgTags, 'zug'))
      type = 'train';
    else if (has(tagIds, 'skibus') || has(smgTags, 'skibus'))
      type = 'bus';

    const icons = {
      chairlift: 'iconSessellift',
      skilift: 'iconSkilift',
      gondola: 'iconUmlaufbahn',
      cabin: 'iconKabinenbahn',
      funicular: 'iconZahnrad',
      ropeway: 'iconSeilbahn',
      telemix: 'iconTelemix',
      carpet: 'iconFoerderband',
      train: 'iconZug',
      bus: 'iconBus',
      unknown: 'iconLift'
    };

    const label = seats
      ? t('lift_chairlift_seats', this.language, { n: seats[0] })
      : t('lift_' + type, this.language);

    return { icon: icons[type], label: label };
  }

  /**
   * Every drawn lift and slope is registered as a feature: its points (stations / start point),
   * its map layers and the ski areas it lies in. This is used to highlight the lifts and slopes
   * of a selected ski area.
   */
  addFeature(kind, points)
  {
    let feature = { kind: kind, points: points, layers: [], skiareas: new Set() };
    this.features.push(feature);
    return feature;
  }

  addFeatureLayer(feature, layer, baseOpacity)
  {
    layer._baseOpacity = baseOpacity != null ? baseOpacity : (layer.options && layer.options.opacity != null ? layer.options.opacity : 1);
    feature.layers.push(layer);
    this.applyFocus(feature);
  }

  // Fades lifts and slopes outside of the selected ski area
  applyFocus(feature)
  {
    let faded = this.focusedSkiArea != null && !feature.skiareas.has(this.focusedSkiArea.id);

    feature.layers.forEach(layer =>
    {
      let opacity = faded ? layer._baseOpacity * 0.2 : layer._baseOpacity;

      if (layer instanceof L.Marker)
        layer.setOpacity(opacity);
      else if (layer.setStyle)
        layer.setStyle({ opacity: opacity });
    });
  }

  focusSkiArea(entry)
  {
    this.focusedSkiArea = entry;

    this.skiAreaEntries.forEach(other =>
    {
      if (other.outline)
        other.outline.setStyle(entry == null ? this.outlineStyle : other == entry ? this.outlineStyleFocused : this.outlineStyleFaded);
    });

    this.features.forEach(feature => this.applyFocus(feature));
  }

  // Ray casting point in polygon test, ring and point as [lat, lng]
  isInsideRing(point, ring)
  {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    {
      let [yi, xi] = ring[i];
      let [yj, xj] = ring[j];
      if (((yi > point[0]) != (yj > point[0])) && (point[1] < (xj - xi) * (point[0] - yi) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }

  // Draws one slope or lift, station and slope markers are collected in columns_layer_array
  drawActivity(activity, columns_layer_array)
  {
    if (this.hasTag(activity, "slopes"))
    {
      /**
       * Every slope is shown as an icon at its start point (LTS startingpoint, DSS position).
       * The slope track (KML/GPX) is only loaded when the icon is hovered or clicked,
       * loading all ~1000 tracks at once gets us blocked by the track provider.
       */
      let gpsinfo = activity.GpsInfo || [];
      let start = gpsinfo.find(x => x.Gpstype == "startingpoint") || gpsinfo.find(x => x.Gpstype == "position");

      if (this.isUsableGps(start))
      {
        // Small disc in the piste colour with a skier glyph
        let slopeicon = L.divIcon({
          className: 'slope-point-icon',
          html: '<div class="slope-point' + (activity.IsOpen == false ? ' slope-point--closed' : '') + '" style="background-color: ' + slopeColor(activity["Ratings.Difficulty"]) + '">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<circle cx="15.5" cy="4.5" r="2"/>' +
                    '<path d="M14 8 9.5 11.5l3 2.5-2 5"/>' +
                    '<path d="M4 16.5 19 21"/>' +
                  '</svg>' +
                '</div>',
          iconSize: L.point(18, 18)
        });

        let popupcontent = this.slopePopupContent(activity);

        let marker = L.marker([start.Latitude, start.Longitude], {
          icon: slopeicon
        }).bindPopup(L.popup().setContent(popupcontent));

        let feature = this.addFeature('slope', [[start.Latitude, start.Longitude]]);
        this.addFeatureLayer(feature, marker);

        let track = (activity.GpsTrack || []).find(x => x.Type == "detailed" && x.GpxTrackUrl);

        if (track)
        {
          const loadTrack = () =>
          {
            marker.off('mouseover', loadTrack);
            marker.off('click', loadTrack);
            let style = {
              color: slopeColor(activity["Ratings.Difficulty"]),
              weight: 3,
              opacity: activity.IsOpen == false ? 0.35 : 0.85,
              lineCap: 'round',
              lineJoin: 'round'
            };

            this.loadTrack(track, style, popupcontent, layer => this.addFeatureLayer(feature, layer, style.opacity));
          };

          marker.on('mouseover', loadTrack);
          marker.on('click', loadTrack);
        }

        columns_layer_array.push(marker);
      }
    }
    else if (((activity.GpsTrack && activity.GpsTrack.length > 0) || (activity.GpsInfo && activity.GpsInfo.length > 0)) && this.hasTag(activity, "lifts"))
    {

      let lifttype = this.liftType(activity);

      let icon = L.divIcon({
        className: 'lift-station-icon',
        html: '<div class="lift-station' + (activity.IsOpen == false ? ' lift-station--closed' : '') + '"></div>',
        iconSize: L.point(12, 12)
      });

      /**
       * Lifts are drawn as straight lines between their stations (valley, middle, mountain).
       * If the lift has a detailed track (DSS KML), it is loaded on the first hover or click
       * on the line or a station and replaces the straight line.
       */
      let stations = ["valleystationpoint", "middlestationpoint", "mountainstationpoint"]
        .map(type => (activity.GpsInfo || []).find(x => x.Gpstype == type && this.isUsableGps(x)))
        .filter(x => x);

      let isClosed = activity.IsOpen == false;
      let linecolor = isClosed ? colors.closed : colors.lift;
      let linelayers = [];
      let interactivelayers = [];

      let feature = this.addFeature('lift', stations.map(station => [station.Latitude, station.Longitude]));

      stations.forEach(station =>
      {
        let marker = L.marker([station.Latitude, station.Longitude], {
          icon: icon,
        }).bindPopup(L.popup().setContent(this.liftPopupContent(activity, lifttype, station.Gpstype)));

        columns_layer_array.push(marker);
        interactivelayers.push(marker);
        this.addFeatureLayer(feature, marker);
      });

      let popupline = L.popup().setContent(this.liftPopupContent(activity, lifttype));

      for (let i = 1; i < stations.length; i++)
      {
        let segment = [
          [stations[i - 1].Latitude, stations[i - 1].Longitude],
          [stations[i].Latitude, stations[i].Longitude]
        ];

        // White casing below the lift line keeps it readable on top of slopes and the base map
        let casing = L.polyline(segment, {
          pane: 'lifts',
          color: colors.surface,
          opacity: 0.9,
          weight: 5,
          lineCap: 'round',
          interactive: false
        }).addTo(this.map);

        let polyline = L.polyline(segment, {
          pane: 'lifts',
          color: linecolor,
          opacity: 1,
          weight: 2.5,
          lineCap: 'round',
          dashArray: isClosed ? '4 6' : null
        }).addTo(this.map).bindPopup(popupline);

        polyline.on('mouseover', function () { this.setStyle({ weight: 4.5 }); });
        polyline.on('mouseout', function () { this.setStyle({ weight: 2.5 }); });

        linelayers.push(casing, polyline);
        interactivelayers.push(polyline);
        this.addFeatureLayer(feature, casing);
        this.addFeatureLayer(feature, polyline);
      }

      let track = (activity.GpsTrack || []).find(x => x.Type == "detailed" && x.GpxTrackUrl);

      if (track && interactivelayers.length > 0)
      {
        let style = { pane: 'lifts', color: linecolor, weight: 2.5, opacity: 1, lineCap: 'round', dashArray: isClosed ? '4 6' : null };

        const loadTrack = () =>
        {
          interactivelayers.forEach(layer =>
          {
            layer.off('mouseover', loadTrack);
            layer.off('click', loadTrack);
          });

          // The real track replaces the straight line
          this.loadTrack(track, style, this.liftPopupContent(activity, lifttype), layer =>
          {
            linelayers.forEach(line => line.remove());
            feature.layers = feature.layers.filter(l => !linelayers.includes(l));
            this.addFeatureLayer(feature, layer, style.opacity);
          });
        };

        interactivelayers.forEach(layer =>
        {
          layer.on('mouseover', loadTrack);
          layer.on('click', loadTrack);
        });
      }
    }
  }

  async drawMap()
  {

    let columns_layer_array = [];

    let sources = this.dataSources();

    let types = parseList(this.propTypes);
    if (types.length == 0)
      types = DEFAULT_TYPES;

    await this.fetchActivities(types.join(','), this.propLanguage, sources.activities);

    // One broken record must not stop the rest of the map (and the ski areas) from being drawn
    this.nodes.forEach(activity =>
    {
      try
      {
        this.drawActivity(activity, columns_layer_array);
      }
      catch (e)
      {
        console.log('could not draw ' + activity.Id, e);
      }
    });

    //Getting Skiareas
    await this.fetchSkiAreas(this.propLanguage, sources.skiareas);

    // First pass: outlines and position of the ski areas
    this.nodes.forEach(skiarea =>
    {
      if (!this.matchesSkiAreaRules(skiarea, sources.skiareaRules))
        return;

      // Outline of the ski area (Geo.track, WKT), always shown
      let rings = parseWktRings(skiarea.Geo && skiarea.Geo.track && skiarea.Geo.track.Geometry);
      let outline = rings.length > 0
        ? L.polygon(rings.map(ring => [ring]), Object.assign({ pane: 'skiareas', lineJoin: 'round' }, this.outlineStyle)).addTo(this.map)
        : null;

      // DSS ski areas have Latitude/Longitude 0,0, their badge is placed in the centre of the outline
      let hasPosition = Number.isFinite(skiarea.Latitude) && Number.isFinite(skiarea.Longitude) && !(skiarea.Latitude == 0 && skiarea.Longitude == 0);

      if (!hasPosition && !outline)
        return;

      this.skiAreaEntries.push({
        id: skiarea.Id,
        skiarea: skiarea,
        rings: rings,
        outline: outline,
        position: hasPosition ? [skiarea.Latitude, skiarea.Longitude] : outline.getBounds().getCenter(),
        counts: { lift: 0, slope: 0 }
      });
    });

    // Assign every lift and slope to the ski areas whose outline contains one of its points
    this.skiAreaEntries.forEach(entry =>
    {
      if (!entry.outline)
        return;

      let bounds = entry.outline.getBounds();

      this.features.forEach(feature =>
      {
        let inside = feature.points.some(point =>
          bounds.contains(point) && entry.rings.some(ring => this.isInsideRing(point, ring)));

        if (inside)
        {
          feature.skiareas.add(entry.id);
          entry.counts[feature.kind]++;
        }
      });
    });

    // Second pass: badges and popups, selecting a ski area highlights its outline, lifts and slopes
    this.skiAreaEntries.forEach(entry =>
    {
      let skiarea = entry.skiarea;

      // Round badge with a mountain glyph marking the ski area centre
      let iconskiarea = L.divIcon({
        className: 'skiarea-icon',
        html: '<div class="skiarea-marker">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                  '<path class="skiarea-marker__mountain" d="M2.5 19 9 8l3.2 5.3 2.3-3.3L21.5 19z"/>' +
                  '<path class="skiarea-marker__snow" d="M9 8l-2 3.4 1.2-.6.8 1 .9-1 1.2.4z"/>' +
                '</svg>' +
              '</div>',
        iconSize: L.point(36, 36),
        iconAnchor: L.point(18, 18),
        popupAnchor: L.point(0, -18)
      });

      let popupContSkiArea = '<div class="popup"><div class="popup__title">' + skiarea["Detail." + this.propLanguage + ".Title"] + '</div>';
      if (skiarea["SkiRegionName." + this.propLanguage])
        popupContSkiArea += '<div class="popup__meta">' + skiarea["SkiRegionName." + this.propLanguage] + '</div>';
      if (entry.outline && (entry.counts.lift > 0 || entry.counts.slope > 0))
        popupContSkiArea += '<div class="popup__meta">' + t('count_lifts', this.language, { n: entry.counts.lift }) + ' · ' + t('count_slopes', this.language, { n: entry.counts.slope }) + '</div>';
      if (skiarea["Detail." + this.propLanguage + ".BaseText"] != null)
      {
        //Opening
        popupContSkiArea += '<div class="popup__meta">' + moment(skiarea["OperationSchedule[0].Start"]).format('MM/DD/YYYY') + " - " + moment(skiarea["OperationSchedule[0].Stop"]).format('MM/DD/YYYY') + '</div>';
        //BaseText
        popupContSkiArea += '<div>' + skiarea["Detail." + this.propLanguage + ".BaseText"] + '</div>';
      }
      popupContSkiArea += '</div>';

      // Ski areas with outline: the map zooms to the outline instead of panning to the popup
      let marker = L.marker(entry.position, {
        icon: iconskiarea,
        riseOnHover: true,
        zIndexOffset: 1000
      }).addTo(this.map).bindPopup(L.popup({ maxHeight: 240, autoPan: !entry.outline }).setContent(popupContSkiArea));

      if (entry.outline)
      {
        marker.on('popupopen', () =>
        {
          this.focusSkiArea(entry);
          this.map.fitBounds(entry.outline.getBounds(), { paddingTopLeft: [40, 300], paddingBottomRight: [40, 30], maxZoom: 14 });
        });
        marker.on('popupclose', () => { if (this.focusedSkiArea == entry) this.focusSkiArea(null); });

        // A click inside the outline selects the ski area as well
        entry.outline.on('click', () => marker.openPopup());
        entry.outline.on('mouseover', () => { if (this.focusedSkiArea == null) entry.outline.setStyle({ weight: 2.5, fillOpacity: 0.08 }); });
        entry.outline.on('mouseout', () => { if (this.focusedSkiArea == null) entry.outline.setStyle(this.outlineStyle); });
      }
    });

    this.visibleNodes = columns_layer_array.length;

    /**
     * Lift station and slope point markers are not clustered: a cluster would detach the stations from
     * their lift line. Instead they are only shown when zoomed in far enough to tell them apart.
     */
    this.stationLayer = L.layerGroup(columns_layer_array);

    const toggleStations = () =>
    {
      if (this.map.getZoom() >= this.stationMinZoom)
        this.stationLayer.addTo(this.map);
      else
        this.stationLayer.remove();
    };

    this.map.on('zoomend', toggleStations);
    toggleStations();
  }

  async firstUpdated()
  {
    this.initializeMap();
    this.drawMap();
  }

  render()
  {
    return html`
      <style>
        ${getStyle(style__leaflet)}
        ${getStyle(style__maplibre)}
        ${getStyle(style)}
        ${cssVariables()}
      </style>
      <div id="map_widget">
        <div id="map" class="map"></div>
      </div>
    `;
  }
}

if (!window.customElements.get('map-widget'))
{
  window.customElements.define('map-widget', MapWidget);
}
