const Aria2 = require("aria2");
const Torrent = require("./torrent");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const deepMerge = require("./deep-merge");

class BetterTorrentClient {
  constructor(options) {
    const defaultPort = 6800;
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

const magnetTorrent =
  "magnet:?xt=urn:btih:1307346CE9EB49A36BC241A546720D53BBF2FFDC&dn=Black+Widow+%282021%29+%5B720p%5D+%5BYTS.MX%5D&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2710%2Fannounce&tr=udp%3A%2F%2Fp4p.arenabg.ch%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.cyberia.is%3A6969%2Fannounce&tr=http%3A%2F%2Fp4p.arenabg.com%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce";
const temp = new BetterTorrentClient({
  aria2: { perameters: { "rpc-listen-port": 8001 } },
});
temp.connect().then(async () => {
  const torrent = await temp.addTorrent(magnetTorrent, { id: 497698 });
  await torrent.start();
  setTimeout(async () => {
    const info = await torrent.getInfo();
  }, 15000);
});
