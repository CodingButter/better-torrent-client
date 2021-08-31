const deepMerge = require("./deep-merge");
var manager, aria2;
module.exports = class Torrent {
  constructor(magnet, definition) {
    this.magnet = magnet;
    const defaultProps = {
      dir: manager.options.downloadDirectory,
    };
    Object.assign(this, defaultProps, definition);
  }
  static config(_manager) {
    manager = _manager;
    aria2 = _manager.aria2;
  }
  async start() {
    const _self = this;
    this.guid = await aria2.call("addUri", [this.magnet], this);
    await new Promise((resolve, reject) => {
      const intval = setInterval(async () => {
        const info = await _self.getInfo();
        if (info.followedBy) {
          this.guid = info.followedBy[0];
          clearInterval(intval);
          resolve();
        }
      }, 1000);
    });
  }

  async remove() {
    await aria2.call("remove", this.following);
    return await aria2.call("remove", this.guid);
  }
  async getInfo() {
    const info = await aria2.call("tellStatus", this.guid);
    this.info = deepMerge(info, this);
    return this.info;
  }

  async delete() {}
};
