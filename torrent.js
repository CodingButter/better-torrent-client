const path = require("path");
const fs = require("fs");
const rimraf = require("rimraf");
const crypto = require("crypto");
const mv = require("mv");
const { removeDir } = require("./utils");

var manager, aria2;
module.exports = class Torrent {
  constructor(magnet, definition = {}) {
    this.magnet = magnet;
    this.uuid =
      definition.uuid ||
      crypto.createHash("md5").update(this.magnet).digest("hex");
    this.dest = definition ? definition.dest : manager.options.dest;
    this.dir = path.resolve(definition.dir || manager.options.dir, this.uuid);
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    Object.assign(this, definition);
  }
  static config(_manager) {
    manager = _manager;
    aria2 = _manager.aria2;
  }
  async start() {
    this.gid = await aria2.call("addUri", [this.magnet], this);

    return await new Promise((resolve, reject) => {
      const intval = setInterval(async () => {
        const info = await this.getInfo();
        if (info.followedBy) {
          this.gid = info.followedBy[0];
          await this.getInfo();
          this.dest += `/${this.infoHash}`;
          if (fs.existsSync(this.dest))
            return Object.assign(this, { status: "complete" });
          clearInterval(intval);
          resolve();
        }
      }, 1000);
    });
  }

  delete() {
    removeDir(this.dir);
  }

  async remove() {
    return await aria2.call("remove", this.gid);
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

  async moveToDestination() {
    mv(this.dir, this.dest, { mkdirp: true }, (err) => err && console.log(err));
    //removeDir(this.dir);
  }
};
