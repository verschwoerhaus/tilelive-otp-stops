"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const url = require('url');
const fs = require('fs');
const request = require('requestretry');

const query = `
  query stops{
    stops{
      gtfsId
      name
      lat
      lon
      locationType
      parentStation{
        gtfsId
      }
      routes{
        type
      }
    }
  }`;

class GeoJSONSource {
  constructor(uri, callback){
    uri.protocol = "http:"
    request({
      url: uri,
      body: query,
      maxAttempts: 20,
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
          parentStation: stop.parentStation == null ? null : stop.parentStation.gtfsId,
          type: stop.routes == null ? null : [...new Set(stop.routes.map(route => route.type))]
        }
      }))}

      this.tileIndex = geojsonVt(geoJSON, {maxZoom: 20}); //TODO: this should be configurable
      callback(null, this)
    }.bind(this));
  };

  getTile(z, x, y, callback){
    let tile = this.tileIndex.getTile(z, x, y)

    if (tile === null){
      tile = {features: []}
    }

    callback(null, vtPbf.fromGeojsonVt({ 'geojsonLayer': tile}), {"content-encoding": "none"})
  }

  getInfo(callback){
    callback(null, {
      format: "pbf"
    })
  }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
  tilelive.protocols['otpstops:'] = GeoJSONSource
}
