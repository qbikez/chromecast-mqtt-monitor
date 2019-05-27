const DeviceMonitor = require("castv2-device-monitor").DeviceMonitor;
const EVENT_NAMES = [
  "powerState",
  "playState",
  "application",
  "media",
  "volume"
];

exports.monitor = (chromecast, callback) => {
  const dm = new DeviceMonitor(chromecast.name);

  EVENT_NAMES.forEach(eventName => {
    dm.on(eventName, data => callback(chromecast, eventName, data));
  });

  return dm;
};
