/* eslint-disable @typescript-eslint/no-require-imports -- Credential-free TypeScript fixture loader. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, mocks = {}, globals = {}) {
  const filename = path.join(root, file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    code,
    {
      exports,
      URL,
      URLSearchParams,
      AbortSignal,
      Date,
      Map,
      Set,
      console,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name === 'server-only') return {};
        if (name.startsWith('@/')) {
          const file = name.replace('@/', 'src/');
          return load(
            fs.existsSync(path.join(root, file + '.ts')) ? file + '.ts' : file + '.tsx',
            mocks,
            globals,
          );
        }
        if (name.startsWith('.')) {
          const relative = path.relative(root, path.resolve(path.dirname(filename), name));
          return load(relative + '.ts', mocks, globals);
        }
        if (['zod', 'react', 'react/jsx-runtime'].includes(name)) return require(name);
        throw new Error(`Unexpected dependency ${name}`);
      },
      ...globals,
    },
    { filename },
  );
  return exports;
}
module.exports = { load };
