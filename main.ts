#!/usr/bin/env node
import { create as createusvc } from "mqtt-usvc";
import { Chromecast } from "./chromecast";

const EVENT_NAMES = [
  "playerState",
  "casting",
  "application",
  "media",
  "volume",
  "volumeLevel",
  "volumeMuted",
  "repeatMode",
];

interface ServiceConfig {
  devices: Array<{ id: string; name: string }>;
}

async function main() {
  const service = await createusvc<ServiceConfig>();

  const { devices } = service.config;
  if (!devices || !devices.length) {
    console.error("No devices");
    process.exit(1);
  }

  const deviceMap = devices.reduce<Record<string, Chromecast>>(
    (deviceMap, device) => {
      const chromecast = new Chromecast(
        { chromecastDeviceName: device.name },
        console.log,
        () => {}
      );

      EVENT_NAMES.forEach((eventName) => {
        chromecast.on(eventName, (data) => {
          console.info("%s/%s -> %j", device.id, eventName, data);
          service.send(`~/status/${device.id}/${eventName}`, data);
        });
      });
      chromecast.on("error", (err) => {
        console.warn(
          "Chromecast error id=%s name=%j msg=%j",
          device.id,
          device.name,
          err.message
        );
      });

      console.info("Loaded Chromecast id=%s name=%j", device.id, device.name);

      deviceMap[device.id] = chromecast;
      return deviceMap;
    },
    {}
  );

  const handlers = {
    volume: async (deviceId: string, data: number) => {
      console.info("=> vol device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.setVolume(data);
    },
    volup: async (deviceId: string) => {
      console.info("=> volup device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.volumeUp();
    },
    voldown: async (deviceId: string) => {
      console.info("=> voldown device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.volumeDown();
    },
    play: async (deviceId: string) => {
      console.info("=> pause device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.play();
    },
    pause: async (deviceId: string) => {
      console.info("=> play device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.pause();
    },
    stop: async (deviceId: string) => {
      console.info("=> stop device=%s", deviceId);
      const device = deviceMap[deviceId];
      if (device) device.stop();
    },
  };

  service.on("message", async (topic, data) => {
    try {
      console.log("message: topic=%s", topic);
      if (!topic.startsWith("~/set/")) return;

      const [, , deviceId, action] = topic.split("/");
      const handler = (
        handlers as Record<
          string,
          (deviceId: string, data: unknown) => Promise<void>
        >
      )[action];
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
