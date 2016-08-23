# Tilelive provider for public transport stops

## Requirements

- Tessera
- OpenTripPlanner server (v. 0.20.0 or above)

## Stand-alone installation

    git clone https://github.com/HSLdevcom/tilelive-otp-stops
    npm isntall tessera
    
## Running stand-alone

    node_modules/.bin/tessera <Tessera options> otpstops://<path to otp-router>/index/graphql -r `pwd`

