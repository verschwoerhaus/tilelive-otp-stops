"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');
const zlib = require('zlib');


const query = `
  query stops{
    stops{
      gtfsId
      name
      code
      platformCode
      lat
      lon
      locationType
      parentStation{
        gtfsId
      }
      patterns{
        headsign
        route{
          type
          shortName
        }
      }
    }
  }`;

class GeoJSONSource {
  constructor(uri, callback){
    uri.protocol = "http:"
    request({
      url: uri,
      body: query,
      maxAttempts: 120,
      retryDelay: 30000,
      method: 'POST',
      headers: {
        'Content-Type': 'application/graphql'
      }
    }, function (err, res, body){
      if (err){
        console.log(err)
        callback(err);
        return;
      }
      const geoJSON = {type: "FeatureCollection", features: JSON.parse(body).data.stops.map(stop => ({
        type: "Feature",
        geometry: {type: "Point", coordinates: [stop.lon, stop.lat]},
        properties: {
          gtfsId: stop.gtfsId,
          name: stop.name,
          code: stop.code,
          platform: stop.platformCode,
          parentStation: stop.parentStation == null ? null : stop.parentStation.gtfsId,
          type: stop.patterns == null ? null : [...new Set(stop.patterns.map(pattern => pattern.route.type))].join(","),
          patterns: stop.patterns == null ? null : JSON.stringify(stop.patterns.map(pattern => ({
            headsign: pattern.headsign,
            type: pattern.route.type,
            shortName: pattern.route.shortName
          })))
        }
      }))}

      this.tileIndex = geojsonVt(geoJSON, {maxZoom: 20, buffer: 512}); //TODO: this should be configurable
      callback(null, this)
    }.bind(this));
  };

  getTile(z, x, y, callback){
    let tile = this.tileIndex.getTile(z, x, y)

    if (tile === null){
      tile = {features: []}
    }

    zlib.gzip(vtPbf.fromGeojsonVt({stops: tile}), function (err, buffer) {
      if (err){
        callback(err);
        return;
      }

      callback(null, buffer, {"content-encoding": "gzip"})
    })
  }

  getInfo(callback){
    callback(null, {
      format: "pbf",
      maxzoom: 20,
      minzoom: 0,
      scheme: "tms",
      vector_layers: [{
        description: "",
        id: "stops"
      }]
    })
  }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
  tilelive.protocols['otpstops:'] = GeoJSONSource
}
