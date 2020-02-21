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
      propTypes: {
        type: String,
        attribute: 'types'
      },
      propDomain: {
        type: String,
        attribute: 'domain'
      },
      propLanguage: {
        type: String,
        attribute: 'language'
      },
      propCenterMap: {
        type: String,
        attribute: 'centermap'
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
    // this.language_default = 'en';
    // this.language = 'de';

    /* Data fetched from Open Data Hub */
    this.nodes = [];
    this.types = {};    

    /* Requests */
    //this.fetchStations = fetchStations.bind(this);
    this.fetchActivities = fetchActivities.bind(this);
    this.fetchSkiAreas = fetchSkiAreas.bind(this);
  }

  async initializeMap() {
    let root = this.shadowRoot;
    let mapref = root.getElementById('map');

    if(this.propCenterMap){
      var splittedgps = this.propCenterMap.split(',');
      this.map_center =  [parseFloat(splittedgps[0]),parseFloat(splittedgps[1])]
      this.map_zoom = parseInt(splittedgps[2]);      
    }

    this.map = L.map(mapref, {
      zoomControl: false
    }).setView(this.map_center, this.map_zoom);

    L.tileLayer(this.map_layer, {
      attribution: this.map_attribution
    }).addTo(this.map);
  }

  async drawMap() {

    let columns_layer_array = [];
    
    console.log(this.propCenterMap);
    console.log(this.propLanguage);
    console.log(this.propDomain);


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
      await this.fetchActivities(this.propTypes, this.propLanguage);

      this.nodes.map(activity => {

        if(activity.GpsInfo && activity.GpsInfo.length > 0)
        {

          // if (! (activity.Type in this.types)) {
          //   let cnt = Object.keys(this.types).length
          //   this.types[activity.Type] = rainbow(40000, Math.random() * 40000);
          // }

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
            //html: '<div class="marker"><div style="background-color: ' + this.types[activity.Type] + '">' + fillChar + '</div></div>',
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
            popupCont += '<div>' + activity.Type + '</div>';
            popupCont += '<div>' + '<span class="icon ' + activitysubtype +'"></span>' + '</div>';
            popupCont += '<div>' + activity.SubType + '</div>';           
            popupCont += '<div>' + opened + '</div>';            

            if(activity["Detail." + this.propLanguage + ".BaseText"] != null)
            {              
              popupCont += '<div>' + activity["Detail." + this.propLanguage + ".BaseText"] + '</div>';             
            }
            popupCont += '</div>';

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
              //popupLineCont += '<table>';
              //popupLineCont += '<tr>';
              popupLineCont += '<div>' + activity.Type + '</div><br />';
              //popupLineCont += '</tr>';            
              //popupLineCont += '<tr>';
              popupLineCont += '<div>' + '<span class="icon ' + activitysubtype +'"></span>' + '</div>';
              popupLineCont += '<div>' + activity.SubType + '</div><br />';
              //popupLineCont += '</tr>';
              //popupLineCont += '<tr>';
              popupLineCont += '<div>' + opened + '</div>';
              //popupLineCont += '</tr>';              
              popupLineCont += '</div>';

              let popupline = L.popup().setContent(popupLineCont);


              var polyline = L.polyline(markerlatlng.items.elements.slice(i-1, i + 1), {
                color: markerlatlng.items.opened,
                opacity: 0.5,
                smoothFactor: 1,
                weight: 6
              }).addTo(this.map).bindPopup(popupline);

              //polyline.on('mouseover', polyline.bindPopup(popupline));
              polyline.on('mouseover', function (e) {
                this.setStyle({
                  weight: 10
                });
                this.openPopup();
              });
              polyline.on('mouseout', function (e) {
                this.setStyle({
                  weight: 6
                });  
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

        var base64icon = "data:image/png;base64,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";

        let iconskiarea = new L.Icon({
          iconUrl: base64icon,
          iconSize: L.point(48, 48),
          opacity:0.8
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
