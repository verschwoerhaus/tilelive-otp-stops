# Tilelive provider for public transport stops

## Requirements

- Tessera
 -  Mapnik is a requirement for tessera
- OpenTripPlanner server (v. 0.20.0 or above)

## Stand-alone installation

    git clone https://github.com/HSLdevcom/tilelive-otp-stops
    brew install mapnik (for OS X)
    apt-get install mapnik (for Debian based Linux distros)
    npm install tessera
    
## Running stand-alone

    node_modules/.bin/tessera <Tessera options> otpstops://<path to otp-router>/index/graphql -r `pwd`

