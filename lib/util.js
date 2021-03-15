const ncp = require("ncp");
const ora = require("ora");
const path = require("path");
const axios = require("axios");
const download = require("download-git-repo");
const { promisify } = require("util");

/**
 * 执行一个异步任务，同时打印加载信息
 * @param {() => Promise} factory
 */
exports.executeTask = async function (factory, name) {
  const spinner = ora(`正在${name}...`).start();
  try {
    const ret = await factory();
    spinner.text = `${name}完成`;
    spinner.succeed();
    return ret;
  } catch (error) {
    spinner.fail(`${name}失败`);
    throw error;
  }
};

exports.http = axios.default.create({
  headers: {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
    Authorization: "token 224268e9ea68b236cb9eceecb06aef540cfa280e",
  },
});

/**
 * 临时文件存放目录
 */
exports.tempPath = (() => {
  const homePath =
    process.platform === "win32"
      ? process.env["USERPROFILE"]
      : process.env["HOME"];
  return path.join(homePath, ".tmp/kb-cli");
})();

/**
 * 从 git 仓库中下载仓库代码到指定目录
 * @param {string} repo 仓库地址
 * @param {string} dest 下载目录
 * @param {object} opts 配置参数
 */
exports.download = promisify(download);

exports.ncp = promisify(ncp);
