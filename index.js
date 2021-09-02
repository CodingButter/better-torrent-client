const Aria2 = require("aria2");
const Torrent = require("./torrent");
const { spawn } = require("child_process");
const path = require("path");
const deepMerge = require("./deep-merge");

class BetterTorrentClient {
  constructor(options) {
    const defaultPort = options.port || 6800;
    const defaults = {
      dir: path.resolve("."),
      dest: path.resolve("."),
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

(async () => {
  const btClient = new BetterTorrentClient({ port: 3001 });
  const magnet =
    "magnet:?xt=urn:btih:5FCFC76584E114282643694E5C8283C757DD4617&dn=WinRAR%205.71%20FINAL%20%2B%20Key%20%5BTheWindowsForum%5D&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A6969%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2710%2Fannounce&tr=udp%3A%2F%2F9.rarbg.me%3A2780%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2730%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=http%3A%2F%2Fp4p.arenabg.com%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=udp%3A%2F%2Ftracker.tiny-vps.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce";
  await btClient.connect();

  const torrent = await btClient.addTorrent(magnet, {
    uuid: "tt12312",
    dest: "F:\\tt12312",
  });

  await torrent.start();
  torrent.remove();
})();
