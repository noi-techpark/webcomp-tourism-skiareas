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
 * Data providers selectable with the source attribute and the Open Data Hub
 * sources they stand for: ODHActivityPoi (slopes, lifts) and SkiArea.
 */
const DATA_PROVIDERS = {
  lts: { activities: 'lts', skiareas: 'idm' },
  dss: { activities: 'dss', skiareas: 'idm' }, //comment out dss because the skiareas does not have a valid gps
  discoverswiss: { activities: 'discoverswiss', skiareas: 'discoverswiss' }
};

// Multiselect values arrive as comma separated string or as JSON array
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
  return text.split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(x => x);
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

    /* Defaults, used when the types / source attributes are not set */
    this.propTypes = 'slopes,lifts';
    this.propSource = 'dss';

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

    // Draw lifts above slopes
    this.map.createPane('lifts');
    this.map.getPane('lifts').style.zIndex = 450;
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
   * onloaded is called once the track is on the map.
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
            onloaded();
        })
        .catch(e => console.log('kml load failed: ' + url, e));
    }
    else
    {
      let url = track.GpxTrackUrl.replace('https://lcs.lts.it/downloads/gpx/', 'https://tourism.opendatahub.com/v1/Activity/Gpx/');

      new L2.GPX(url, {
        async: true,
        gpx_options: { parseElements: 'track' },
        polyline_options: style,
        marker_options: { startIconUrl: null, endIconUrl: null }
      }).on('loaded', () =>
      {
        if (onloaded)
          onloaded();
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

  // Resolves the selected data providers to the sources of the ODHActivityPoi and SkiArea endpoints
  dataSources()
  {
    let activities = new Set();
    let skiareas = new Set();

    parseList(this.propSource).forEach(provider =>
    {
      let mapping = DATA_PROVIDERS[provider] || { activities: provider, skiareas: provider };
      mapping.activities.split(',').forEach(x => activities.add(x));
      mapping.skiareas.split(',').forEach(x => skiareas.add(x));
    });

    return { activities: [...activities].join(','), skiareas: [...skiareas].join(',') };
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

            this.loadTrack(track, style, popupcontent);
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

      stations.forEach(station =>
      {
        let marker = L.marker([station.Latitude, station.Longitude], {
          icon: icon,
        }).bindPopup(L.popup().setContent(this.liftPopupContent(activity, lifttype, station.Gpstype)));

        columns_layer_array.push(marker);
        interactivelayers.push(marker);
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
          this.loadTrack(track, style, this.liftPopupContent(activity, lifttype), () => linelayers.forEach(layer => layer.remove()));
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

    await this.fetchActivities(parseList(this.propTypes).join(','), this.propLanguage, sources.activities);

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

    this.nodes.map(skiarea =>
    {
      if (!Number.isFinite(skiarea.Latitude) || !Number.isFinite(skiarea.Longitude))
        return;

      const posskiarea = [
        skiarea.Latitude,
        skiarea.Longitude
      ];

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

      let popupContSkiArea = '<div class="popup"><div class="popup__title">' + skiarea["Detail." + this.propLanguage + ".Title"] + '</div><div class="popup__meta">' + skiarea["SkiRegionName." + this.propLanguage] + '</div>';
      if (skiarea["Detail." + this.propLanguage + ".BaseText"] != null)
      {
        //Opening
        popupContSkiArea += '<div class="popup__meta">' + moment(skiarea["OperationSchedule[0].Start"]).format('MM/DD/YYYY') + " - " + moment(skiarea["OperationSchedule[0].Stop"]).format('MM/DD/YYYY') + '</div>';
        //BaseText
        popupContSkiArea += '<div>' + skiarea["Detail." + this.propLanguage + ".BaseText"] + '</div>';
      }
      popupContSkiArea += '</div>';

      let popupskiarea = L.popup().setContent(popupContSkiArea);

      let marker = L.marker(posskiarea, {
        icon: iconskiarea,
        riseOnHover: true,
        zIndexOffset: 1000
      }).addTo(this.map).bindPopup(popupskiarea);

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
