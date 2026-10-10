/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused controlled-form regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const component = {};
let slots = [];
let cursor;
let dirty;
let actionState = { error: null };
const router = { refresh() {} };
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/components/signal-fire-forms.tsx', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  {
    exports: component,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter: () => router };
      if (name.endsWith('/signal-fire/actions')) return {};
      if (name === 'react')
        return {
          useActionState: () => [actionState, () => {}, false],
          useEffect() {},
          useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = initial;
            return [
              slots[index],
              (value) => {
                slots[index] = value;
                dirty = true;
              },
            ];
          },
        };
      throw new Error(name);
    },
  },
);
function render(status) {
  let tree;
  do {
    cursor = 0;
    dirty = false;
    tree = component.FeedbackStatusForm({ reportId: 'report', status });
  } while (dirty);
  return tree;
}
function select(tree) {
  return tree.props.children[1].props.children[1];
}
let tree = render('new');
select(tree).props.onChange({ target: { value: 'reviewing' } });
assert.equal(select(render('new')).props.value, 'reviewing');
actionState = { error: null, success: true, savedStatus: 'reviewing' };
tree = render('new'); // Action finishes before refreshed server props arrive.
assert.equal(select(tree).props.value, 'reviewing');
assert.equal(select(tree).props.defaultValue, undefined); // Native form reset cannot restore New.
assert.equal(select(render('reviewing')).props.value, 'reviewing');
slots = []; // Refresh/reopen mounts from persisted server data.
actionState = { error: null };
assert.equal(select(render('reviewing')).props.value, 'reviewing');
select(render('reviewing')).props.onChange({ target: { value: 'planned' } });
actionState = { error: 'Save failed' };
assert.equal(select(render('reviewing')).props.value, 'planned');
assert.equal(select(render('closed')).props.value, 'closed');
console.log('Signal Fire status form save, refresh, and reopen regression passed.');
