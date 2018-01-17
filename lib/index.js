const mqtt = require('./mqtt');
const config = require('./config');
const chromecast = require('./chromecast');

mqtt.start();

const devices = config.get('devices');

devices.forEach(d => {
  chromecast.monitor(d, mqtt.emit);
});
