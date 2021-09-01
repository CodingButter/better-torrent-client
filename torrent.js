const path = require("path");
const deepMerge = require("./deep-merge");
const fs = require("fs");
const rimraf = require("rimraf");
const crypto = require("crypto");
const { threadId } = require("worker_threads");
var manager, aria2;
module.exports = class Torrent {
  constructor(magnet, definition = {}) {
    this.magnet = magnet;
    this.uuid =
      definition.uuid ||
      crypto.createHash("md5").update(this.magnet).digest("hex");
    this.destinationDir = definition
      ? definition.destinationDir
      : manager.options.destinationDir;
    this.dir = path.resolve(
      definition.dir || manager.options.downloadDirectory,
      this.uuid
    );
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir);
    }
    Object.assign(this, definition);
  }
  static config(_manager) {
    manager = _manager;
    aria2 = _manager.aria2;
  }
  async start() {
    const _self = this;
    if (fs.existsSync(this.destinationDir))
      return Object.assign(_self, { status: "complete" });
    this.gid = await aria2.call("addUri", [this.magnet], this);

    await new Promise((resolve, reject) => {
      const intval = setInterval(async () => {
        const info = await _self.getInfo();
        if (info.followedBy) {
          clearInterval(intval);
          resolve();
        }
      }, 1000);
    });
  }

  deleteFiles() {
    if (fs.existsSync(this.dir))
      rimraf(this.dir, (err) => {
        if (err) console.log({ rimraf_error: err });
      });
  }

  async remove(download) {
    download = download || this;
    if (download.files) {
      await Promise.all(
        download.files
          .filter((file) => file.status == "active")
          .map(async (file) => {
            return await download.remove(file);
          })
      );
    }
    if (download.gid && download.status == "active")
      await aria2.call("forceRemove", download.gid);
    await aria2.call("purgeDownloadResult");
    this.deleteFiles();
    return "ok";
  }
  async getInfo() {
    try {
      const info = await aria2.call("tellStatus", this.gid);
      Object.assign(this, info);
      return this;
    } catch (StatusError) {
      return { status: "removed" };
    }
  }

  moveToDestination() {
    fs.renameSync(this.dir, this.destinationDir);
  }
};
