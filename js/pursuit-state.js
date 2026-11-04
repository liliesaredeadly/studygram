const PursuitStore = (() => {
    const storagePrefix = 'sg_pursuit_v1:';
    const logKinds = ['practice', 'learning', 'reflection'];

    const interests = {
        sports: {
            suggestions: ['I enjoy playing', 'I want to understand tactics', 'I want to coach', 'I am still exploring'],
            access: 'Sport-specific gear and a suitable practice space',
            goal: 'What would you like to understand or do better in your sport this month?',
            activity: 'Observe one short passage of play and explain what an athlete noticed before making a decision.',
            checkpoint: 'Compare two decisions from a game or an event and explain which choices fit each situation.',
            milestone: 'Explain one pattern you can recognise during a game.'
        },
        fashion: {
            suggestions: ['I enjoy styling', 'I want to learn about modelling', 'I want to build a portfolio'],
            access: 'Access to styling, design or photography equipment',
            goal: 'What would you like to make or learn first, such as a styling study, a portfolio page or how a casting works?',
            activity: 'Use clothes or materials you already have to sketch a look or experiment with the framing of a private portfolio image.',
            checkpoint: 'Review three examples of portfolio work and describe how each uses lighting, colour or presentation.',
            milestone: 'Create one private portfolio page and explain your choices.'
        },
        performance: {
            suggestions: ['I want to perform', 'I enjoy making music', 'I want to learn how a performance comes together'],
            access: 'An instrument, rehearsal space or recording equipment',
            goal: 'What short performance, recording or creative piece would you like to work toward?',
            activity: 'Choose a short phrase, passage or scene. Notice its timing or delivery and try one small variation you can repeat comfortably.',
            checkpoint: 'Compare two versions of the same short passage and write down which change improved it.',
            milestone: 'Prepare one short piece and explain the creative choice you made.'
        },
        business: {
            suggestions: ['I want to solve a problem', 'I am curious about marketing', 'I want to understand how a business works'],
            access: 'Access to prototype materials or free design and spreadsheet tools',
            goal: 'What problem, idea or business skill would you like to investigate first?',
            activity: 'Pick a problem you have observed and sketch how someone might solve it using materials already available.',
            checkpoint: 'Make a one-page outline of the problem, who has it and one low-cost way to test your idea with people you know.',
            milestone: 'Explain one problem, two possible solutions and what evidence would help you choose.'
        },
        arts: {
            suggestions: ['I like telling stories', 'I want to express an idea visually', 'I want to develop a creative portfolio'],
            access: 'Access to creative materials, a camera or editing tools',
            goal: 'What small piece would you like to make or which technique would you like to practise?',
            activity: 'Make a small study with the simplest materials you have. Change one element, such as composition, point of view or rhythm.',
            checkpoint: 'Select two versions and write down how one change affected what the work communicates.',
            milestone: 'Finish one small piece, with a draft that shows how you developed it.'
        },
        stem: {
            suggestions: ['I want to build something', 'I like finding out how things work', 'I enjoy solving problems'],
            access: 'Access to a computer, a coding environment or supervised equipment',
            goal: 'What question would you like to answer or what small project would you like to build?',
            activity: 'Draw a model, trace a small example or work through a free simulator. Record what you expect to happen before you try it.',
            checkpoint: 'Change one input in a model or simulation and write down whether the result agrees with your prediction.',
            milestone: 'Show one model or prototype and explain a result you checked.'
        },
        'public-service': {
            suggestions: ['I want to help people', 'I am curious about the training', 'I want to understand the day-to-day work'],
            access: 'Access to school resources or a supervised careers activity',
            goal: 'What role, responsibility or education pathway would you like to understand first?',
            activity: 'Read a short description from an institution that trains or employs people in the role. Write down one task they do and one question about it.',
            checkpoint: 'Compare two roles and chart their everyday work, training requirements and supervised entry routes.',
            milestone: 'Create a one-page map of two related roles and the training each involves.'
        }
    };

    const footballFocus = [
        {
            pattern: /\b(coach\w*|teach\w*|team management)\b/i,
            goal: 'What would you like to help a player or team understand first?',
            activity: 'Draw one situation on a pitch diagram and practise explaining a simple decision in your own words.',
            checkpoint: 'Draft a short coaching explanation for one football decision and ask a teammate or a coach whether it is clear.',
            milestone: 'Explain one decision clearly enough for another person to try it in a supervised session.',
            skill: 'Giving clear feedback'
        },
        {
            pattern: /\b(tactic\w*|watch\w*|analy\w*|formation\w*|read the game|understand the game|positioning|passing (?:option|lane)s?|players? finds? space)\b/i,
            goal: 'What would you like to notice in a match, such as passing options, positioning or how a team defends?',
            activity: 'Pause a short match clip before a pass. Name two options the player could see, then watch what happens.',
            checkpoint: 'Sketch two match situations and compare how space and positioning changed the next pass.',
            milestone: 'Explain two decisions from one match using your own sketches.',
            skill: 'Match analysis'
        },
        {
            pattern: /\b(play\w*|ball|dribbl\w*|shoot\w*|pass\w*|defend\w*|goalkeep\w*|athlet\w*|professional)\b/i,
            goal: 'What football skill would you like to practise first, such as first touch, passing or finding space?',
            activity: 'Choose one familiar ball-control task in your usual safe space and record what felt repeatable.',
            withoutEquipment: 'Sketch a receiving position from a match clip and name two cues that help the player control the ball.',
            checkpoint: 'Compare notes from two sessions on the same football skill and pick one cue to revisit next week.',
            milestone: 'Describe a change you can observe in one football skill and choose your next focus.',
            skill: 'Intentional skill practice'
        }
    ];

    const goalFocus = [
        {
            pattern: /\b(career|apprentice\w*|qualif\w*|become|job|entry route)\b/i,
            goal: 'Which role or training route would you like to understand first?',
            activity: 'Read how a school or training provider describes the role you are considering. Note one regular responsibility and one question about getting started.',
            checkpoint: 'Compare two entry routes using official training or education sources. Write down a requirement and one thing you could learn now.',
            milestone: 'Save a one-page map of an entry route, with one verified requirement and one step to explore next.',
            skill: 'Comparing training routes'
        },
        {
            pattern: /\b(portfolio|build\w*|creat\w*|mak(?:e|ing)|record\w*|writ(?:e|ing)|design\w*|produc\w*|publish\w*)\b/i,
            goal: 'What is a small first version you could finish with the tools and time you have?',
            checkpoint: 'Choose a small scope for a private first draft. Compare it with one example and revise one part.',
            milestone: 'Finish a small first version and save a note about one choice you made.',
            skill: 'Drafting and revision'
        }
    ];

    const levels = {
        beginner: 'Start with one example and write a baseline you can compare with later.',
        some: 'Repeat a familiar task with one deliberate change and compare the result.',
        experienced: 'Name a specific performance criterion, compare two approaches and look for feedback on that criterion.'
    };
    const styles = {
        'hands-on': 'Try a small version with materials you already have and record what happens.',
        watch: 'Start by observing a short demonstration from a reliable source. Pause and describe one choice you see.',
        read: 'Start with a short written explanation from a reliable source. Summarise one idea before using it.',
        mixed: 'Read or observe one example, then explain or test one idea in your own words.'
    };
    const safeguards = {
        sports: 'Choose a suitable space and stick to activities you can do safely. Leave time for rest and ask a qualified coach about technique and training loads.',
        fashion: 'Keep portfolio work private while you explore. Check agencies independently, ask for clear terms and set boundaries on images and meetings.',
        performance: 'Choose a comfortable volume and space. Take breaks and check permissions before sharing anyone else’s work or recording them.',
        business: 'Keep early tests small and free. Protect people’s information and get permission before collecting feedback or sharing their words.',
        arts: 'Use materials you can handle safely. Get consent before photographing people or publishing their work.',
        stem: 'Use paper, sample data or a simulation for early experiments. Ask a qualified supervisor before using specialised equipment or materials.',
        'public-service': 'Explore through public, supervised materials. Ask training providers about official requirements and qualified supervision.'
    };

    function storageKey() {
        if (typeof StudygramPrivateSession !== 'undefined') return 'sg_pursuit_v1';
        let studentId;
        try {
            studentId = Storage.getStudentProfile()?.studentId;
        } catch {
            studentId = null;
        }
        return studentId == null || studentId === '' ? `${storagePrefix}guest` : `${storagePrefix}student:${studentId}`;
    }

    function isRecord(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function read(key) {
        let saved;
        try {
            saved = JSON.parse(typeof document === 'undefined' ? localStorage.getItem(key) : Storage.getPrivateValue(key));
        } catch {
            saved = null;
        }
        const entries = Array.isArray(saved?.journeys) ? saved.journeys : [];
        const journeys = entries.filter(journey => typeof journey?.id === 'string' && journey.id &&
            typeof journey.interest === 'string' && journey.interest.trim()).map(journey => ({
            ...journey,
            answers: isRecord(journey.answers) ? journey.answers : {},
            logs: Array.isArray(journey.logs) ? journey.logs.filter(isRecord) : [],
            completedChallenges: Array.isArray(journey.completedChallenges) ? journey.completedChallenges : []
        }));
        const activeId = journeys.some(journey => journey.id === saved.activeId) ? saved.activeId : null;
        return { journeys, activeId };
    }

    function load() {
        return read(storageKey());
    }

    function update(mutator) {
        const key = storageKey();
        const state = read(key);
        mutator(state);
        if (typeof document === 'undefined') localStorage.setItem(key, JSON.stringify(state));
        else Storage.setPrivateValue(key, JSON.stringify(state));
        return state;
    }

    function clear() {
        if (typeof document === 'undefined') localStorage.removeItem(storageKey());
        else Storage.setPrivateValue(storageKey(), null);
    }

    function normalise(text) {
        return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    }

    function match(interest) {
        const words = ` ${normalise(interest)} `;
        let best = null;
        let longest = 0;
        for (const entry of PURSUIT_CATALOG) {
            for (const name of [entry.id, entry.title, ...entry.aliases]) {
                const phrase = normalise(name);
                if (phrase.length > longest && words.includes(` ${phrase} `)) {
                    best = entry.id;
                    longest = phrase.length;
                }
            }
        }
        return best;
    }

    function create(interest, now = Date.now()) {
        const topic = interest.trim();
        if (!topic) throw new RangeError('Enter an interest to start your Pursuit.');
        const journey = {
            id: globalThis.crypto?.randomUUID?.() || `pursuit-${now}-${Math.random().toString(36).slice(2)}`,
            interest: topic,
            catalogId: match(topic),
            answers: {},
            plan: null,
            logs: [],
            at: now
        };
        update(state => {
            state.journeys.unshift(journey);
            state.activeId = journey.id;
        });
        return journey;
    }

    function footballPath(journey, text) {
        if (journey.catalogId !== 'sports' || !/\b(football\w*|soccer)\b/i.test(journey.interest)) return null;
        return footballFocus.find(focus => focus.pattern.test(text));
    }

    function chooseFocus(journey, text) {
        if (!journey.catalogId) return null;
        return footballPath(journey, text) || goalFocus.find(focus => focus.pattern.test(text));
    }

    function options(labels) {
        return Object.entries(labels).map(([value, label]) => ({ value, label }));
    }

    function questions(journey) {
        const answers = journey.answers;
        const field = interests[journey.catalogId];
        const focus = chooseFocus(journey, answers.motivation);
        return [
            {
                key: 'motivation',
                question: `What draws you to “${journey.interest}”?`,
                placeholder: 'Describe what you enjoy or what you are curious about.',
                suggestions: field?.suggestions || ['I am curious about how it works', 'I want to try it', 'I am still exploring']
            },
            {
                key: 'goal',
                question: focus?.goal || field?.goal || `What is one thing you would like to learn or try in ${journey.interest} this month?`,
                placeholder: 'Write a small, concrete goal in your own words.'
            },
            {
                key: 'level',
                question: 'How much experience do you have with that?',
                options: options({ beginner: 'I’m just starting', some: 'I have tried it a few times', experienced: 'I already practise regularly' })
            },
            {
                key: 'minutes',
                question: 'What amount of time can fit around school, rest and your other commitments?',
                options: [5, 15, 30, 45].map(minutes => ({ value: String(minutes), label: `${minutes} minutes` }))
            },
            {
                key: 'access',
                question: 'What can you safely and comfortably use right now?',
                options: options({
                    basics: 'Basic supplies and free learning resources',
                    home: 'A suitable space or ordinary materials at home',
                    equipment: field?.access || 'Materials or equipment for this interest',
                    coach: 'A teacher, instructor, club or supervised group'
                })
            },
            {
                key: 'style',
                question: 'What usually helps you understand something new?',
                options: options({ 'hands-on': 'Trying it myself', watch: 'Watching an example', read: 'Reading or taking notes', mixed: 'Mixing several approaches' })
            },
            {
                key: 'ageBand',
                question: 'Which age group should your plan be suitable for? You can skip this.',
                options: options({ 'under-13': 'Under 13', '13-17': '13–17', '18-plus': '18 or over', 'prefer-not': 'Prefer to skip' })
            }
        ];
    }

    function makePlan(journey) {
        const { interest, catalogId, answers } = journey;
        const field = interests[catalogId];
        const entry = PURSUIT_CATALOG.find(item => item.id === catalogId);
        const focus = chooseFocus(journey, answers.goal) || chooseFocus(journey, answers.motivation);
        const minutes = [5, 15, 30, 45].includes(Number(answers.minutes)) ? Number(answers.minutes) : 15;
        const goal = answers.goal?.trim() || `Explore ${interest}`;
        const basicAccess = !answers.access || answers.access === 'basics' || answers.access === 'home';
        const activity = (basicAccess && focus?.withoutEquipment) || focus?.activity || field?.activity ||
            `Write one specific question about ${interest}. Look for an introductory overview from a library, museum, school or professional association.`;
        const checkpoint = focus?.checkpoint || field?.checkpoint ||
            `Use a library, museum, school or relevant professional association to check one answer about ${interest}. Save where you found it.`;
        const access = {
            basics: 'Work with the free example and basic materials you already have.',
            home: 'Pick a version you can complete safely with ordinary materials in your own space.',
            equipment: 'Choose a familiar tool or setup you can use safely and keep the same setup when comparing results.',
            coach: 'Bring one question or a sample of your work to a supervised session for feedback.'
        }[answers.access] || 'Start with a free example and tools you already have.';
        const review = {
            beginner: 'Compare your first and latest attempt and choose one manageable next step.',
            some: 'Compare your notes across several sessions and choose one weak spot to focus on next.',
            experienced: 'Check how your work changed against your chosen criterion and set the next challenge using your evidence.'
        }[answers.level] || 'Compare your first and latest notes and choose one manageable next step.';
        const safety = safeguards[catalogId] || 'Start with observation or a safe introductory activity. Ask a qualified instructor about any activity that requires tools, specialist knowledge or supervision.';
        const support = answers.ageBand === '18-plus' ? '' : ' Ask a trusted adult to help check unfamiliar sources, groups and opportunities before sharing details or meeting anyone.';
        return {
            daily: [
                `Set aside up to ${minutes} minutes on a day that fits your schedule. ${activity}`,
                styles[answers.style] || styles.mixed,
                'Finish by noting one thing you learned and what you want to try next.'
            ],
            weekly: [
                checkpoint,
                access,
                levels[answers.level] || levels.beginner,
                'Leave space for school and rest. Use free resources from a library, school or relevant organisation when you need a new example.'
            ],
            monthly: [
                `Revisit your goal “${goal}” and use a note, example or piece of work to decide what progress looks like now.`,
                review,
                'Find one related role or learning route and check an official training or education source for its next step.'
            ],
            skills: [focus?.skill, ...(entry?.skills || ['Asking research questions', 'Checking sources', 'Reflecting on evidence'])].filter(Boolean).slice(0, 5),
            milestone: focus?.milestone || field?.milestone || `Save a verified introductory example of ${interest} and choose one small next step it suggests.`,
            safety: safety + support
        };
    }

    function progress(journey, now = Date.now()) {
        const today = new Date(now);
        const days = new Set();
        const recent = new Map();
        let minutes = 0;
        let activities = 0;
        for (let offset = -6; offset <= 0; offset++) {
            const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
            recent.set(date.getTime(), { label: date.toLocaleDateString(undefined, { weekday: 'short' }), minutes: 0, count: 0 });
        }
        for (const log of journey.logs || []) {
            const duration = Number(log?.minutes);
            if (!Number.isFinite(log?.at) || log.at > now || !Number.isFinite(duration) || duration <= 0 || !logKinds.includes(log.kind)) continue;
            const date = new Date(log.at);
            if (!Number.isFinite(date.getTime())) continue;
            const day = date.setHours(0, 0, 0, 0);
            minutes += duration;
            activities++;
            days.add(day);
            const bucket = recent.get(day);
            if (bucket) {
                bucket.minutes += duration;
                bucket.count++;
            }
        }
        return { minutes, days: days.size, activities, week: [...recent.values()] };
    }

    return { load, update, clear, create, match, questions, makePlan, progress };
})();
