const Aria2 = require("aria2");
const Torrent = require("./torrent");
const { spawn } = require("child_process");
const path = require("path");
const deepMerge = require("./deep-merge");

class BetterTorrentClient {
  constructor(options) {
    this.port = options.port || 6800;
    const defaults = {
      dir: path.resolve("."),
      dest: path.resolve("."),
      aria2: {
        spawnOptions: {
          detached: true,
          shell: true,
        },
        perameters: {
          "rpc-listen-port": `${this.port}`,
          "always-resume": null,
          "enable-rpc": null,
          "rpc-listen-all": true,
          "rpc-allow-origin-all": null,
          "seed-time": 0,
          continue: true,
          "max-concurrent-downloads": 12,
          "max-overall-upload-limit": 0,
          "file-allocation": "none",
          "bt-stop-timeout": 60 * 5,
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
      path.resolve(`${__dirname}/bin/aria2c`),
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

      console.log(`Connected to Aria at port ${this.port}`);
      return true;
    } catch (err) {
      console.log(`Starting Aria listening on port ${this.port}`);
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
    return Promise.all(
      this.torrents.map(async (torrent) => {
        return await torrent.getInfo();
      })
    );
  }

  async remove(torrent) {
    try {
      this.torrents.splice(this.torrents.indexOf(torrent), 1);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  listTorrents() {
    return this.torrents;
  }

  getTorrentById(uuid) {
    const torrent = this.torrents.find(
      (torrent) =>
        torrent.uuid === uuid ||
        torrent.gid == uuid ||
        torrent.followedBy == [uuid]
    );
    return torrent;
  }
  async onTorrentComplete(torrent) {}
  captureEvents() {
    this.aria2.on("onBtDownloadComplete", async (btcgid) => {
      const [{ gid }] = btcgid;
      const torrent = this.getTorrentById(gid);
      console.log("Torrent Completed");
      await this.aria2.call("purgeDownloadResult");
      torrent.moveToDestination();
      this.remove(torrent);
    });

    this.aria2.on("onDownloadStop", async ([{ gid }]) => {
      console.log("torrent was Stopped");
      await this.aria2.call("purgeDownloadResult");
      const torrent = this.getTorrentById(gid);
      torrent.delete();
      this.remove(torrent);
    });
  }
}

module.exports = BetterTorrentClient;
