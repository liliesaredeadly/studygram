// Featured field guides and reading lists for The Pursuit.
const PURSUIT_CATALOG = [
    {
        id: 'sports',
        title: 'Football & Sports',
        aliases: ['football', 'soccer', 'footballer', 'futsal', 'sport', 'sports', 'athlete', 'athletics', 'cricket', 'basketball', 'swimming', 'badminton', 'tennis', 'volleyball', 'coaching', 'coach', 'fitness', 'sports science', 'sports management', 'sports journalism', 'sports medicine', 'match analysis', 'refereeing', 'Cristiano Ronaldo', 'Lionel Messi'],
        icon: 'trophy',
        tone: 'blue',
        overview: 'Football rewards how well you read space and work with a team. Follow the game from school and community pitches to club leagues and national competitions, or explore the work that goes into coaching, analysis and running a team.',
        topics: [
            { title: 'How the game evolved', text: 'England codified early shared football laws in 1863. Uruguay hosted and won the first men’s FIFA World Cup in 1930. China hosted the first FIFA Women’s World Cup in 1991. Club competitions bring together teams such as Manchester United and Real Madrid, while World Cups are played by national teams.' },
            { title: 'Rules, roles and tactics', text: 'Use the IFAB Laws of the Game to look up offside, fouls and restarts. Watch how a goalkeeper, defender, midfielder and forward contribute when their team gains or loses the ball. Follow a player away from the ball to see how movement opens space.' },
            { title: 'Practice and preparation', text: 'Start with a comfortable first-touch or passing exercise and build towards a small-sided game with a coach or a group. Choose a safe space and use practice that fits your experience and energy. Give yourself time to rest and reflect on one thing you noticed.' }
        ],
        skills: ['Ball control and passing', 'Scanning and decision-making', 'Communication and teamwork', 'Observing patterns of play'],
        routes: [
            { title: 'Play locally', text: 'Try a school team or community club. Ask the coach for one skill to work on before your next session.' },
            { title: 'Train and compete', text: 'Build match experience in an age-appropriate league. If you want to pursue trials or academies, check opportunities through the club or your football association with a trusted adult.' },
            { title: 'Work around the game', text: 'Try logging clips for a team or learning the laws with a referee. Explore coaching, analysis, officiating, sports journalism, sports science and club operations.' }
        ],
        challenges: ['Selection can depend on team needs, access and timing.', 'School, travel and recovery all take time. A workable practice schedule can change from week to week.'],
        starter: 'Watch one passage of play and pause just before a pass. Name two options the player has and compare your read with the next few seconds.',
        people: [
            {
                name: 'Cristiano Ronaldo',
                summary: 'The Portuguese forward played for Sporting CP before moving to Manchester United in 2003. He began as a winger and also played through the middle for Portugal.',
                milestones: ['2003 · Made his senior debut for Portugal.', '2016 · Captained Portugal to its first men’s European Championship title.', '2018 · Won his fifth UEFA Champions League title, having won once with Manchester United and four times with Real Madrid.'],
                takeaway: 'Compare two clips from different points in Ronaldo’s career. Track where he starts a run and what changes when he plays centrally. Try applying one positioning idea in your next game.',
                sources: [
                    { title: 'UEFA profile and early career', url: 'https://www.uefa.com/uefaeuro/history/news/0253-0d814eb1f4aa-b6c174023ed0-1000--stars-of-uefa-euro-2016-cristiano-ronaldo/' },
                    { title: 'UEFA Portugal tournament record', url: 'https://www.uefa.com/uefaeuro/history/news/0269-1237d7969161-d49b9f604aa1-1000--portugal-euro-records-and-stats/' },
                    { title: 'UEFA Champions League titles', url: 'https://www.uefa.com/uefachampionsleague/news/0250-0c5117b83097-712dd4b75ccb-1000--ronaldo-first-to-win-five-champions-league-titles/' },
                    { title: 'Manchester United post-match interview', url: 'https://www.manutd.com/en/mutv/videos/detail/Cristiano-Ronaldo-exclusive-interview-after-Man-Utd-2-Villarreal-1-Sep-29-2021' }
                ]
            },
            {
                name: 'Lionel Messi',
                summary: 'The Argentine forward spent much of his club career at FC Barcelona before leaving in 2021. With Argentina, he reached the 2014 World Cup final and won the tournament in 2022.',
                milestones: ['2014 · Received the World Cup Golden Ball as Argentina finished runner-up.', '2021 · Won the Copa América with Argentina.', '2022 · Won the FIFA World Cup with Argentina and received his second World Cup Golden Ball.'],
                takeaway: 'Watch one buildup involving Messi and count the passing options his teammates create. Use what you notice to look for a better support position the next time you play.',
                sources: [
                    { title: 'FIFA profile and Argentina milestones', url: 'https://www.fifa.com/en/articles/lionel-messi-argentina-career' },
                    { title: 'FC Barcelona farewell press conference', url: 'https://www.fcbarcelona.com/en/videos/2210248/leo-messis-full-press-conference' }
                ]
            }
        ],
        sources: [
            { title: 'IFAB Laws of the Game', url: 'https://www.theifab.com/laws/latest/about-the-laws/' },
            { title: 'IFAB history of the laws', url: 'https://www.theifab.com/background/' },
            { title: 'FIFA history of the first men’s World Cup', url: 'https://inside.fifa.com/en/news/world-first-for-uruguay-2053846' },
            { title: 'FIFA history of the first women’s World Cup', url: 'https://inside.fifa.com/en/tournaments/womens/womensworldcup/chinapr1991/news/china-pr-1991-the-inaugural-champions' },
            { title: 'FIFA Training Centre grassroots sessions', url: 'https://www.fifatrainingcentre.com/en/practice/grassroots.php' }
        ]
    },
    {
        id: 'fashion',
        title: 'Modelling & Fashion',
        aliases: ['fashion', 'model', 'modeling', 'modelling', 'runway', 'runway modelling', 'runway modeling', 'commercial modelling', 'commercial modeling', 'fashion model', 'fashion modelling', 'fashion modeling', 'fashion photography', 'fashion photographer', 'styling', 'stylist', 'fashion design', 'fashion designer', 'costume design', 'textiles', 'sewing', 'casting'],
        icon: 'shirt',
        tone: 'orchid',
        overview: 'Fashion is a collaboration between people who design clothes, style looks, model, photograph and produce shoots or shows. Start with a creative brief and see which part of the work draws you in.',
        topics: [
            { title: 'Runway, commercial and creative work', text: 'A runway model presents garments in motion. A commercial shoot works from a brief about a product and audience. Stylists plan looks, photographers shape the image, and designers develop garments from ideas and materials.' },
            { title: 'Portfolios and professional etiquette', text: 'Create a private sample portfolio with simple photos, garment sketches or styling studies. Agree on a brief, arrive prepared, and credit collaborators. Agree on who can use the images and where before anyone takes or shares them.' },
            { title: 'Agencies, contracts and consent', text: 'Verify agency contact details independently and ask for client references and written terms. Upfront representation fees, guaranteed work and pressure to sign are warning signs. Review payment, commission, exclusivity and image use with a trusted adult if you are under 18. Ask them to accompany you to a verified casting. You can decline a pose, outfit, setting or use of your images.' }
        ],
        skills: ['Responding to a creative brief', 'Visual composition and styling', 'Portfolio editing', 'Communicating boundaries'],
        routes: [
            { title: 'Try a school or home project', text: 'Style an outfit from items you already have or make a mood board. Try photographing an object if you want to focus on lighting and framing.' },
            { title: 'Learn the craft', text: 'Explore sewing, textiles, design or photography through a school club, library guide or community class. Ask for feedback on how clearly your work communicates the brief.' },
            { title: 'Explore professional roles', text: 'Compare modelling, styling, garment production, fashion photography and show production. Use official studio or agency websites to verify opportunities before sharing personal information.' }
        ],
        challenges: ['Bookings and income can be irregular, and briefs can ask for very different styles.', 'Agree on image use before collaborating. Protect location and contact details when preparing any work for sharing.'],
        starter: 'Choose one garment and style it two ways using items you already have. Sketch or photograph each version privately and write what you wanted each look to communicate.',
        people: [
            {
                name: 'Diane von Furstenberg',
                summary: 'The Belgian-born designer is known for the wrap dress and built a fashion business around her work.',
                milestones: ['1970s · Introduced the wrap dress for which she became known.', '2023 · A Brussels exhibition traced her work in fashion.'],
                takeaway: 'Choose one detail that makes a garment easy to wear or adjust. Sketch two ways to apply that detail to a new piece for a specific use.',
                sources: [
                    { title: 'CFDA history of the wrap dress era', url: 'https://cfda.com/news/the-cfda-1962-2012/' },
                    { title: 'CFDA retrospective on Diane von Furstenberg', url: 'https://cfda.com/news/woman-before-fashion-homage-to-dvf-opens-in-brussels/' }
                ]
            }
        ],
        sources: [
            { title: 'FTC guide to spotting modelling scams', url: 'https://consumer.ftc.gov/articles/modeling-scams' },
            { title: 'UNICEF guidance on consent and sharing images', url: 'https://www.unicef.org/parenting/child-care/sharenting' },
            { title: 'The Met’s Costume Art exhibition', url: 'https://www.metmuseum.org/exhibitions/costume-art' }
        ]
    },
    {
        id: 'performance',
        title: 'Music & Performance',
        aliases: ['music', 'singing', 'singer', 'musician', 'instrument', 'guitar', 'piano', 'violin', 'drums', 'songwriting', 'songwriter', 'composition', 'composer', 'music production', 'music producer', 'sound engineering', 'sound engineer', 'dance', 'dancer', 'dancing', 'choreography', 'theatre', 'theater', 'actor', 'acting', 'performer', 'performance', 'voice acting', 'A. R. Rahman'],
        icon: 'music-2',
        tone: 'rose',
        overview: 'A performance can start with a beat, a movement or a line of dialogue. Explore how people compose, rehearse, perform and work behind the scenes to turn a small idea into something an audience can experience.',
        topics: [
            { title: 'Music and sound', text: 'Singing and instruments develop timing, listening and phrasing. Composition organizes musical ideas, production shapes recordings, and sound engineering brings voices and instruments into balance.' },
            { title: 'Movement, stage and rehearsal', text: 'Dancers build movement phrases and actors make choices about what a character wants. Rehearse a short passage, try a different choice and ask a collaborator what changed.' }
        ],
        skills: ['Listening and timing', 'Expression and interpretation', 'Rehearsal and revision', 'Working with an ensemble'],
        routes: [
            { title: 'Join a group', text: 'Ask about school theatre, choir, dance or a community ensemble. Start with a role or part that suits your experience.' },
            { title: 'Build technique', text: 'Use beginner lessons and short practice projects, then consider a mentor, community course or formal study once you know the craft you want to develop.' },
            { title: 'Explore work on and off stage', text: 'Compare performance, composition, choreography, production, sound engineering, lighting and stage management.' }
        ],
        challenges: ['Rehearsal takes patience and live schedules can be irregular.', 'Feedback can feel personal. Ask a specific question about the part you want to improve.'],
        starter: 'Make a four-bar beat, rehearse four lines of a scene or create four counts of movement. Repeat once with a single change and describe what you hear or see.',
        people: [
            {
                name: 'A. R. Rahman',
                summary: 'Rahman composed music for Slumdog Millionaire and shared the film’s original song award with lyricist Gulzar.',
                milestones: ['2009 · Won the Academy Award for Original Score for Slumdog Millionaire.', '2009 · Shared the Academy Award for Original Song for “Jai Ho”.'],
                takeaway: 'Play a short scene with and without a simple rhythm you make. Compare how the rhythm changes your sense of pace or mood.',
                sources: [{ title: 'Academy Awards 2009 official results', url: 'https://www.oscars.org/oscars/ceremonies/2009/E' }]
            }
        ],
        sources: [{ title: 'Ableton Learning Music browser lessons', url: 'https://learningmusic.ableton.com/' }]
    },
    {
        id: 'business',
        title: 'Business & Entrepreneurship',
        aliases: ['business', 'entrepreneur', 'entrepreneurship', 'startup', 'start-up', 'founder', 'small business', 'marketing', 'finance', 'accounting', 'leadership', 'business leader', 'sales', 'product development', 'product manager', 'product management', 'social entrepreneur', 'social entrepreneurship', 'Kiran Mazumdar-Shaw'],
        icon: 'briefcase-business',
        tone: 'amber',
        overview: 'Entrepreneurship starts with finding out what someone needs and testing whether your idea helps. A small prototype gives you a way to learn about customers, costs and how a team works before taking on commitments.',
        topics: [
            { title: 'Customers and business models', text: 'Ask people how they deal with a problem today. Sketch what you could offer, who would use it, who would pay and what it would cost to deliver.' },
            { title: 'Products, marketing and leadership', text: 'Try a paper prototype or a sample service before building the whole thing. Give collaborators clear roles and describe the offer in language your intended audience understands.' }
        ],
        skills: ['Interviewing and listening', 'Prototyping and measuring results', 'Basic budgeting', 'Team communication'],
        routes: [
            { title: 'Test a small idea', text: 'Help organize a school event or design a mock product for a problem you observe. Use a simple budget on paper and ask for feedback before spending money.' },
            { title: 'Learn business basics', text: 'Try a school enterprise club, a beginner course or a community mentoring programme. Practice estimating costs, gathering feedback and describing your idea.' },
            { title: 'Explore different roles', text: 'Look at product development, operations, marketing, accounting, sales and social enterprise. Ask how people in those roles define success.' }
        ],
        challenges: ['A positive reaction to an idea may differ from whether someone would use it.', 'Costs, time and responsibilities can grow as a project gets bigger. Track what you spend and agree on who handles each task.'],
        starter: 'Pick a small problem you see at school. Ask someone you know how they handle it today, then sketch a possible improvement and write one thing to test.',
        people: [
            {
                name: 'Kiran Mazumdar-Shaw',
                summary: 'Mazumdar-Shaw drew on fermentation science to build Biocon, an Indian biotechnology company.',
                milestones: ['1978 · Set up Biocon India with Les Auchincloss of Biocon Biochemicals.', 'Biocon’s early work included developing and producing industrial enzymes.'],
                takeaway: 'Pick a skill you already enjoy and list three problems it might help solve. Choose one problem and ask someone who experiences it about their current approach.',
                sources: [
                    { title: 'Biocon founder profile', url: 'https://www.biocon.com/about-us/board-of-directors-biocon/kiran-mazumdar-shaw-biocon/' },
                    { title: 'Biocon company history', url: 'https://www.biocon.com/legacy-biocon/' }
                ]
            }
        ],
        sources: [{ title: 'U.S. Small Business Administration planning resources', url: 'https://www.sba.gov/counseling/plan-your-business/' }]
    },
    {
        id: 'arts',
        title: 'Arts & Creativity',
        aliases: ['art', 'artist', 'arts', 'creativity', 'illustration', 'illustrator', 'painting', 'drawing', 'animation', 'animator', 'filmmaking', 'filmmaker', 'film', 'photography', 'photographer', 'graphic design', 'graphic designer', 'designer', 'creative writing', 'writing', 'writer', 'author', 'journalism', 'journalist', 'video editing', 'content creator', 'content creation', 'streamer', 'streaming', 'digital storytelling', 'digital storyteller'],
        icon: 'palette',
        tone: 'lilac',
        overview: 'Artists and storytellers use images, language and sound to shape what an audience notices. Try the same idea in two forms and see which lets you express what you had in mind.',
        topics: [
            { title: 'Visual craft', text: 'Illustrators, photographers and designers use framing, contrast and composition to guide attention. Animation adds timing and movement, while filmmaking combines shot choices with editing and sound.' },
            { title: 'Story and audience', text: 'Build a story around an observation or a character’s choice. For journalism, ask how you know each claim and which sources can confirm it. Ask permission before recording people or sharing their work.' }
        ],
        skills: ['Observation and composition', 'Story structure', 'Editing and source checking', 'Giving and using feedback'],
        routes: [
            { title: 'Make a short project', text: 'Try a sketch, short photo sequence, one-page story or storyboard. Work with materials you already have and keep an early draft to compare with your revision.' },
            { title: 'Develop a portfolio', text: 'Take part in a school paper, arts club or student film. Collect a few projects that show different skills and describe your role in each one.' },
            { title: 'Explore creative work', text: 'Compare illustration, animation, design, photography, writing, journalism, editing and digital production. Look at how each role works with collaborators and audiences.' }
        ],
        challenges: ['Creative projects often take several drafts and collaborators may interpret the same brief differently.', 'Publishing can create privacy and permission questions. You can use a private portfolio or a school audience for early work.'],
        starter: 'Tell a simple story about a change in three panels, three sentences or three photos of objects. Show it to someone you trust and ask what they think changed.',
        people: [
            {
                name: 'Hayao Miyazaki',
                summary: 'Miyazaki began as an animator at Toei Animation and later became a director and co-founder of Studio Ghibli.',
                milestones: ['1963 · Joined Toei Animation.', '2003 · Won the Animated Feature Film Oscar for Spirited Away.', '2014 · Received an Academy Honorary Award.'],
                takeaway: 'Storyboard a familiar place. Change the angle in one panel and see how it shifts attention or mood.',
                sources: [{ title: 'Academy profile of Hayao Miyazaki', url: 'https://www.oscars.org/governors-awards/2014/hayao-miyazaki' }]
            }
        ],
        sources: [{ title: 'Pixar in a Box creative lessons', url: 'https://www.pixar.com/pixar-in-a-box' }]
    },
    {
        id: 'stem',
        title: 'Science & Technology',
        aliases: ['science', 'scientist', 'research', 'researcher', 'inventor', 'technology', 'tech', 'coding', 'programming', 'programmer', 'software', 'computer science', 'robotics', 'AI', 'artificial intelligence', 'engineering', 'engineer', 'mathematics', 'maths', 'math', 'physics', 'chemistry', 'biology', 'space', 'astronomy', 'astronaut', 'architecture', 'architect', 'aerospace', 'aviation', 'pilot', 'Kalpana Chawla'],
        icon: 'flask-conical',
        tone: 'teal',
        overview: 'Science asks what evidence would answer a question. Engineering and computing ask how to build and test a solution within constraints. Both involve sharing results so other people can check your work.',
        topics: [
            { title: 'Questions, evidence and models', text: 'Start with a question that can be measured. Compare observations, record the limits of your method, and use maths to describe patterns. Public datasets let you investigate without special equipment.' },
            { title: 'Design, code and iteration', text: 'Engineers sketch, prototype and measure performance. Programmers break a problem into steps and test how their code behaves. Architects balance how a space works with who uses it and how it can be built.' }
        ],
        skills: ['Breaking down problems', 'Collecting and interpreting evidence', 'Debugging and testing', 'Explaining decisions and uncertainty'],
        routes: [
            { title: 'Build or investigate', text: 'Make a paper prototype, use a browser coding exercise or graph a public dataset. Keep a record of the question and what you changed.' },
            { title: 'Find a learning community', text: 'Try a science club, school lab, robotics team or citizen-science project. Ask a teacher which maths or science classes will prepare you for the work you enjoyed.' },
            { title: 'Compare career paths', text: 'Explore research, engineering, software, data analysis, architecture and aviation. Look up local training and accreditation with the relevant institution if a role has formal entry requirements.' }
        ],
        challenges: ['First attempts often reveal a flaw in a design or a weakness in the evidence.', 'Projects can depend on shared tools or specialist supervision. A simulation or public dataset can be a starting point.'],
        starter: 'Build two paper bridges of different shapes. Compare how many similar small objects each one can hold and record what you kept the same between trials.',
        people: [
            {
                name: 'Kalpana Chawla',
                summary: 'Chawla earned a doctorate in aerospace engineering and became the first Indian-born NASA astronaut.',
                milestones: ['1994 · Selected as a NASA astronaut candidate.', '1997 · Flew as a mission specialist aboard space shuttle Columbia on STS-87.', '2003 · Served as flight engineer and mission specialist on STS-107.'],
                takeaway: 'Pick a spacecraft instrument or a small engineering system. Draw what goes into it, what it does and how you would tell that it worked.',
                sources: [
                    { title: 'NASA astronaut selection and first mission', url: 'https://www.nasa.gov/people-of-nasa/30-years-ago-nasa-selects-its-15th-group-of-astronauts/' },
                    { title: 'NASA STS-107 crew and mission', url: 'https://www.nasa.gov/remembering-columbia-sts-107/' }
                ]
            }
        ],
        sources: [{ title: 'NASA citizen science projects', url: 'https://science.nasa.gov/citizen-science/' }]
    },
    {
        id: 'public-service',
        title: 'Public Service & Other Pathways',
        aliases: ['public service', 'civil service', 'civil servant', 'government', 'public policy', 'law', 'lawyer', 'legal', 'diplomacy', 'diplomat', 'defence', 'defense', 'military', 'medicine', 'medical', 'doctor', 'nursing', 'nurse', 'healthcare', 'health care', 'psychology', 'psychologist', 'education', 'teacher', 'teaching', 'volunteering', 'social work', 'social worker', 'hospitality', 'chef', 'cooking', 'culinary arts', 'community service', 'public health', 'Malala Yousafzai'],
        icon: 'landmark',
        tone: 'slate',
        overview: 'There are many ways to work with people and serve a community. Compare what a teacher, health worker, lawyer, public official or hospitality team actually does each day and which responsibilities appeal to you.',
        topics: [
            { title: 'Service, rights and institutions', text: 'Public policy and civil service turn decisions into programmes. Lawyers research and interpret rules, diplomats represent institutions, and teachers plan ways to make ideas understandable.' },
            { title: 'Care, hospitality and professional responsibility', text: 'Health and psychology roles emphasize careful observation and confidentiality. Hospitality teams coordinate timing, safety and service. Different roles carry distinct training and entry requirements.' }
        ],
        skills: ['Listening and explaining clearly', 'Evaluating evidence', 'Ethical judgment and confidentiality', 'Coordinating with others'],
        routes: [
            { title: 'Try a supervised activity', text: 'Tutor a peer through school, help with a community event or join a debate. Reflect on which responsibilities you enjoyed.' },
            { title: 'Investigate entry requirements', text: 'For medicine, psychology, law, teaching and defence, look up the official local regulator, training institution or recruitment body. Ask a counsellor which school subjects support the route you are considering.' },
            { title: 'Compare related careers', text: 'Explore healthcare, education, law, public administration, community work, hospitality and culinary careers. Find out who each role serves and what a typical day involves.' }
        ],
        challenges: ['Some pathways involve formal training and supervised experience over several years.', 'Service work may involve difficult conversations, competing needs or sensitive information. Practice handling these in appropriate, supervised settings.'],
        starter: 'Choose one small issue at school. Ask a teacher or student group how it is handled today, then write a three-sentence proposal for one change you could help test.',
        people: [
            {
                name: 'Malala Yousafzai',
                summary: 'Yousafzai advocates for access to education, including the rights of girls to attend school.',
                milestones: ['2013 · Spoke at the United Nations on her 16th birthday.', '2014 · Shared the Nobel Peace Prize with Kailash Satyarthi for work on children’s rights and education.'],
                takeaway: 'Choose an issue you can explore safely with a teacher. Write a short message that describes who it affects, what you have learned and one specific action you are asking for.',
                sources: [
                    { title: 'Malala Yousafzai addresses the UN Youth Assembly', url: 'https://webtv.un.org/en/asset/k0d/k0ds3pg45t' },
                    { title: 'Norwegian Nobel Committee 2014 announcement', url: 'https://www.nobelprize.org/prizes/peace/2014/press-release/' }
                ]
            }
        ],
        sources: [{ title: 'UNICEF Youth Action Guide', url: 'https://www.unicef.org/youthledaction/reports/unicef-youth-advocacy-guide' }]
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PURSUIT_CATALOG;
}
