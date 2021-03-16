const fs = require("fs");
const del = require("del");
const path = require("path");
const { prompt } = require("inquirer");
const { render } = require("consolidate").ejs;
const metalsmith = require("metalsmith");
const { executeTask, http, ncp, tempPath, download } = require("./util");

/**
 * 获取所有仓库
 * @returns @type {Promise<any[]>} 仓库列表
 */
async function getRepos() {
  const resp = await http.get("https://api.github.com/users/keuby/repos");
  return resp.data.filter((repo) => repo.name.endsWith("seed"));
}

/**
 * 获取仓库的第一个标签名称
 * @param {string} repoName 仓库名
 * @returns {string}
 */
function getRepoFirstTag(repoName) {
  return async () => {
    const url = `https://api.github.com/repos/keuby/${repoName}/tags`;
    const { data } = await http.get(url);
    return data.length > 0 ? data[0].name : null;
  };
}

/**
 * 从网络上下载指定仓库到本地目录
 * @param {string} repoName 仓库名称
 * @param {string} tagName 分支或标签名
 * @returns 文件存储的目录
 */
function downloadRepo(repoName, tagName) {
  return async () => {
    let repo = `keuby/${repoName}`;
    let dest = path.join(tempPath, repoName);
    if (tagName != null) {
      repo += `#${tagName}`;
      dest += `-${tagName}`;
    }
    if (!fs.existsSync(dest)) {
      await download(repo, dest);
    }
    return dest;
  };
}

/**
 * 删除指定目录
 *
 * @param {string} dir 需要被删除的目录路径
 * @returns { Promise<string[]> }
 */
function deleteIfExist(dir) {
  if (!fs.existsSync(dir)) {
    return Promise.resolve([]);
  }
  return del(dir);
}

/**
 * 拷贝仓库代码到指定路径
 * @param {string} source 仓库代码本地路径
 * @param {string} dirname 拷贝的目录名称
 */
async function copyRepo(source, dirname) {
  const renderJs = path.join(source, "render.js");
  const destPath = path.resolve(dirname);
  const copyWithoutRender = async () => {
    await deleteIfExist(destPath);
    await ncp(source, destPath);
  };

  if (!fs.existsSync(renderJs)) return copyWithoutRender;

  /**ss
   * @namespace
   * @property {(string| RegExp)[]} files 需要渲染的文件数组
   * @property {import('inquirer').Question[]} questions 提问列表sssss
   */
  const { files: fileRegs, questions } = require(renderJs);

  if (!fileRegs || !fileRegs.length || !questions || !questions.length) {
    return copyWithoutRender;
  }

  questions.forEach((que) => {
    que.default = que.default.replace(/\$dirname/g, dirname);
    que.message = que.message.replace(/\$dirname/g, dirname);
  });

  const answers = await prompt(questions);

  return async () => {
    await deleteIfExist(destPath);
    await new Promise((resolve, reject) =>
      metalsmith(__dirname)
        .source(source)
        .destination(destPath)
        .use(async (files, _, done) => {
          delete files["render.js"];
          for (const [name, content] of Object.entries(files)) {
            if (fileRegs.some((reg) => name.match(reg))) {
              const fileData = content.contents.toString();
              const rendered = await render(fileData, answers);
              content.contents = Buffer.from(rendered);
            }
          }
          done();
        })
        .build((err) => (err ? reject(err) : resolve()))
    );
  };
}

/**
 * 处理创建逻辑
 *
 * @param {object} options
 * @param {import('commander').Command} command
 */
async function action(options, command) {
  if (command.args.length < 1) {
    throw new TypeError("项目名称必须指定");
  }

  const dirname = command.args[0];
  if (fs.existsSync(path.resolve(dirname)) && !options.d) {
    const ret = await prompt([
      {
        type: "confirm",
        name: "deleteIfExist",
        default: false,
        message: `文件目录 ${dirname} 已经存在，是否覆盖？`,
      },
    ]);
    if (!ret.deleteIfExist) return;
  }

  const repos = await executeTask(getRepos, "初始化");

  const { repo } = await prompt([
    {
      type: "list",
      name: "repo",
      choices: repos.map(({ name }) => name),
      message: "请选择模板",
    },
  ]);

  const tag = await executeTask(getRepoFirstTag(repo), "获取分支信息");
  const dest = await executeTask(downloadRepo(repo, tag), "从远端拉取模板代码");
  await executeTask(await copyRepo(dest, dirname), "拷贝文件");
}

module.exports = {
  alias: "crt",
  action: action,
  usage: "<dirname>",
  examples: ["kb-cli create|crt <dirname>"],
  options: [["-d", "--delete", false]],
  description: "创建项目",
};
