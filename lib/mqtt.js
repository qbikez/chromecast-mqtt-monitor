const mqtt = require('mqtt');

const config = require('./config');
const logger = require('./logger');

let mqttClient;
let mqttConnected = false;

const mqttUri = 'mqtt://' + config.get('mqtt.host');
const topicPrefix = config.get('mqtt.topic_prefix');

exports.start = () => {
  mqttClient  = mqtt.connect(mqttUri);

  mqttClient.on('connect', function () {
    logger.info('MQTT connected');
    mqttConnected = true;
  });

  mqttClient.on('close', console.log);
  mqttClient.on('offline', console.log);
  // mqttClient.on('error', console.error);
};

exports.emit = (chromecast, event, data) => {
  if (!mqttConnected) return;

  const topic = `${topicPrefix}.${chromecast.id}.${event}`;

  mqttClient.publish(topic, JSON.stringify(data));
  logger.info(`Publish: ${topic} ${JSON.stringify(data)}`);
};
