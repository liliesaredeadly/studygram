const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../js/pursuit.js'), 'utf8');

function setup() {
    const handlers = {};
    const pending = [];
    const companion = { outerHTML: '', querySelector: () => null };
    let pageRenders = 0;
    const root = {
        set innerHTML(value) { this.markup = value; pageRenders++; },
        querySelector: selector => selector === '[data-pursuit-companion]' ? companion : null,
        addEventListener() {}
    };
    const journey = {
        id: 'j1', interest: 'Guitar', answers: { ageBand: '18-plus' },
        logs: [], plan: { daily: 'Practice one chord' }
    };
    vm.runInNewContext(code, {
        document: {
            getElementById: () => root,
            addEventListener: (event, handler) => { handlers[event] = handler; }
        },
        window: { addEventListener() {}, scrollTo() {} },
        history: { replaceState() {}, pushState() {} },
        PursuitStore: {
            load: () => ({ activeId: journey.id, journeys: [journey] }),
            progress: () => ({ week: [], minutes: 0, days: 0, activities: 0 }),
            questions: () => [{ key: 'goal', question: 'What do you want to learn?' }]
        },
        requestStudygramAI: () => new Promise(resolve => { pending.push(resolve); })
    });
    function click(action, topic) {
        handlers.click({ target: { closest: () => ({ dataset: { action, topic } }) }, preventDefault() {} });
    }
    click('dashboard');
    return { root, companion, pending, click, renders: () => pageRenders };
}

test('updates the AI panel without replacing the dashboard activity form', async () => {
    const { companion, pending, click, renders } = setup();
    const before = renders();
    click('ai-plan');
    pending[0]({ daily: ['D'], weekly: ['W'], monthly: ['M'] });
    await new Promise(setImmediate);
    assert.equal(renders(), before);
    assert.match(companion.outerHTML, /AI draft/);
});

test('leaving a dashboard cancels its pending reply and lets the next view start its own request', async () => {
    const { root, companion, pending, click, renders } = setup();
    click('ai-plan');
    click('edit');
    const before = renders();
    assert.match(root.markup, /What do you want to learn\?/);
    pending[0]({ daily: ['old D'], weekly: ['old W'], monthly: ['old M'] });
    await new Promise(setImmediate);
    assert.equal(renders(), before);
    click('exit-interview');
    click('ai-plan');
    assert.equal(pending.length, 2);
    pending[1]({ daily: ['new D'], weekly: ['new W'], monthly: ['new M'] });
    await new Promise(setImmediate);
    assert.match(companion.outerHTML, /new D/);
    assert.doesNotMatch(companion.outerHTML, /old D/);
});
