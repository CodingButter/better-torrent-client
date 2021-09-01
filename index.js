/*
[
  'addUri',
  'addTorrent',
  'getPeers',
  'addMetalink',
  'remove',
  'pause',
  'forcePause',
  'pauseAll',
  'forcePauseAll',
  'unpause',
  'unpauseAll',
  'forceRemove',
  'changePosition',
  'tellStatus',
  'getUris',
  'getFiles',
  'getServers',
  'tellActive',
  'tellWaiting',
  'tellStopped',
  'getOption',
  'changeUri',
  'changeOption',
  'getGlobalOption',
  'changeGlobalOption',
  'purgeDownloadResult',
  'removeDownloadResult',
  'getVersion',
  'getSessionInfo',
  'shutdown',
  'forceShutdown',
  'getGlobalStat',
  'saveSession',
  'system.multicall',
  'system.listMethods',
  'system.listNotifications'
]
*/
const Aria2 = require("aria2");
const Torrent = require("./torrent");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const deepMerge = require("./deep-merge");

class BetterTorrentClient {
  constructor(options) {
    const defaultPort = options.port || 6800;
    const defaults = {
      downloadDirectory: path.resolve("."),
      targetDirectory: path.resolve("."),
      aria2: {
        spawnOptions: {
          detached: true,
          shell: true,
        },
        perameters: {
          "rpc-listen-port": `${defaultPort}`,
          "always-resume": null,
          "enable-rpc": null,
          "rpc-listen-all": true,
          "rpc-allow-origin-all": null,
          "seed-time": 0,
          continue: true,
          "max-concurrent-downloads": 12,
          "max-overall-upload-limit": 0,
          "file-allocation": "none",
          "bt-stop-timeout": 100,
        },
      },
    };
    this.options = deepMerge(defaults, options);
    this.aria2 = new Aria2({
      port: this.options.aria2.perameters["rpc-listen-port"],
    });
    Torrent.config(this);
    this.torrents = [];
    this.captureEvents();
  }
  async _startAria2() {
    const _self = this;
    const aria2Options = Object.keys(_self.options.aria2.perameters).map(
      (key) => {
        const dashKey = `--${key}`;
        const value = _self.options.aria2.perameters[key];
        return value == null ? dashKey : `${dashKey}=${value}`;
      }
    );
    this.ariaProcess = spawn(
      path.resolve("./bin/aria2c"),
      aria2Options,
      this.options.aria2.spawnOptions
    );
  }

  async connect() {
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
    try {
      await this.aria2.open();
      return true;
    } catch (err) {
      if (!this.ariaProcss) this._startAria2();
      return await this.connect();
    }
  }

  async addTorrent(magnetLink, options) {
    const torrent = new Torrent(magnetLink, options);
    this.torrents.push(torrent);
    return torrent;
  }

  async getInfo() {
    const _self = this;
    return Promise.all(
      this.torrents.map(async (torrent) => {
        const torrentInfo = await torrent.getInfo();
        console.log({ torrentInfo });
        if (torrentInfo.status == "removed") {
          _self.remove(torrent);
        }
      })
    );
  }
  async remove(torrent) {
    await torrent.remove();
    this.torrents.splice(this.torrents.indexOf(torrent), 1);
    return torrent;
  }

  listTorrents() {
    return this.torrents;
  }

  getTorrentById(uuid) {
    return this.torrents.filter((torrent) => {
      console.log(torrent.following);
      return (
        torrent.uuid === uuid ||
        torrent.gid == uuid ||
        (torrent.files &&
          torrent.files.filter((file) => file.gid == uuid).length > 0) ||
        (torrent && torrent.following == uuid)
      );
    })[0];
  }
  captureEvents() {
    this.aria2.on("onBtDownloadComplete", async (gid) => {
      await this.aria2.call("purgeDownloadResult");
      this.getTorrentById(gid).moveToDestination();
    });

    this.aria2.on("onDownloadStop", async (gid) => {
      console.log("torrent was Stopped");
      const torrent = this.getTorrentById(gid);
      while (!torrent && torrent.following) {}
      if (torrent && torrent.completedLength < torrent.totalLength) {
        await _self.remove(torrent);
      } else {
        await this.aria2.call("purgeDownloadResult");
        torrent.moveToDestination();
      }
    });
  }
}

const btClient = new BetterTorrentClient({ port: 3001 });
const magnet =
  "magnet:?xt=urn:btih:06C0D76D3B5AB230FCF2584FB381D529C6FABD2F&dn=Frozen+%282013%29+%5B3D%5D+%5BYTS.MX%5D&tr=udp%3A%2F%2Fglotorrents.pw%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Fp4p.arenabg.ch%3A1337&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337";
btClient.connect().then(async () => {
  console.log("connected");
  const torrent = await btClient.addTorrent(magnet, {
    uuid: "tt12312",
    destinationDir: "F:\\tt12312",
  });
  torrent.start();
});
