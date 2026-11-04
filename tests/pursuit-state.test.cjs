const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const storePath = path.join(__dirname, '../js/pursuit-state.js');
const catalog = [
    { id: 'sports', title: 'Football & Sports', aliases: ['football', 'sports', 'soccer', 'basketball'], skills: ['Observation', 'Communication'] },
    { id: 'arts', title: 'Arts & Creativity', aliases: ['design', 'graphic design', 'photography'], skills: ['Composition'] },
    { id: 'fashion', title: 'Modelling & Fashion', aliases: ['fashion design', 'model'], skills: ['Portfolio editing'] }
];

function setup() {
    const data = new Map();
    const environment = {
        PURSUIT_CATALOG: catalog,
        localStorage: {
            getItem: key => data.get(key) ?? null,
            setItem: (key, value) => data.set(key, value),
            removeItem: key => data.delete(key)
        }
    };
    assert.ok(fs.existsSync(storePath), 'The Pursuit state module exists');
    const code = fs.readFileSync(storePath, 'utf8');
    const storage = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
    const open = () => vm.runInNewContext(`${storage}\n${code}\nPursuitStore`, { ...environment });
    const setProfile = studentId => vm.runInNewContext(
        `${storage}\nif (studentId) Storage.saveStudentProfile({ studentId }); else Storage.clearStudentProfile();`,
        { ...environment, studentId }
    );
    return { open, setProfile, data };
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test('matches natural-language interests by the most specific catalog phrase and keeps an arbitrary topic', () => {
    const store = setup().open();
    assert.equal(store.match('I want to learn fashion design!'), 'fashion');
    assert.equal(store.match('I love FOOTBALL.'), 'sports');
    assert.equal(store.match('Making modeless computer interfaces'), null);
    const journey = store.create('  restoring antique clocks  ', 1000);
    assert.equal(journey.interest, 'restoring antique clocks');
    assert.equal(journey.catalogId, null);
    assert.equal(store.load().activeId, journey.id);
});

test('persists mutations after reload and isolates each student and the guest', () => {
    const { open, setProfile } = setup();
    const store = open();
    store.create('Antique clocks');
    setProfile('student-a');
    const journey = store.create('Football');
    store.update(state => { state.journeys[0].answers.goal = 'Read the game better'; });
    assert.equal(open().load().journeys[0].answers.goal, 'Read the game better');
    assert.equal(open().load().activeId, journey.id);
    setProfile('student-b');
    assert.deepEqual(plain(store.load()), { journeys: [], activeId: null });
    store.create('Photography');
    setProfile('student-a');
    store.clear();
    assert.deepEqual(plain(open().load()), { journeys: [], activeId: null });
    setProfile('student-b');
    assert.equal(open().load().journeys[0].interest, 'Photography');
    setProfile();
    assert.equal(open().load().journeys[0].interest, 'Antique clocks');
});

test('recovers the saved pursuits and activities that are still readable after a damaged write', () => {
    const { open, data } = setup();
    const store = open();
    const saved = store.create('Football');
    const log = { kind: 'practice', at: Date.now(), minutes: 15 };
    data.set('sg_pursuit_v1:guest', JSON.stringify({
        activeId: saved.id,
        journeys: [null, { interest: 5 }, { ...saved, answers: null, logs: [null, log], completedChallenges: {} }]
    }));

    const recovered = plain(store.load());
    assert.equal(recovered.activeId, saved.id);
    assert.deepEqual(recovered.journeys, [{ ...plain(saved), answers: {}, logs: [log], completedChallenges: [] }]);
    assert.doesNotThrow(() => store.questions(recovered.journeys[0]));
});

test('asks a follow-up tied to motivation while leaving motivation and goals open-ended', () => {
    const store = setup().open();
    const journey = store.create('Football');
    const initial = store.questions(journey);
    assert.equal(initial[0].key, 'motivation');
    assert.match(initial[0].question, /football/i);
    assert.equal(initial[0].options, undefined);
    assert.equal(initial[1].options, undefined);
    journey.answers.motivation = 'I like figuring out tactics';
    const updated = store.questions(journey);
    assert.notEqual(initial[1].question, updated[1].question);
    assert.match(updated[1].question, /match|tactic/i);
    assert.deepEqual(plain(updated.map(question => question.key)), ['motivation', 'goal', 'level', 'minutes', 'access', 'style', 'ageBand']);
});

test('produces different football activities for tactical and playing goals and adapts to available resources', () => {
    const store = setup().open();
    const journey = store.create('Football');
    journey.answers = { goal: 'Read the game and learn tactics', level: 'beginner', minutes: '5', access: 'basics', style: 'watch', ageBand: '13-17' };
    const tactics = store.makePlan(journey);
    assert.match(tactics.daily.join(' '), /5 minutes/i);
    assert.match(tactics.daily.join(' '), /clip|pass|position/i);
    assert.match(tactics.safety, /trusted adult/i);
    journey.answers = { ...journey.answers, goal: 'Improve my ball control', level: 'experienced', minutes: '30', access: 'equipment', style: 'hands-on', ageBand: '18-plus' };
    const playing = store.makePlan(journey);
    assert.match(playing.daily.join(' '), /30 minutes/i);
    assert.match(playing.daily.join(' '), /ball/i);
    assert.notEqual(playing.weekly.join(' '), tactics.weekly.join(' '));
    assert.notEqual(playing.milestone, tactics.milestone);
});

test('keeps a football goal about finding space before a pass on the match analysis pathway', () => {
    const store = setup().open();
    const journey = store.create('Football');
    journey.answers = {
        motivation: 'I want to understand tactics',
        goal: 'I want to explain how players find space before a pass.',
        level: 'beginner',
        minutes: '15',
        access: 'basics'
    };
    const plan = store.makePlan(journey);
    assert.ok(plan.skills.includes('Match analysis'));
    assert.match(plan.weekly[0], /match situations/i);
});

test('gives an unlisted interest an exploratory plan with a way to check sources', () => {
    const store = setup().open();
    const journey = store.create('antique clock restoration');
    journey.answers = { goal: 'Find out what an apprentice learns', minutes: '15', style: 'read' };
    const plan = store.makePlan(journey);
    assert.match(plan.daily.join(' '), /clock restoration/i);
    assert.match(plan.weekly.join(' '), /museum|library|association|official/i);
    assert.match(plan.monthly.join(' '), /what an apprentice learns/i);
    assert.ok(plan.skills.length);
    assert.ok(plan.milestone);
});

test('uses a different milestone for career exploration and a creative project in the same field', () => {
    const store = setup().open();
    const journey = store.create('Photography');
    journey.answers = { goal: 'Qualify for a career in photojournalism' };
    const career = store.makePlan(journey);
    journey.answers.goal = 'Create a photo series about shadows';
    const project = store.makePlan(journey);
    assert.match(career.weekly.join(' '), /requirement|entry route/i);
    assert.match(project.weekly.join(' '), /draft|scope|first version/i);
    assert.notEqual(career.milestone, project.milestone);
});

test('calculates all-time totals and the last seven local calendar days from activity logs', () => {
    const store = setup().open();
    const journey = store.create('Football');
    const now = new Date(2026, 9, 14, 13).getTime();
    journey.logs = [
        { id: 'old', at: new Date(2026, 9, 7, 23).getTime(), minutes: 20, kind: 'learning' },
        { id: 'first', at: new Date(2026, 9, 8, 0).getTime(), minutes: 5, kind: 'practice' },
        { id: 'today-a', at: new Date(2026, 9, 14, 9).getTime(), minutes: 10, kind: 'practice' },
        { id: 'today-b', at: new Date(2026, 9, 14, 10).getTime(), minutes: 5, kind: 'reflection' },
        { id: 'invalid', at: now, minutes: -100, kind: 'practice' },
        { id: 'future', at: now + 86400000, minutes: 999, kind: 'practice' }
    ];
    const result = store.progress(journey, now);
    assert.equal(result.minutes, 40);
    assert.equal(result.days, 3);
    assert.equal(result.activities, 4);
    assert.deepEqual(plain(result.week.map(day => day.minutes)), [5, 0, 0, 0, 0, 0, 15]);
    assert.deepEqual(plain(result.week.map(day => day.count)), [1, 0, 0, 0, 0, 0, 2]);
    assert.ok(result.week.every(day => day.label));
});
