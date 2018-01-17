const DeviceMonitor = require('castv2-device-monitor').DeviceMonitor;
const EVENT_NAMES = ['powerState', 'playState', 'application', 'media'];

exports.monitor = (chromecast, callback) => {
  const dm = new DeviceMonitor(chromecast.name);

  // dm.on('powerState', powerState => console.log('powerState', powerState))
  // dm.on('playState', playState => console.log('playState', playState))
  // dm.on('application', application => console.log('application', application))
  // dm.on('media', media => console.log('media', media))

  EVENT_NAMES.forEach(eventName => {
    dm.on(eventName, data => callback(chromecast, eventName, data));
  });
};
