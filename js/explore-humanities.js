const EXPLORE_HUMANITIES = [
  {
    id: "defence",
    title: "Defence & Security",
    tagline: "Follow the people, maps and decisions behind a rescue mission.",
    icon: "🛡️",
    tone: "defence",
    discover: [
      {
        title: "The nearest help may already be at sea",
        text: "The Indian Coast Guard runs a ship-reporting system that helps rescue coordinators identify vessels able to assist someone in distress. A ship already nearby may be able to respond quickly.",
      },
      {
        title: "Satellites can help map a flood",
        text: "ISRO uses satellite observations to map inundated areas. Responders can compare these maps with reports from the ground to plan relief and see where conditions may have changed.",
      },
    ],
    lesson: {
      title: "How a rescue call becomes a plan",
      scenes: [
        {
          title: "Find the last known position",
          caption: "A position and a time give the search a starting point.",
          narration: "A boat sends a distress call. Coordinators need to know where it was and when. If the report is old, the boat may have drifted since that position was recorded.",
          duration: 15,
          visual: "steps",
          items: ["Mark the position", "Record the time", "Ask who is in danger"],
          highlighted: [0, 1],
        },
        {
          title: "Match the help to the situation",
          caption: "Coordinators weigh distance, conditions and rescue capability.",
          narration: "The closest vessel may arrive first. But heavy seas or an injured passenger might call for a different rescue team. Coordinators check what each team can do safely.",
          duration: 15,
          visual: "steps",
          items: ["Check travel time", "Check the weather", "Check rescue capability"],
          highlighted: [2],
        },
        {
          title: "Update the plan",
          caption: "A fresh sighting can change where teams search next.",
          narration: "A ship reports a possible sighting. The coordinator checks when and where it was seen, then shares the update. Teams can shift their search without duplicating each other's work.",
          duration: 15,
          visual: "steps",
          items: ["Verify the new report", "Update the search area", "Tell every team"],
          highlighted: [1, 2],
        },
      ],
    },
    explore: [
      {
        title: "What do the Army, Navy and Air Force do?",
        text: "The Army focuses on land operations, the Navy on maritime operations and the Air Force on air operations. A joint response can draw on more than one service. For example, a relief effort might use aircraft to move supplies and ground teams to distribute them.",
      },
      {
        title: "Why does a rescue report need a timestamp?",
        text: "Wind and currents can carry a boat away from its last reported position. The older a sighting is, the more room there may be for uncertainty. Try drawing two possible drift directions from the same point.",
      },
      {
        title: "What goes on a flood map?",
        text: "A layer showing observed floodwater can be placed over a map of roads and settlements. A ground report can then help responders check whether a crossing is usable at that moment.",
      },
      {
        title: "What does security look like online?",
        text: "A phishing message may impersonate a trusted organisation to get you to share a password or open a link. If a message surprises you, check the request through the organisation's usual website or contact channel.",
      },
    ],
    questions: [
      {
        concept: "position and time",
        difficulty: "medium",
        question: "Two boats report the same position in similar conditions. One report is five minutes old and the other is an hour old. Which boat's current position is more uncertain?",
        options: ["The position in the newer report", "The position in the older report", "Both are equally certain", "There is no uncertainty in either report"],
        correctIndex: 1,
        explanation: "The boat in the older report has had more time to drift since that position was recorded.",
      },
      {
        concept: "position and time",
        difficulty: "easy",
        question: "Which pair gives a rescue team the clearest starting point?",
        options: ["The coordinates and the time they were recorded", "A boat colour and the day of the week", "A crew member's name and an old timetable", "The fuel level and the boat's age"],
        correctIndex: 0,
        explanation: "Coordinates tell the team where to start. The time tells them how recent that information is.",
      },
      {
        concept: "rescue capability",
        difficulty: "medium",
        question: "A nearby boat cannot safely approach in rough seas. What should a coordinator check next?",
        options: ["Which boat has the brightest lights", "Which boat has the shortest name", "Which trained crew has suitable equipment and can arrive safely", "Which crew is usually first to leave the harbour"],
        correctIndex: 2,
        explanation: "Travel time matters alongside the crew's ability to reach and assist the people safely in the conditions.",
      },
      {
        concept: "rescue capability",
        difficulty: "easy",
        question: "What does a rescue team's capability describe?",
        options: ["The distance it travelled last year", "The size of the town it comes from", "The number of letters in its name", "What its crew and equipment can safely do"],
        correctIndex: 3,
        explanation: "Capability combines what the team is trained to do with what its equipment can support.",
      },
    ],
    careers: [
      {
        title: "Armed forces officer",
        text: "Officers lead teams, organise training and plan operations. India's NDA and Naval Academy examination is one route after school. Mathematics and physics are relevant for technical and flying routes. Practise teamwork and clear communication, then check the current UPSC notice for each branch's requirements.",
        url: "https://cms.upsc.gov.in/examination-calendar/",
      },
      {
        title: "Defence research scientist or engineer",
        text: "Civilian researchers and engineers develop and test defence technology. Engineering, computer science and physical sciences are relevant degree routes. Start by measuring how a simple sensor responds and explaining the results. DRDO publishes recruitment details for each role.",
        url: "https://drdo.gov.in/drdo/en/how-can-i-join-drdo",
      },
    ],
    people: [
      {
        title: "Vartika Joshi",
        text: "The Indian Navy officer skippered INSV Tarini on the first Indian circumnavigation of the globe by an all-women crew. The voyage put navigation, teamwork and judgment to work far from shore.",
        url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1543037&lang=2&reg=48",
      },
    ],
    project: {
      title: "Run a paper rescue exercise",
      intro: "Use a fictional bay to practise making and revising a plan with incomplete information.",
      steps: [
        "Draw a bay on grid paper. Mark two rescue bases and place a boat's last known position with a timestamp.",
        "Give each team a travel time and a capability, such as carrying injured passengers. Choose a team and explain the trade-off in two sentences.",
        "Ask a classmate to add a newer sighting or a weather change. Revise the search area or team choice and record why it changed.",
      ],
    },
    path: ["Read a map with a key and grid", "Compare a report with a newer update", "Try the rescue exercise with a partner", "Explore current official career routes"],
    sources: [
      { title: "Indian Coast Guard · Search and rescue", url: "https://indiancoastguard.gov.in/search-and-rescue" },
      { title: "ISRO · Disaster management support", url: "https://www.isro.gov.in/DisasterManagementSupport.html" },
      { title: "UPSC · Examination calendar", url: "https://cms.upsc.gov.in/examination-calendar/" },
      { title: "Indian Air Force · Entry routes and qualifications", url: "https://careerairforce.gov.in/qualification" },
      { title: "DRDO · Recruitment routes", url: "https://drdo.gov.in/drdo/en/how-can-i-join-drdo" },
      { title: "CERT-In · Digital Safety Compass", url: "https://www.cert-in.org.in/PDF/CSH_Booklet25.pdf" },
      { title: "Ministry of Defence · Vartika Joshi award citation", url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1543037&lang=2&reg=48" },
    ],
  },
  {
    id: "arts",
    title: "Arts & Creativity",
    tagline: "Discover how a brushstroke, a gesture or a bold shape can tell a story.",
    icon: "🎨",
    tone: "arts",
    discover: [
      {
        title: "Three figures, many readings",
        text: "Amrita Sher-Gil painted the work often called Group of Three Girls in 1935. In the National Gallery of Modern Art's virtual tour, notice how the figures sit and where their eyes lead. Which detail changes how you read the scene?",
      },
      {
        title: "A glance can carry a scene",
        text: "In Kutiyattam, a living Sanskrit theatre tradition from Kerala, trained performers use precise eye movements and hand gestures to express a character's thoughts and feelings.",
      },
    ],
    lesson: {
      title: "Design where the eye goes first",
      scenes: [
        {
          title: "Choose the focal point",
          caption: "The focal point is where you want someone to look first.",
          narration: "Imagine a poster for your school play. Decide what a person should notice from across the room. That first detail is the focal point.",
          duration: 12,
          visual: "steps",
          items: ["Play title", "Performance date", "Venue"],
          highlighted: [0],
        },
        {
          title: "Use contrast",
          caption: "A clear difference in size, colour or brightness draws attention.",
          narration: "Put a large dark title on a light background. Your eye can spot it quickly. If every line has the same size and weight, the lines compete for attention.",
          duration: 15,
          visual: "steps",
          items: ["Make one detail larger", "Pair light and dark", "Give the title room"],
          highlighted: [0, 1],
        },
        {
          title: "Test the order",
          caption: "Ask a viewer what they noticed first, second and third.",
          narration: "Show the poster to someone for three seconds. Ask what they remember first. If the venue jumps out before the title, adjust the size or spacing and try again.",
          duration: 15,
          visual: "steps",
          items: ["Show the poster", "Ask what stood out", "Revise and test again"],
          highlighted: [1, 2],
        },
      ],
    },
    explore: [
      {
        title: "Make a mark with empty space",
        text: "Draw a small black circle among crowded lines, then draw the same circle alone on a white page. Compare how quickly you spot it. The blank space changes the relationship between the circle and its surroundings.",
      },
      {
        title: "Tell a story with three poses",
        text: "Sketch a character noticing something, reacting and deciding what to do. Change only their eyes and posture. Ask a friend to describe the story before you explain it.",
      },
      {
        title: "How can one carved block make a pattern?",
        text: "In block printing, a raised design transfers colour to cloth when pressed against it. A textile fragment from Gujarat in the Metropolitan Museum of Art shows how repetition can build a richly patterned surface.",
      },
    ],
    questions: [
      {
        concept: "visual emphasis",
        difficulty: "medium",
        question: "A poster's date gets missed because every line looks equally bold. Which change would make the date easier to spot?",
        options: ["Add bold decorative borders everywhere", "Make all text the same shade of grey", "Give the date stronger contrast than nearby text", "Fill all the open space with symbols"],
        correctIndex: 2,
        explanation: "A clear difference from nearby text helps the date stand out at a glance.",
      },
      {
        concept: "visual emphasis",
        difficulty: "easy",
        question: "Which change is most likely to make one word stand out?",
        options: ["Use identical lettering throughout", "Make that word much larger than the others", "Move every word by the same distance", "Add equal space around every word"],
        correctIndex: 1,
        explanation: "Making one word larger creates contrast and gives the viewer a clear first place to look.",
      },
      {
        concept: "testing a design",
        difficulty: "medium",
        question: "How can you test whether strangers notice the play title first?",
        options: ["Show the poster briefly and ask what they remember first", "Tell them to look at the title before showing it", "Count the letters in the title", "Ask whether they own a ticket"],
        correctIndex: 0,
        explanation: "A brief viewing followed by an open question shows what caught their attention without pointing them toward the answer.",
      },
      {
        concept: "testing a design",
        difficulty: "easy",
        question: "Which question lets a viewer tell you what they actually saw first?",
        options: ["Isn't the date the biggest detail?", "Did you spot the title first?", "Can you read this word out loud?", "What was the first thing you noticed?"],
        correctIndex: 3,
        explanation: "An open question lets the viewer name the detail without being prompted.",
      },
    ],
    careers: [
      {
        title: "Graphic designer",
        text: "Use lettering, images and layout to communicate ideas. A design degree or diploma in graphic or communication design is one route. Start with drawing and typography, then build a portfolio that shows how your work changed after feedback.",
        url: "https://www.nid.edu/academics/programmes/bachelor-of-design-bdes/graphic-design-bdes.html",
      },
      {
        title: "Exhibition designer",
        text: "Plan how visitors move through a space and encounter objects, stories and signs. NID offers a Bachelor of Design in exhibition design. Start with spatial sketching and storytelling by drawing a one-room exhibit and marking where you want visitors to pause.",
        url: "https://www.nid.edu/academics/programmes/bachelor-of-design-bdes/exhibition-design-bdes.html",
      },
    ],
    people: [
      {
        title: "Amrita Sher-Gil",
        text: "Sher-Gil studied art in Paris and painted Group of Three Girls after returning to India. The National Gallery of Modern Art's virtual tour lets you compare the poses, colours and lighting in several of her paintings.",
        url: "https://ngmaindia.gov.in/virtual-tour-of-amrita-sher-gil.asp",
      },
    ],
    project: {
      title: "Make two posters for one event",
      intro: "Compare how two layouts guide readers through the same information.",
      steps: [
        "Pick a fictional school event. Write its title, date and place on two sheets of paper.",
        "Make the title the focus on one sheet and the date the focus on the other. Change size, spacing or colour while keeping the wording identical.",
        "Show each sheet to a different person for three seconds. Record what they noticed first and make one revision based on the results.",
      ],
    },
    path: ["Find the focal point in a painting", "Sketch two versions of a design", "Ask someone what they notice first", "Save a before-and-after example for a portfolio"],
    sources: [
      { title: "National Gallery of Modern Art · Amrita Sher-Gil virtual tour", url: "https://ngmaindia.gov.in/virtual-tour-of-amrita-sher-gil.asp" },
      { title: "UNESCO · Kutiyattam, Sanskrit theatre", url: "https://ich.unesco.org/en/RL/kutiyattam-sanskrit-theatre-00010" },
      { title: "Getty · Vocabulary for describing an artwork", url: "https://www.getty.edu/education/k-12-learning/describe-listen-draw/vocabulary-for-describing-an-artwork/" },
      { title: "Metropolitan Museum of Art · Textile fragment from Gujarat", url: "https://www.metmuseum.org/art/collection/search/448532" },
      { title: "National Institute of Design · Graphic design", url: "https://www.nid.edu/academics/programmes/bachelor-of-design-bdes/graphic-design-bdes.html" },
      { title: "National Institute of Design · Exhibition design", url: "https://www.nid.edu/academics/programmes/bachelor-of-design-bdes/exhibition-design-bdes.html" },
    ],
  },
  {
    id: "music",
    title: "Music",
    tagline: "Hear what changes when you move a clap, stretch a beat or bend a drum note.",
    icon: "🎵",
    tone: "music",
    discover: [
      {
        title: "A drum note can bend",
        text: "Tabla consists of two drums. On the larger drum, the bayan, a player can vary palm pressure on the drumhead while striking it with their fingertips to change the pitch.",
      },
      {
        title: "A circle can share one pulse",
        text: "In Garba of Gujarat, dancers move in a circle, singing and clapping together. UNESCO describes a performance that can begin slowly and gain speed as the dancers move.",
      },
    ],
    lesson: {
      title: "Beat, rhythm and tempo with claps and taps",
      scenes: [
        {
          title: "Tap the beat",
          caption: "The beat is the pulse you can tap along to.",
          narration: "Tap your foot four times with equal spaces between taps. Count one, two, three, four. Your foot is keeping a steady beat.",
          duration: 12,
          visual: "steps",
          items: ["Tap your foot", "Count evenly", "Repeat"],
          highlighted: [1],
        },
        {
          title: "Add a rhythm",
          caption: "Keep all four foot taps. Clap on counts one and three.",
          narration: "Keep your foot moving. Now clap on one and three, leaving two and four quiet. Your claps make a rhythm against the steady beat.",
          duration: 12,
          visual: "steps",
          items: ["Tap all four counts", "Clap on one and three", "Leave the other counts quiet"],
          highlighted: [1, 2],
        },
        {
          title: "Change the tempo",
          caption: "Tempo is the speed of the beat. The same clap pattern can go faster.",
          narration: "Repeat your clap pattern while tapping your foot more quickly. You still clap on one and three. The rhythm stays the same relative to the beat, while the tempo changes.",
          duration: 15,
          visual: "steps",
          items: ["Tap faster", "Clap on the same counts", "Listen for the difference"],
          highlighted: [0, 1],
        },
      ],
    },
    explore: [
      {
        title: "Can a silent count still have a beat?",
        text: "Tap four even counts with your foot. Say one, stay silent on two, then say three and four. Keep tapping during the silence and notice how you still know when three is due.",
      },
      {
        title: "Hear the sound of a material",
        text: "Tap the same four-count pattern gently on a notebook and an empty cardboard box. Keep the speed and the pattern steady. Compare the sound quality, or timbre, of the two surfaces.",
      },
      {
        title: "What are raga and tala?",
        text: "Hindustani and Carnatic classical music use melodic frameworks called ragas and recurring rhythmic cycles called talas. When you listen, follow the melody first, then listen for the return of a point in the rhythmic cycle.",
      },
    ],
    questions: [
      {
        concept: "tempo and rhythm",
        difficulty: "medium",
        question: "You clap on counts two and four, then repeat those same counts with faster foot taps. What changed?",
        options: ["Which counts get claps", "The number of beats in each group", "The speed of the beat", "The number of claps in each group"],
        correctIndex: 2,
        explanation: "The tempo increased. The claps still land in the same positions within the four-count pattern.",
      },
      {
        concept: "tempo and rhythm",
        difficulty: "easy",
        question: "What does tempo measure?",
        options: ["How fast the beat goes", "How high a note sounds", "How loud a drum is", "Which instrument is playing"],
        correctIndex: 0,
        explanation: "Tempo describes how quickly the beats follow one another.",
      },
      {
        concept: "beat and rhythm",
        difficulty: "medium",
        question: "Your foot taps all four counts. You clap on one and three, then switch to two and four without changing your foot taps. What changed?",
        options: ["The tempo increased", "The number of foot taps increased", "The beat stopped", "The clap rhythm moved to different counts"],
        correctIndex: 3,
        explanation: "The claps moved to different places against the same steady beat.",
      },
      {
        concept: "beat and rhythm",
        difficulty: "easy",
        question: "In the foot-tap and clap exercise, which action keeps the beat?",
        options: ["Clapping on one count only", "Tapping your foot evenly on each count", "Saying the name of an instrument", "Changing which count you clap on"],
        correctIndex: 1,
        explanation: "Even foot taps mark the pulse on every count.",
      },
    ],
    careers: [
      {
        title: "Recording engineer",
        text: "Set up microphones, choose recording levels and capture performances. Audio engineering or music production courses develop these skills. Start by recording the same sound at two microphone distances and listening for changes.",
        url: "https://www.berklee.edu/careers/roles/recording-engineer",
      },
      {
        title: "Music educator",
        text: "Help people learn to listen, perform and create. Music or music education studies build performance and teaching skills. Practise explaining a rhythm in two ways and ask a beginner which explanation makes it easier to follow.",
        url: "https://college.berklee.edu/music-education/careers",
      },
    ],
    people: [
      {
        title: "Zakir Hussain",
        text: "The Mumbai-born tabla player began learning from his father, Ustad Alla Rakha. He performed across musical traditions, showing how a percussionist can listen closely and respond to other players.",
        url: "https://www.arts.gov/honors/heritage/zakir-hussain",
      },
    ],
    project: {
      title: "Build an eight-count rhythm",
      intro: "Create a short pattern you can teach a friend using only a voice, claps and gentle taps.",
      steps: [
        "Write the numbers one to eight in a row. Mark three counts for claps and leave the other counts silent.",
        "Tap all eight counts at a steady speed. Add the marked claps and repeat the pattern twice.",
        "Teach a friend the pattern. Try it at a faster tempo, then swap a clap to a new count and describe what changed each time.",
      ],
    },
    path: ["Find the beat in a familiar song", "Make a pattern with sounds and silences", "Repeat it at two tempos", "Record or perform it for a listener"],
    sources: [
      { title: "Metropolitan Museum of Art · Musical instruments of the Indian subcontinent", url: "https://www.metmuseum.org/essays/musical-instruments-of-the-indian-subcontinent" },
      { title: "UNESCO · Garba of Gujarat", url: "https://ich.unesco.org/en/RL/garba-of-gujarat-01962" },
      { title: "NCERT · Learning outcomes for secondary music", url: "https://ncert.nic.in/pdf/publication/otherpublications/learning_outcomes.pdf" },
      { title: "Ableton Learning Music · Make beats", url: "https://learningmusic.ableton.com/make-beats/make-beats.html" },
      { title: "National Endowment for the Arts · Zakir Hussain", url: "https://www.arts.gov/honors/heritage/zakir-hussain" },
      { title: "Berklee · Careers in music production and engineering", url: "https://college.berklee.edu/mpe/careers" },
      { title: "Berklee · Careers in music education", url: "https://college.berklee.edu/music-education/careers" },
    ],
  },
  {
    id: "literature",
    title: "Literature & Languages",
    tagline: "See how stories, scripts and translations carry meaning across languages.",
    icon: "📚",
    tone: "literature",
    discover: [
      {
        title: "Three scripts helped crack a code",
        text: "The Rosetta Stone records a decree in Greek, Egyptian hieroglyphs and Demotic, another Egyptian script. Scholars used the readable Greek text to help decipher Egyptian writing.",
      },
      {
        title: "A poet can translate their own work",
        text: "Rabindranath Tagore prepared English versions of his Bengali poems. His English Gitanjali gave readers another way into his poetry and helped bring it to international attention.",
      },
    ],
    lesson: {
      title: "Translate the meaning of an idiom",
      scenes: [
        {
          title: "Read the scene around the words",
          caption: "Context helps you decide what an expression means.",
          narration: "Mina is nervous about her first club meeting. A short game breaks the ice. In this scene, that means the game makes it easier for everyone to start talking.",
          duration: 15,
          visual: "steps",
          items: ["A nervous group", "A short game", "Conversation starts"],
          highlighted: [2],
        },
        {
          title: "Name what the phrase does",
          caption: "An idiom can mean more than its individual words suggest.",
          narration: "Break the ice is an idiom. A word-for-word version might make readers picture a frozen lake. In this scene, the idea to carry over is helping people feel comfortable together.",
          duration: 15,
          visual: "steps",
          items: ["Read the whole phrase", "Check it against the scene", "Name the meaning"],
          highlighted: [2],
        },
        {
          title: "Choose wording for your reader",
          caption: "Try a familiar expression or a clear phrase with the same effect.",
          narration: "You could say the game got everyone talking. If another language has a familiar expression that fits, try it. Ask a reader to tell you what happened in the scene.",
          duration: 15,
          visual: "steps",
          items: ["Try plain wording", "Compare another expression", "Ask a reader to explain it"],
          highlighted: [0, 2],
        },
      ],
    },
    explore: [
      {
        title: "What is the difference between a language and a script?",
        text: "A script is a system of written signs. A language is the system people use to communicate, including through speech or signing. Hindi and Marathi are distinct languages that both commonly use Devanagari in writing.",
      },
      {
        title: "What can a translation keep?",
        text: "Read a rhyming line aloud and then say its meaning in plain words. The meaning can survive while the rhyme disappears. A translator might try new wording to keep some of that sound, depending on what matters in the piece.",
      },
      {
        title: "How does a storyteller change what you know?",
        text: "Retell the first day of school from the point of view of a new student, then from the point of view of a classroom door. Each narrator can notice different things. Choose one detail the second narrator would reveal sooner.",
      },
    ],
    questions: [
      {
        concept: "idioms in context",
        difficulty: "medium",
        question: "Riya says she has butterflies in her stomach before going onstage. What meaning should a translation carry?",
        options: ["She wants to study butterflies", "She feels nervous before performing", "She has forgotten the name of the play", "She is looking for something to eat"],
        correctIndex: 1,
        explanation: "The stage context tells us the butterflies are an image for the feeling of nervous excitement.",
      },
      {
        concept: "idioms in context",
        difficulty: "easy",
        question: "At the start of a club meeting, what does a game that breaks the ice do?",
        options: ["Makes the room colder", "Ends the meeting early", "Teaches people to make ice", "Helps people feel comfortable talking"],
        correctIndex: 3,
        explanation: "Here, breaking the ice means easing initial awkwardness so people can talk.",
      },
      {
        concept: "language and script",
        difficulty: "medium",
        question: "Two texts use Devanagari letters. What can you conclude from that alone?",
        options: ["They share a writing system", "They must use the same language", "They say the same thing", "They were written by the same person"],
        correctIndex: 0,
        explanation: "The letters identify the script. Languages such as Hindi and Marathi can share that script.",
      },
      {
        concept: "language and script",
        difficulty: "easy",
        question: "What does the word script mean when discussing writing systems?",
        options: ["A collection of poems", "The subject of a sentence", "A system of written signs", "The pace of a conversation"],
        correctIndex: 2,
        explanation: "A script provides the signs used to write a language.",
      },
    ],
    careers: [
      {
        title: "Translator",
        text: "Carry written meaning across languages in books, subtitles or public information. Language study and translation studies are useful routes. Start by comparing two translations of a short passage and explaining how each handles tone or idioms.",
        url: "https://www.ignou.ac.in/schools/programme/MATSOL",
      },
      {
        title: "Editor",
        text: "Work with writers to improve structure, clarity and consistency. Literature, journalism and publishing courses can build those skills. Try editing a short paragraph and explaining which changes help the reader follow the idea.",
        url: "https://careers.un.org/competitiveexamination",
      },
    ],
    people: [
      {
        title: "Rabindranath Tagore",
        text: "Tagore received the 1913 Nobel Prize in Literature. He wrote poetry, fiction and essays as well as songs. His English versions of his Bengali poems show how a writer can revisit their own work for another audience.",
        url: "https://www.nobelprize.org/prizes/literature/1913/tagore/article/",
      },
    ],
    project: {
      title: "Make an illustrated idiom card",
      intro: "Compare what an expression says word for word with what it means in a real conversation.",
      steps: [
        "Pick an idiom from a language you know. Write a two-line dialogue where someone would naturally use it.",
        "Draw the literal image on one side of a card. On the other, write the intended meaning in plain words or in another language you know.",
        "Give a friend the dialogue and ask them to guess the meaning. Revise one line if they need a better clue.",
      ],
    },
    path: ["Spot an expression in a story or conversation", "Infer its meaning from context", "Compare two possible translations", "Make an idiom card and test it with a reader"],
    sources: [
      { title: "British Museum · Room 4 guide to Egyptian objects", url: "https://www.britishmuseum.org/sites/default/files/2023-11/Room-4-Touch-Tour-Guide.pdf" },
      { title: "Nobel Prize · Tagore and his India", url: "https://www.nobelprize.org/prizes/literature/1913/tagore/article/" },
      { title: "Unicode Consortium · Devanagari and other South Asian scripts", url: "https://unicode.org/versions/Unicode18.0.0/core-spec/chapter-12/" },
      { title: "Cambridge Dictionary · Break the ice", url: "https://dictionary.cambridge.org/us/dictionary/english/break-the-ice" },
      { title: "IGNOU · Translation studies", url: "https://www.ignou.ac.in/schools/programme/MATSOL" },
      { title: "United Nations Careers · Language positions", url: "https://careers.un.org/competitiveexamination" },
    ],
  },
];

if (typeof module !== "undefined") module.exports = EXPLORE_HUMANITIES;
