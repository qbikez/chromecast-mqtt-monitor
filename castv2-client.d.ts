declare module "castv2-client" {
  import { EventEmitter } from "events";

  type YoutubeMusicAppId = "2DB7CC49";
  type SpotifyAppId = "CC32E753";
  type RepeatMode =
    | "REPEAT_OFF"
    | "REPEAT_ALL"
    | "REPEAT_SINGLE"
    | "REPEAT_ALL_AND_SHUFFLE";

  interface Session {
    appId: string; // eg 2DB7CC49, CC32E753
    appType: "WEB";
    displayName: string; // eg 'YouTube Music' 'Spotify'
    iconUrl: string;
    statusText: string; // eg 'YouTube Music' 'Casting: Singularity'

    transportId: string;
    sessionId: string;

    isIdleScreen: boolean;
    launchedFromCloud: boolean;

    namespaces: { name: string }[];
    universalAppId: string;
  }

  interface ClientStatus {
    volume: {
      controlType: "master";
      level: number; // 0 - 1
      muted: boolean;
      stepInterval: number;
    };
    userEq: {
      high_shelf: { frequency: number; gain_db: number; quality: number };
      low_shelf: { frequency: number; gain_db: number; quality: number };
      max_peaking_eqs: number;
      peaking_eqs: [];
    };
    applications: Session[];
  }

  interface VolumeStatus {
    level: number;
    muted: boolean;
  }

  interface MediaStatus {
    mediaSessionId: number;
    playbackRate: 1;
    supportedMediaCommands: number;
    volume: VolumeStatus;
    playerState: "PLAYING" | "BUFFERING" | "PAUSED" | "IDLE";
    idleReason?: "FINISHED";
    customData: { playerState: 1 | 2 };
    currentTime: number;
    repeatMode?: RepeatMode;
    media?: {
      contentId: string;
      contentType: "x-youtube/video" | "application/x-spotify.track" | string;
      customData?: {
        listId: string;
        currentIndex: number;
      };
      metadata: {
        metadataType: 3;
        title: string;
        songName?: string;
        artist: string;
        albumName: string;
        images: any[];
      };
      streamType: "BUFFERED";
      mediaCategory: "AUDIO";
      duration: number; // total seconds
    };
  }

  type NodeCallback<T> = (err: Error | null, result?: T) => void;

  class Application {
    senderId: string;
    receiverId: string;
    session: Session;
    close(): void;
  }

  interface Media {
    on(event: "status", callback: (status: MediaStatus) => void);

    // these are just proxied to MediaController
    getStatus(callback: NodeCallback<MediaStatus>);
    load(
      media,
      options: {
        autoplay?: boolean;
        currentTime?: number;
        activeTrackIds?: string[];
        repeatMode?: RepeatMode;
      },
      callback: NodeCallback<MediaStatus>
    );
    play(callback: NodeCallback<MediaStatus>);
    pause(callback: NodeCallback<MediaStatus>);
    stop(callback: NodeCallback<MediaStatus>);

    // still figuring these out
    seek(currentTime, callback);
    queueLoad(items, options, callback);
    queueInsert(items, options, callback);
    queueRemove(itemIds, options, callback);
    queueReorder(itemIds, options, callback);
    queueUpdate(items, callback);
  }

  class DefaultMediaReceiver extends Application implements Media {
    new(client: Client, session: Session): DefaultMediaReceiver;

    static APP_ID: "CC1AD845";

    on(event: "status", callback: (status: MediaStatus) => void);

    // these are just proxied to MediaController
    getStatus(callback: NodeCallback<MediaStatus>);
    load(
      media,
      options: {
        autoplay?: boolean;
        currentTime?: number;
        activeTrackIds?: string[];
        repeatMode?: RepeatMode;
      },
      callback: NodeCallback<MediaStatus>
    );
    play(callback: NodeCallback<MediaStatus>);
    pause(callback: NodeCallback<MediaStatus>);
    stop(callback: NodeCallback<MediaStatus>);

    // still figuring these out
    seek(currentTime, callback);
    queueLoad(items, options, callback);
    queueInsert(items, options, callback);
    queueRemove(itemIds, options, callback);
    queueReorder(itemIds, options, callback);
    queueUpdate(items, callback);
  }

  interface MediaControllerSession {
    mediaSessionId: number;
    playbackRate: number;
    playerState: "PLAYING";
    currentTime: number;
    supportedMediaCommands: number;
    volume: VolumeStatus;
    activeTrackIds: [];
    currentItemId: 1;
    repeatMode: RepeatMode;
  }

  class MediaController implements Media {
    currentSession: MediaControllerSession;

    on(event: "status", callback: (status: MediaStatus) => void): void;

    play(callback: NodeCallback<MediaStatus>): void;
    pause(callback: NodeCallback<MediaStatus>): void;
    stop(callback: NodeCallback<MediaStatus>): void;

    getStatus(
      callback: (err: Error | null, mediaStatus: MediaStatus) => void
    ): void;

    load(
      media,
      options: {
        autoplay?: boolean;
        currentTime?: number;
        activeTrackIds?: string[];
        repeatMode?: RepeatMode;
      },
      callback: NodeCallback<MediaStatus>
    );

    seek(currentTime: number, callback: NodeCallback<unknown>);

    /**
     * Load a queue of items to play (playlist)
     * See https://developers.google.com/cast/docs/reference/chrome/chrome.cast.media.QueueLoadRequest
     */
    queueLoad(
      items,
      options: {
        startIndex?: number;
        currentTime?: number;
        repeatMode?:
          | "REPEAT_OFF"
          | "REPEAT_ALL"
          | "REPEAT_SINGLE"
          | "REPEAT_ALL_AND_SHUFFLE";
      },
      callback: NodeCallback<MediaStatus>
    );

    queueInsert(
      items,
      options: {
        /** Item ID to play after this request or keep same item if undefined */
        currentItemId: number;
        /** Item Index to play after this request or keep same item if undefined */
        currentItemIndex: number;
        /** Seek in seconds for current stream */
        currentTime: number;
        /** ID or append if undefined */
        insertBefore: number;
      },
      callback: NodeCallback<unknown>
    );

    queueRemove(itemIds, options, callback);
    //     if(typeof options === 'function' || typeof options === 'undefined') {
    //       callback = options;
    //       options = {};
    //     }

    //     var data = {
    //       type:             'QUEUE_REMOVE',
    //       currentItemId:    options.currentItemId,
    //       currentTime:      options.currentTime,
    //       itemIds:          itemIds
    //     };

    //     this.sessionRequest(data, callback);
    //   };

    queueReorder(itemIds, options, callback);
    //     if(typeof options === 'function' || typeof options === 'undefined') {
    //       callback = options;
    //       options = {};
    //     }

    //     var data = {
    //       type:             'QUEUE_REORDER',
    //       currentItemId:    options.currentItemId,
    //       currentTime:      options.currentTime,
    //       insertBefore:     options.insertBefore,
    //       itemIds:          itemIds
    //     };

    //     this.sessionRequest(data, callback);
    //   };

    queueUpdate(items, options, callback);
    //     if(typeof options === 'function' || typeof options === 'undefined') {
    //       callback = options;
    //       options = {};
    //     }

    //     var data = {
    //       type:             'QUEUE_UPDATE',
    //       currentItemId:    options.currentItemId,
    //       currentTime:      options.currentTime,
    //       jump:             options.jump,          //Skip or go back (if negative) number of items
    //       repeatMode:       options.repeatMode,
    //       items:            items
    //     };

    //     this.sessionRequest(data, callback);
    //   };
  }

  class Client {
    receiver: EventEmitter;
    heartbeat: EventEmitter;
    connection: EventEmitter;
    getStatus(
      callback: (err: Error | null, status?: ClientStatus) => void
    ): void;
    getSessions(
      callback: (err: Error | null, sessions?: Session[]) => void
    ): void;
    getAppAvailability(
      appId: string | string[],
      callback: (
        err: Error | null,
        availability?: Record<string, boolean>
      ) => void
    ): void;
    join(
      session: Session,
      /** Can be any media receiver type */
      Application: {
        new (client: Client, session: Session): DefaultMediaReceiver;
      },
      callback: (err: Error | null, application?: Application) => void
    ): void;
    launch(
      /** Can be any media receiver type */
      Application: {
        new (client: Client, session: Session): DefaultMediaReceiver;
      },
      callback: (err: Error | null, application?: Application) => void
    ): void;
    stop(
      application: { session: Session; close: () => void },
      callback: (err: Error | null, sessions?: Session[]) => void
    ): void;
    setVolume(
      volume: { level?: number; muted?: boolean },
      callback: (
        err: Error | null,
        volume?: { level?: number; muted?: boolean }
      ) => void
    ): void;
    getVolume(
      callback: (
        err: Error | null,
        volume?: { level?: number; muted?: boolean }
      ) => void
    ): void;
    on(event: "status", handler: (status: ClientStatus) => void): Client;
    on(event: "timeout", handler: () => void): Client;
    on(event: "error", handler: (err: Error) => void): Client;
    connect(
      connectionDetails: { host: string; port: number },
      callback: () => void
    ): void;
    close(): void;
  }
}
