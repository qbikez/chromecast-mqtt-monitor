#!/usr/bin/env node
"use strict";

const mqttusvc = require("mqtt-usvc");
const { DeviceMonitor } = require("castv2-device-monitor");

const EVENT_NAMES = [
  "powerState",
  "playState",
  "application",
  "media",
  "volume",
];

async function main() {
  const service = await mqttusvc.create({
    mqtt: {
      uri: "mqtt://localhost",
      prefix: "chromecast",
    },
    service: {
      devices: [{ id: "living-room-speakers", name: "Living Room speakers" }],
    },
  });

  const { devices } = service.config;
  if (!devices || !devices.length) {
    console.error("No devices");
    process.exit(1);
  }

  /** @type {Record<string, DeviceMonitor>} */
  const deviceMap = devices.reduce((deviceMap, device) => {
    const dm = new DeviceMonitor(device.name);

    EVENT_NAMES.forEach((eventName) => {
      dm.on(eventName, (data) => {
        console.info("%s/%s -> %j", device.id, eventName, data);
        service.send(`~/status/${device.id}/${eventName}`, data);
      });
    });
    dm.on("error", (err) => {
      console.warn(
        "Chromecast error id=%s name=%j msg=%j",
        device.id,
        device.name,
        err.message
      );
    });
    setTimeout(() => dm.setVolume(0.5), 2000);

    console.info("Loaded Chromecast id=%s name=%j", device.id, device.name);

    deviceMap[device.id] = dm;
    return deviceMap;
  }, {});

  const handlers = {
    volume: async (deviceId, data) => {
      console.info("=> vol device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.setVolume(data);
    },
    volup: async (deviceId, data) => {
      console.info("=> volup device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.volumeUp();
    },
    voldown: async (deviceId, data) => {
      console.info("=> voldown device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.volumeDown();
    },
    play: async (deviceId, data) => {
      console.info("=> pause device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.playDevice();
    },
    pause: async (deviceId, data) => {
      console.info("=> play device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.pauseDevice();
    },
    stop: async (deviceId, data) => {
      console.info("=> stop device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.stopDevice();
    },
  };

  service.on("message", async (topic, data) => {
    try {
      console.log("message: topic=%s", topic);
      if (!topic.startsWith("~/set/")) return;

      const [, , deviceId, action] = topic.split("/");
      const handler = handlers[action];
      if (!handler) {
        throw new Error(action + " is not supported");
      }

      await handler(deviceId, data);
    } catch (err) {
      console.error(String(err));
    }
  });

  service.subscribe("~/set/#");
}

main().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});
