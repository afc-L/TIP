// Headless loader: runs the simulation modules in Node for testing.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = undefined;
const root = path.join(__dirname, '..', 'js');
module.exports = function load(files) {
  for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
  return globalThis.IF;
};
