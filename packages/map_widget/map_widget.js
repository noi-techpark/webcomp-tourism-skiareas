import { html, LitElement } from 'lit-element';
import L from 'leaflet';
import leaflet_mrkcls from 'leaflet.markercluster';
import style__leaflet from 'leaflet/dist/leaflet.css';
import style__markercluster from 'leaflet.markercluster/dist/MarkerCluster.css';
import style from './scss/main.scss';
import { getStyle, rainbow } from './utils.js';
import { fetchActivities,fetchSkiAreas } from './api/api.js';
import moment from 'moment';
//import L2 from 'leaflet-gpx';

class MapWidget extends LitElement {

  static get properties() {
    return {
      propStationTypes: {
        type: String,
        attribute: 'station-types'
      },
      propDomain: {
        type: String,
        attribute: 'domain'
      },
      propLanguage: {
        type: String,
        attribute: 'language'
      }
    };
  }

  constructor() {
    super();

    /* Map configuration */
    this.map_center = [46.479, 11.331];
    this.map_zoom = 9;
    this.map_layer = "https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png";
    this.map_attribution = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attribution">CARTO</a>';

    //OSM
    // this.map_layer = "http://a.tile.openstreetmap.org/{z}/{x}/{y}.png";
    // this.map_attribution = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>';        

    //OA MAP needs OA JS


    /* Internationalization */
    this.language_default = 'en';
    this.language = 'de';

    /* Data fetched from Open Data Hub */
    this.nodes = [];
    this.stationTypes = {};

    /* Requests */
    //this.fetchStations = fetchStations.bind(this);
    this.fetchActivities = fetchActivities.bind(this);
    this.fetchSkiAreas = fetchSkiAreas.bind(this);
  }

  async initializeMap() {
    let root = this.shadowRoot;
    let mapref = root.getElementById('map');

    this.map = L.map(mapref, {
      zoomControl: false
    }).setView(this.map_center, this.map_zoom);

    L.tileLayer(this.map_layer, {
      attribution: this.map_attribution
    }).addTo(this.map);
  }

  async drawMap() {

    let columns_layer_array = [];

    if(this.propDomain == "mobility"){
      await this.fetchStations(this.propStationTypes);

      this.nodes.map(station => {

        if (! (station.stype in this.stationTypes)) {
          let cnt = Object.keys(this.stationTypes).length
          this.stationTypes[station.stype] = rainbow(4000, Math.random() * 4000);
        }

        const pos = [
          station.scoordinate.y,
          station.scoordinate.x
        ];

        let fillChar = station.pcode ? '#' : '&nbsp;';

        let icon = L.divIcon({
          html: '<div class="marker"><div style="background-color: ' + this.stationTypes[station.stype] + '">' + fillChar + '</div></div>',
          iconSize: L.point(25, 25)
        });

        let popupCont = '<div class="popup"><b>' + station.sname + '</b><br /><i>' + station.stype + '</i>';
        popupCont += '<table>';
        Object.keys(station.smetadata).forEach(key => {
          let value = station.smetadata[key];
          if (value) {
            popupCont += '<tr>';
            popupCont += '<td>' + key + '</td>';
            if (value instanceof Object) {
              let act_value = value[this.language];
              if (typeof act_value === 'undefined') {
                act_value = value[this.language_default];
              }
              if (typeof act_value === 'undefined') {
                act_value = '<pre style="background-color: lightgray">' + JSON.stringify(value, null, 2) + '</pre>';
              }
              popupCont += '<td><div class="popupdiv">' + act_value + '</div></td>';
            } else {
              popupCont += '<td>' + value + '</td>';
            }
            popupCont += '</tr>';
          }
        });
        popupCont += '</table></div>';

        let popup = L.popup().setContent(popupCont);

        let marker = L.marker(pos, {
          icon: icon,
        }).bindPopup(popup);

        columns_layer_array.push(marker);
      });
    }

    if(this.propDomain == "tourism")
    {
      await this.fetchActivities(this.propStationTypes, this.propLanguage);

      this.nodes.map(activity => {

        if(activity.GpsInfo && activity.GpsInfo.length > 0)
        {

          if (! (activity.Type in this.stationTypes)) {
            let cnt = Object.keys(this.stationTypes).length
            this.stationTypes[activity.Type] = rainbow(40000, Math.random() * 40000);
          }

          var markerlatlng = {};
          markerlatlng.itemcount = activity.GpsInfo.length;
          markerlatlng.items = {};
          markerlatlng.items.opened = "green";
          markerlatlng.items.elements = [];

          //Sort activityGpsInfo by Talstation, Mittelstation, Bergstation
          var gpsinfosorted = [];

          if(activity.GpsInfo.find(x => x.Gpstype == "Talstation"))
              gpsinfosorted.push(activity.GpsInfo.find(x => x.Gpstype == "Talstation"));
          if(activity.GpsInfo.find(x => x.Gpstype == "Mittelstation"))
              gpsinfosorted.push(activity.GpsInfo.find(x => x.Gpstype == "Mittelstation"));
          if(activity.GpsInfo.find(x => x.Gpstype == "Bergstation"))
              gpsinfosorted.push(activity.GpsInfo.find(x => x.Gpstype == "Bergstation"));

          var activitysubtype = "";

          if(activity.SubType == "Seilbahn")
            activitysubtype = "icon-seilbahn";
          else if(activity.SubType == "Standseilbahn/Zahnradbahn")
            activitysubtype = "icon-zahnradbahn";
          else if(activity.SubType == "Skilift")
            activitysubtype = "icon-skilift";
          else if(activity.SubType == "Umlaufbahn")
            activitysubtype = "icon-umlaufbahn";
          else if(activity.SubType == "Kabinenbahn")
            activitysubtype = "icon-kabinenbahn";
          else if(activity.SubType == "Sessellift")
            activitysubtype = "icon-sessellift";
          else
            activitysubtype = "icon-sessellift";

          let fillChar = ''; //'<span class="icon icon-sessellift">test</span>'; //station.pcode ? '#' : '&nbsp;';

          let icon = L.divIcon({
            html: '<div class="marker"><div style="background-color: white">' + fillChar + '</div></div>',
            //html: '<div class="marker"><div style="background-color: ' + this.stationTypes[activity.Type] + '">' + fillChar + '</div></div>',
            iconSize: L.point(17, 17)
          });

          var opened = '<span style="background-color:green">Geöffnet</span>';
          if(activity.IsOpen == false)
          {
            opened = '<span style="background-color:red">Geschlossen</span>';                
            markerlatlng.items.opened = "red";
          }     

          Object.keys(gpsinfosorted).forEach(key => {

            var pos = [
              gpsinfosorted[key].Latitude,
              gpsinfosorted[key].Longitude
            ];

            let popupCont = '<div class="popup"><b>' + activity["Detail." + this.propLanguage + ".Title"] + '</b><br /><i>' + gpsinfosorted[key].Gpstype + '</i>';
            popupCont += '<table>';
            popupCont += '<tr>';
            popupCont += '<td colspan="2">' + activity.Type + '</td>';
            popupCont += '</tr>';            
            popupCont += '<tr>';
            popupCont += '<td>' + '<span class="icon ' + activitysubtype +'"></span>' + '</td>';
            popupCont += '<td>' + activity.SubType + '</td>';
            popupCont += '</tr>';
            popupCont += '<tr>';
            popupCont += '<td colspan="2">' + opened + '</td>';
            popupCont += '</tr>';
            if(activity["Detail." + this.propLanguage + ".BaseText"] != null)
            {
              popupCont += '<tr>';
              popupCont += '<td colspan="2">' + activity["Detail." + this.propLanguage + ".BaseText"] + '</td>';
              popupCont += '</tr>';
            }
            popupCont += '</table></div>';

            let popup = L.popup().setContent(popupCont);

            let marker = L.marker(pos, {
              icon: icon,
            }).bindPopup(popup);

            columns_layer_array.push(marker);

            markerlatlng.items.elements.push(marker.getLatLng());

            //Gps Track on Map
            // if(activity.GpsTrack && activity.GpsTrack.length > 0)
            // {                  
            //   Object.keys(activity.GpsTrack).forEach(key => {
            //     if(activity.GpsTrack[key].Type == "detailed")
            //     {
            //         var url = activity.GpsTrack[key].GpxTrackUrl.replace('https://lcs.lts.it/downloads/gpx/', 'https://tourism.opendatahub.bz.it/api/Activity/Gpx/');;

            //         let gpx = new L2.GPX(url, {
            //               async: true,
            //               gpx_options: { parseElements: 'track' }
            //               // marker_options: {
            //               //     startIconUrl: '../Content/images/pin-icon-start.png',
            //               //     endIconUrl: '../Content/images/pin-icon-end.png',
            //               //     shadowUrl: '../Content/images/pin-shadow.png'
            //               // }
            //           }).on('loaded', function (e) {
            //               //map.fitBounds(e.target.getBounds());
            //           }).addTo(this.map);
            //     }
            //   });
            // }

          });
          if(markerlatlng.itemcount > 1){

            for (var i = 1; i < markerlatlng.itemcount; i++) {

              let popupLineCont = '<div class="popup"><b>' + activity["Detail." + this.propLanguage + ".Title"] + '</b><br />';
              popupLineCont += '<table>';
              popupLineCont += '<tr>';
              popupLineCont += '<td colspan="2">' + activity.Type + '</td>';
              popupLineCont += '</tr>';            
              popupLineCont += '<tr>';
              popupLineCont += '<td>' + '<span class="icon ' + activitysubtype +'"></span>' + '</td>';
              popupLineCont += '<td>' + activity.SubType + '</td>';
              popupLineCont += '</tr>';
              popupLineCont += '<tr>';
              popupLineCont += '<td colspan="2">' + opened + '</td>';
              popupLineCont += '</tr>';              
              popupLineCont += '</table></div>';

              let popupline = L.popup().setContent(popupLineCont);


              var polyline = L.polyline(markerlatlng.items.elements.slice(i-1, i + 1), {
                color: markerlatlng.items.opened,
                opacity: 0.5,
                smoothFactor: 1 
              }).addTo(this.map).bindPopup(popupline);

              //polyline.on('mouseover', polyline.bindPopup(popupline));
              polyline.on('mouseover', function (e) {
                this.openPopup();
              });
              polyline.on('mouseout', function (e) {
                  this.closePopup();
              });
            }            
          }
            
        }
      });
      //Getting Skiareas
      await this.fetchSkiAreas(this.propLanguage);

      this.nodes.map(skiarea => {

        const posskiarea = [
          skiarea.Latitude,
          skiarea.Longitude
        ];

        // let iconskiarea = L.divIcon({
        //   html: '<div class="marker"><div style="background-color: red"></div></div>',          
        //   iconSize: L.point(17, 17)
        // });

        let iconskiarea = new L.Icon({
          iconUrl: 'skiarea48.png',
          iconSize: L.point(32, 32),
          opacity:0.6
        });

        let popupContSkiArea = '<div class="popup"><b>' + skiarea["Detail." + this.propLanguage + ".Title"] + '</b><br /><i>' + skiarea["SkiRegionName." + this.propLanguage] + '</i>';
        popupContSkiArea += '<table>';
        if(skiarea["Detail." + this.propLanguage + ".BaseText"] != null)
        {
           //Opening
           popupContSkiArea += '<tr>';
           popupContSkiArea += '<td>' + "Geöffnet von: " + moment(skiarea["OperationSchedule[0].Start"]).format('MM/DD/YYYY') + " bis: " + moment(skiarea["OperationSchedule[0].Stop"]).format('MM/DD/YYYY') + '</td>';
           popupContSkiArea += '</tr>';
           //BaseText
          popupContSkiArea += '<tr>';
          popupContSkiArea += '<td>' + skiarea["Detail." + this.propLanguage + ".BaseText"] + '</td>';
          popupContSkiArea += '</tr>';         
        }
        popupContSkiArea += '</table></div>';

        let popupskiarea = L.popup().setContent(popupContSkiArea);

        let marker = L.marker(posskiarea, {
          icon: iconskiarea,
        }).addTo(this.map).bindPopup(popupskiarea);

      });
    }

    this.visibleNodes = columns_layer_array.length;
    let columns_layer = L.layerGroup(columns_layer_array, {});

    /** Prepare the cluster group for station markers */
    this.layer_columns = new leaflet_mrkcls.MarkerClusterGroup({
      showCoverageOnHover: false,
      chunkedLoading: true,
      disableClusteringAtZoom: 13,
      iconCreateFunction: function(cluster) {
        return L.divIcon({
          html: '<div class="marker_cluster__marker">' + parseInt(cluster.getChildCount() / 2) + '</div>',
          iconSize: L.point(32, 32)
        });
      }
    });
    /** Add maker layer in the cluster group */
    this.layer_columns.addLayer(columns_layer);
    /** Add the cluster group to the map */
    this.map.addLayer(this.layer_columns);

  }

  async firstUpdated() {
    this.initializeMap();
    this.drawMap();
  }

  render() {
    return html`
      <style>
        ${getStyle(style__markercluster)}
        ${getStyle(style__leaflet)}
        ${getStyle(style)}
      </style>
      <div id="map_widget">
        <div id="map" class="map"></div>
      </div>
    `;
  }
}

if (!window.customElements.get('map-widget')) {
  window.customElements.define('map-widget', MapWidget);
}
