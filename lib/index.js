const mqtt = require("./mqtt");
const config = require("./config");
const chromecast = require("./chromecast");

mqtt.start();

const devices = config.get("devices");

devices.forEach(d => {
  const device = chromecast.monitor(d, mqtt.emit);

  mqtt.onDevice(d, (event, payload) => {
    console.log(event, payload);
  });
});
