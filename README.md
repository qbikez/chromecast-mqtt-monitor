# chromecast-mqtt-monitor
Monitors one or more Chromecasts and publishes activity to MQTT

## Breaking Changes

v2.0.0 now uses mqtt-usvc, thus the way in which config is handled has changed.

## Configuration

Example config file:

```yml
mqtt:
  uri: "mqtt://localhost"
  prefix: "chromecast"
service:
  devices:
    - id: "living-room"
      name: "Living Room Chromecast"
    - id: "study"
      name: "Study Chromecast"
```

The device `id` is included in the MQTT topic path. The device `name` is used to discover the Chromecast on the local network.

You need to specify which Chromecast devices to monitor (by name). It won't automatically monitor them for you.

## Launching

It is intended this be installed globally and then run with a config file provided, eg:

```
npm i -g chromecast-mqtt-monitor
CONFIG_FILE=/path/to/config.yml chromecast-mqtt-monitor
```

If launching with systemd or similar make sure the config file env var is included.

If running on Raspbian you will need:

```
sudo apt-get install libavahi-compat-libdnssd-dev
```

## MQTT Events Emitted

All events are emitted under `{mqtt.prefix}/status`, for example `chromecast/status`.

Emits `powerState`, `application`, `volume`, `playState`, `media`.

Eg: `chromecast/status/playState`

Payload contains JSON stringified data

## MQTT Events Handled (Inbound)

All inbound events are received under `{mqtt.prefix}/set`, for example `chromecast/set`.

Handles `pause`, `play`, `stop`, `volume`, `volup`, `voldown`.

Only `volume` accepts a payload, being a number between `0` and `1`, where 1 is 100% volume.
