const mqtt = require("mqtt");

const config = require("./config");
const logger = require("./logger");

let mqttClient;
let mqttConnected = false;

const mqttUri = "mqtt://" + config.get("mqtt.host");
const topicPrefix = config.get("mqtt.topic_prefix");
const handlers = {};

exports.start = () => {
  mqttClient = mqtt.connect(mqttUri);

  mqttClient.on("connect", function() {
    logger.info("MQTT connected");
    mqttConnected = true;
  });

  mqttClient.on("close", console.log);
  mqttClient.on("offline", console.log);
  mqttClient.on("message", (topic, payload) => {
    const handler = handlers[topic];
    handler(topic, payload);
  });
  // mqttClient.on('error', console.error);
};

exports.emit = (chromecast, event, data) => {
  if (!mqttConnected) return;

  const topic = `${topicPrefix}/${chromecast.id}/${event}`;

  mqttClient.publish(topic, JSON.stringify(data));
  logger.info(`Publish: ${topic} ${JSON.stringify(data)}`);
};

exports.onDevice = (chromecast, handler) => {
  const { id } = chromecast;
  const deviceSetTopic = `${topicPrefix}/set/${id}/`;

  const handlerWrapper = (topic, payload) => {
    const shortTopic = topic.replace(deviceSetTopic, "");
    const text = payload.toString();
    handler(shortTopic, text && JSON.parse(payload.toString()));
  };

  ["volup", "voldown", "play", "pause"].forEach(e => {
    const topic = deviceSetTopic + e;
    handlers[topic] = handlerWrapper;
    mqttClient.subscribe(topic);
  });
};
