// Modified from https://github.com/paolotremadio/homebridge-automation-chromecast/blob/master/index.js
/// <reference path="./castv2-client.d.ts" />

import mdns from "mdns";
import { EventEmitter } from "events";
import { promisify } from "util";
import {
  Session,
  Client,
  ClientStatus,
  DefaultMediaReceiver,
  Media,
  MediaStatus,
} from "castv2-client";

const mdnsSequence = [
  mdns.rst.DNSServiceResolve(),
  "DNSServiceGetAddrInfo" in mdns.dns_sd
    ? mdns.rst.DNSServiceGetAddrInfo()
    : mdns.rst.getaddrinfo({ families: [0] }),
  mdns.rst.makeAddressesUnique(),
];

export class Chromecast extends EventEmitter {
  private chromecastDeviceName: string;
  private chromecastIp: string | null = null;
  private chromecastPort: number | null = null;
  private isCastingStatus: boolean = false;
  private castingApplication: Session | null = null;
  private castingMedia: Media | null = null;
  private volume: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectCounter: number | null = null;
  private chromecastClient: Client | null = null;
  private dontDetectChromecast: boolean = false;
  // private mediaMetadata: null | {
  //   metadataType: 3;
  //   title: string;
  //   songName?: string | undefined;
  //   artist: string;
  //   albumName: string;
  //   images: any[];
  // } = null;

  constructor(
    config: {
      chromecastDeviceName: string;
      chromecastIp?: string;
      chromecastPort?: number;
    },
    private log = console.log,
    private debug = console.debug
  ) {
    super();

    this.log = log;
    this.chromecastDeviceName = config.chromecastDeviceName;

    this.setDefaultProperties(true);

    this.chromecastIp = config.chromecastIp || null;
    this.chromecastPort = config.chromecastPort || null;

    if (this.chromecastIp && this.chromecastPort) {
      this.dontDetectChromecast = true;
      this.clientConnect();
    } else {
      this.detectChromecast();
    }
  }

  private setDefaultProperties(
    resetIpAndPort = false,
    stopReconnecting = false
  ) {
    if (resetIpAndPort) {
      this.chromecastIp = null;
      this.chromecastPort = null;
    }

    this.resetClient();

    this.isCastingStatus = false;
    this.castingApplication = null;
    this.castingMedia = null;
    this.volume = 0;

    if (stopReconnecting) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
    }
    this.reconnectTimer = null;

    if (!this.reconnectCounter) {
      this.reconnectCounter = 0;
    }
  }

  /**
   * Use bonjour to detect Chromecast devices on the network
   */
  private detectChromecast() {
    const browser = mdns.createBrowser(mdns.tcp("googlecast"), {
      resolverSequence: mdnsSequence,
    });

    browser.on("serviceUp", (device) => {
      const txt = device.txtRecord;
      const name = txt.fn;

      if (name.toLowerCase() === this.chromecastDeviceName.toLowerCase()) {
        this.setDefaultProperties(true, true);

        const ipAddress = device.addresses[0];
        const { port } = device;

        this.chromecastIp = ipAddress;
        this.chromecastPort = port;

        // this.deviceType = txt.md || "";
        // this.deviceId = txt.id;

        this.log(
          `Chromecast found on ${this.chromecastIp}:${this.chromecastPort}`
        );

        this.clientConnect();
      }
    });

    // Restart browser every 30 minutes or so to make sure we are listening to announcements
    setTimeout(() => {
      browser.stop();

      this.clientDisconnect(false);
      this.debug("detectChromecast() - Restarting mdns browser");
      this.detectChromecast();
    }, 30 * 60 * 1000);

    this.log(
      `Searching for Chromecast device named "${this.chromecastDeviceName}"`
    );
    browser.start();
  }

  private clientError(error: Error) {
    this.log(`Chromecast client error - ${error}`);

    this.clientDisconnect(true);
  }

  private resetClient() {
    if (this.chromecastClient) {
      try {
        this.chromecastClient.close();
      } catch (e) {
        // eslint-disable-line
      }
    } else {
      this.chromecastClient = null;
    }
  }

  private clientDisconnect(reconnect: boolean) {
    this.log("Chromecast connection: disconnected");

    this.setIsCasting(false);
    this.setDefaultProperties(false, true);

    if (reconnect) {
      if (!this.dontDetectChromecast && (this.reconnectCounter || 0) > 150) {
        // Backoff after 5 minutes
        this.log(
          "Chromecast reconnection: backoff, searching again for Chromecast"
        );
        this.detectChromecast();
        return;
      }

      this.log(`Waiting before reconnecting`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectCounter = (this.reconnectCounter || 0) + 1;
        this.clientConnect();
      }, 2000 * (this.reconnectCounter || 1));
    }
  }

  private async clientConnect() {
    this.chromecastClient = new Client();

    if (!this.chromecastIp || !this.chromecastPort) return;

    const connectionDetails = {
      host: this.chromecastIp,
      port: this.chromecastPort,
    };

    this.chromecastClient
      .on("status", this.processClientStatus.bind(this))
      .on("timeout", () => this.debug("chromeCastClient - timeout"))
      .on("error", (status) => this.clientError(status));

    this.log(
      `Connecting to Chromecast on ${this.chromecastIp}:${this.chromecastPort}`
    );

    this.chromecastClient.connect(connectionDetails, () => {
      if (
        this.chromecastClient &&
        this.chromecastClient.connection &&
        this.chromecastClient.heartbeat &&
        this.chromecastClient.receiver
      ) {
        this.reconnectCounter = 0;
        this.log("Chromecast connection: connected");

        this.chromecastClient.connection
          .on("timeout", () =>
            this.debug("chromeCastClient.connection - timeout")
          )
          .on("disconnect", () => this.clientDisconnect(true));

        this.chromecastClient.heartbeat
          .on("timeout", () =>
            this.debug("chromeCastClient.heartbeat - timeout")
          )
          .on("pong", () => null);

        this.chromecastClient.receiver.on(
          "status",
          this.processClientStatus.bind(this)
        );

        // Force to detect the current status in order to initialise processClientStatus() at boot
        this.chromecastClient.getStatus((_err, status) => {
          if (status) this.processClientStatus(status);
        });
      }
    });
  }

  private processClientStatus(status: ClientStatus) {
    this.debug("processClientStatus() - Received client status", status);

    const { applications } = status;
    const currentApplication =
      applications && applications.length > 0 ? applications[0] : null;

    if (currentApplication) {
      const lastMonitoredApplicationStatusId = this.castingApplication
        ? this.castingApplication.sessionId
        : null;

      if (currentApplication.sessionId !== lastMonitoredApplicationStatusId) {
        /*
        NOTE: The castv2-client library has not been updated in a while.
        The current version of Chromecast protocol may NOT include transportId when streaming
        to a group of speakers. The transportId is same as the sessionId.
        Assigning the transportId to the sessionId makes the library works with
        group of speakers in Chromecast Audio.
         */
        currentApplication.transportId = currentApplication.sessionId;

        this.castingApplication = currentApplication;

        this.emit("application", {
          appId: currentApplication.appId,
          appType: currentApplication.appType,
          displayName: currentApplication.displayName,
        });

        try {
          this.chromecastClient?.join(
            currentApplication,
            DefaultMediaReceiver,
            (_err, _media) => {
              this.debug("processClientStatus() - New media");

              if (!_media) return;

              const media = _media as DefaultMediaReceiver;

              // Force to detect the current status in order to initialise at boot
              media.getStatus((_err, mediaStatus) => {
                if (mediaStatus) this.processMediaStatus(mediaStatus);
              });
              media.on("status", this.processMediaStatus.bind(this));
              this.castingMedia = media;
            }
          );
        } catch (e) {
          // Handle exceptions like "Cannot read property 'createChannel' of null"
          this.debug("processClientStatus() - Exception", e);
          this.clientDisconnect(true);
        }
      }
    } else {
      // TODO: also clear mediaMetadata here
      this.castingMedia = null;
      this.debug("processClientStatus() - Reset media");
    }

    // Process "Stop casting" command
    if (typeof status.applications === "undefined") {
      this.debug("processClientStatus() - Stopped casting");
      this.setIsCasting(false);
    }

    // Process volume
    if (status.volume && "level" in status.volume) {
      this.storeVolume(status.volume);
    }
  }

  private storeVolume(volume: { level: number; muted: boolean }) {
    this.volume = volume.level || 0;
    this.emit("volume", { level: volume.level, muted: volume.muted });
    this.emit("volumeLevel", volume.level);
    this.emit("volumeMuted", volume.muted);
  }

  private processMediaStatus(status: MediaStatus) {
    this.debug("processMediaStatus() - Received media status", status);

    if (status && status.playerState) {
      if (
        status.playerState === "PLAYING" ||
        status.playerState === "BUFFERING"
      ) {
        this.setIsCasting(true);
      } else {
        this.setIsCasting(false);
      }
    }

    this.emit("playerState", status.playerState);
    if (status.volume) this.storeVolume(status.volume);
    if (status.repeatMode) this.emit("repeatMode", status.repeatMode);

    if (status.media?.metadata) {
      this.setCurrentMedia(status.media?.metadata);
    }
  }

  private setIsCasting(newStatus: boolean) {
    // Update the internal state and log only if there's been a change of state
    if (newStatus !== this.isCastingStatus) {
      this.log("Chromecast is now " + newStatus ? "playing" : "stopped");
      this.isCastingStatus = Boolean(newStatus);

      this.emit("casting", this.isCastingStatus);
    }
  }

  private setCurrentMedia(metadata: {
    metadataType: 3;
    title: string;
    songName?: string | undefined;
    artist: string;
    albumName: string;
    images: any[];
  }) {
    // this.mediaMetadata = metadata;
    this.emit("media", metadata);
  }

  /**
   * Is the Chromecast currently receiving an audio/video stream?
   */
  isCasting() {
    return this.isCastingStatus;
  }

  /**
   * Set the Chromecast volume (0-1)
   */
  async setVolume(volume: number) {
    const currentValue = Math.round(this.volume);

    this.debug(
      `setVolume() - Current status: ${currentValue} - New status: ${volume}`
    );

    if (this.chromecastClient) {
      try {
        await promisify(
          this.chromecastClient.setVolume.bind(this.chromecastClient)
        )({
          level: volume,
        });
      } catch (e) {
        this.debug("setVolume() - Reported error", e);
      }
    }
  }

  async volumeUp(amount: number = 0.05) {
    await this.setVolume(this.volume + amount);
  }

  async volumeDown(amount: number = -0.05) {
    await this.setVolume(this.volume + amount);
  }

  async play() {
    const castingMedia = this.castingMedia;
    if (!castingMedia) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      castingMedia.play((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async pause() {
    const castingMedia = this.castingMedia;
    if (!castingMedia) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      castingMedia.pause((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async stop() {
    const castingMedia = this.castingMedia;
    if (!castingMedia) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      castingMedia.stop((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Start/stop the Chromecast from receiving an audio/video stream
   */
  async setCasting(on: boolean): Promise<void> {
    const currentlyCasting = this.isCastingStatus;

    this.setIsCasting(on);

    this.debug(
      `setCasting() - Current status: ${currentlyCasting} - New status: ${on}`
    );

    const castingMedia = this.castingMedia;
    if (!castingMedia) {
      return;
    }

    await new Promise<void>((resolve) => {
      if (on && !currentlyCasting) {
        this.debug("setCasting() - Play");
        castingMedia.play(() => null);
      } else if (!on && currentlyCasting) {
        this.debug("setCasting() - Stop");
        castingMedia.stop(() => null);
      }
      resolve();
    });
  }

  override toString() {
    return `Chromecast: "${this.chromecastDeviceName}" Volume: ${
      this.volume
    } Casting: ${this.isCasting()} Media: ${JSON.stringify(
      (this.castingMedia as any)?.currentSession
    )}`;
  }
}
