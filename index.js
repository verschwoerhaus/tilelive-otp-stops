"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');
const zlib = require('zlib');
const _ = require('lodash')

Array.prototype.flatMap = function(lambda) {
  return [].concat.apply([],this.map(lambda));
};

Array.prototype.uniq = function() {
  return _.uniqWith(this, _.isEqual)
};

Array.prototype.last = function() {
  return _.last(this)
};

const getTileIndex = (url, query, map, callback) => {
  request({
    url: url,
    body: query,
    maxAttempts: 120,
    retryDelay: 30000,
    method: 'POST',
    headers: {
      'Content-Type': 'application/graphql',
      'OTPTimeout': '60000',
      'OTPMaxResolves': '100000000'
    }
  }, function (err, res, body){
    if (err){
      console.log(err)
      callback(err);
      return;
    }
    callback(null, geojsonVt(map(JSON.parse(body)), {
      maxZoom: 20,
      buffer: 1024,
    })); //TODO: this should be configurable)
  })
}

const stopQuery = `
  query stops {
    stops{
      gtfsId
      name
      code
      platformCode
      lat
      lon
      locationType
      parentStation {
        gtfsId
      }
      patterns {
        headsign
        route {
          mode
          shortName
        }
      }
    }
  }
`;

const stationQuery = `
  query stations{
    stations{
      gtfsId
      name
      lat
      lon
      locationType
      stops {
        gtfsId
        patterns {
          route {
            mode
            shortName
          }
        }
      }
    }
  }
`;

const stopMapper = data => ({
  type: "FeatureCollection",
  features: data.data.stops.map(stop => ({
    type: "Feature",
    geometry: {type: "Point", coordinates: [stop.lon, stop.lat]},
    properties: {
      gtfsId: stop.gtfsId,
      name: stop.name,
      code: stop.code,
      platform: stop.platformCode,
      parentStation: stop.parentStation == null ? null : stop.parentStation.gtfsId,
      type: stop.patterns == null ? null : stop.patterns.map(pattern => pattern.route.mode).uniq().sort().last(),
      patterns: stop.patterns == null ? null : JSON.stringify(stop.patterns.map(pattern => ({
        headsign: pattern.headsign,
        type: pattern.route.mode,
        shortName: pattern.route.shortName,
      })))
    }
  }))
})

const stationMapper = data => ({
  type: "FeatureCollection",
  features: data.data.stations.map(station => ({
    type: "Feature",
    geometry: {type: "Point", coordinates: [station.lon, station.lat]},
    properties: {
      gtfsId: station.gtfsId,
      name: station.name,
      type: Array.from(new Set(station.stops.flatMap(stop => stop.patterns.flatMap(pattern => pattern.route.mode)))).sort().last(),
      stops: JSON.stringify(station.stops.map(stop => stop.gtfsId)),
      routes: JSON.stringify(station.stops.flatMap(stop => stop.patterns.flatMap(pattern => pattern.route)).uniq()),
    }
  }))
})


class GeoJSONSource {
  constructor(uri, callback){
    uri.protocol = "http:"
    getTileIndex(uri, stopQuery, stopMapper, (err, stopTileIndex) => {
      if (err){
        callback(err);
        return;
      }
      this.stopTileIndex = stopTileIndex;
      getTileIndex(uri, stationQuery, stationMapper, (err, stationTileIndex) => {
        if (err){
          callback(err);
          return;
        }
        this.stationTileIndex = stationTileIndex;
        console.log("stops loaded")
        callback(null, this);
      })
    })
  };


  getTile(z, x, y, callback){
    let stopTile = this.stopTileIndex.getTile(z, x, y)
    let stationTile = this.stationTileIndex.getTile(z, x, y)

    if (stopTile === null){
      stopTile = {features: []}
    }

    if (stationTile === null){
      stationTile = {features: []}
    }

    const data = Buffer.from(vtPbf.fromGeojsonVt({stops: stopTile, stations: stationTile}));

    zlib.gzip(data, function (err, buffer) {
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
      vector_layers: [{
        description: "",
        id: "stops"
      },
      {
        description: "",
        id: "stations"
      }]
    })
  }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
  tilelive.protocols['otpstops:'] = GeoJSONSource
}
