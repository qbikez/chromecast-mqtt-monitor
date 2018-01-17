const { join } = require('path');
module.exports = require('@loke/config').create('chromecast-mqtt-monitor', { appPath: join(__dirname, '/../') });
