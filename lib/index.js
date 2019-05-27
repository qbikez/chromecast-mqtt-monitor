const mqtt = require("./mqtt");
const config = require("./config");
const chromecast = require("./chromecast");

mqtt.start();

const devices = config.get("devices");

devices.forEach(d => {
  const device = chromecast.monitor(d, mqtt.emit);

  mqtt.onDevice(d, (event, payload) => {
    switch (event) {
      case "volup":
        device.volumeUp();
        break;
      case "voldn":
        device.volumeDown();
        break;
      case "pause":
        device.pauseDevice();
        break;
      case "play":
        device.playDevice();
        break;
      default:
        console.log("Unknown events", event, payload);
        break;
    }
  });
});
