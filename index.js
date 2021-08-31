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
      moveToDirectory: path.resolve("."),
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
        },
      },
    };
    this.options = deepMerge(defaults, options);
    this.aria2 = new Aria2({
      port: this.options.aria2.perameters["rpc-listen-port"],
    });
    Torrent.config(this);
    this.torrents = [];
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
    console.log({ connecting: "true" });
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
  }

  async getInfo() {
    return Promise.all(
      this.torrents.map(async (torrent) => {
        return await torrent.getInfo();
      })
    );
  }

  listTorrents() {
    return this.torrents;
  }

  getTorrentById(uuid) {
    return this.torrents.filter(({ guid, id }) => {
      return guid === uuid || id === uuid;
    })[0];
  }
}
