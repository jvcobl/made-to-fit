// Every word in Larkspur. Scripts are lists of nodes interpreted by story.js.
// Nodes: {who,t} line · {gut} inner voice · {notice:dim,t} perception · {hint:id} · {ask:[{t,sub,if,do,go,tag}]} · {label} · {go} · {if,go} · {do:[...]} · {face,who} · {call} · {end}

// profile: what each resident likes, on the same six dials as yours (from PEOPLE below); their bodies show what pinches
export const CAST = {
  gil: { name: 'Gil', role: 'your manager at the Works', roles: { 2: 'runs the Works', 3: 'retired, and at the Shed on Fridays' }, look: { shape: 'boxy', color: '#cbb9a2', pattern: 'plain', top: 'ears', wear: 'glasses' }, voice: ['hum', 0.82], tint: '#8a6f4e', profile: { sound: 0.55, light: 0.3, people: 0.65, talk: 0.75, time: 0.45, change: 0.35 } },
  pip: { name: 'Pip', role: 'bakes for the whole town', look: { shape: 'round', color: '#ffc98e', pattern: 'belly', top: 'longears', wear: 'bow' }, voice: ['chime', 1.25], tint: '#c8553d', profile: { sound: 0.45, light: 0.6, people: 0.85, talk: 0.55, time: 0.2, change: 0.5 } },
  moss: { name: 'Moss', role: 'runs the tea cart', look: { shape: 'blobby', color: '#9fd3b0', pattern: 'spots', top: 'ears', wear: 'leaf' }, voice: ['hum', 0.62], tint: '#2b7a5a', profile: { sound: 0.3, light: 0.5, people: 0.4, talk: 0.45, time: 0.4, change: 0.4 } },
  rue: { name: 'Rue', role: 'works the Blend kiosk', roles: { 2: 'on Blend\'s measures team', 3: 'runs plain-notes workshops' }, look: { shape: 'tall', color: '#f3a0c2', pattern: 'stripes', top: 'antennae', wear: 'none' }, voice: ['whistle', 1.0], tint: '#d0457f', profile: { sound: 0.6, light: 0.65, people: 0.6, talk: 0.25, time: 0.6, change: 0.75 } },
  bea: { name: 'Bea', role: 'has lived on Home Row for fifty years', roles: { 2: 'has lived on Home Row longer than anyone', 3: 'has lived on Home Row longer than anyone' }, look: { shape: 'round', color: '#e3d2ef', pattern: 'plain', top: 'ears', wear: 'hat' }, voice: ['hum', 1.12], tint: '#6c5c9e', cart: true, profile: { sound: 0.35, light: 0.55, people: 0.55, talk: 0.4, time: 0.25, change: 0.3, aid: true } },
  wren: { name: 'Wren', role: 'makes lanterns at the Far End', look: { shape: 'spiky', color: '#a99be8', pattern: 'plain', top: 'horns', wear: 'scarf' }, voice: ['click', 1.0], tint: '#4f4aa8', profile: { sound: 0.2, light: 0.35, people: 0.2, talk: 0.15, time: 0.55, change: 0.25 } },
  clover: { name: 'Clover', role: 'keeps the Fix-It Shed', roles: { 3: 'retired from the Fix-It Shed' }, look: { shape: 'blobby', color: '#cde38f', pattern: 'spots', top: 'tuft', wear: 'flower' }, voice: ['chime', 0.92], tint: '#5f7a2a', profile: { sound: 0.55, light: 0.65, people: 0.5, talk: 0.3, time: 0.3, change: 0.7 } },
  hollis: { name: 'Hollis', role: 'is the mayor', look: { shape: 'boxy', color: '#93c2ee', pattern: 'plain', top: 'ears', wear: 'hat' }, voice: ['hum', 0.7], tint: '#3f5a87', profile: { sound: 0.5, light: 0.6, people: 0.5, talk: 0.35, time: 0.35, change: 0.3 } },
  // minor residents: no notebook page of their own, but they live here, they react to places, and fixes cost or help them
  dot: { name: 'Dot', role: 'works at the next desk', minor: true, look: { shape: 'tall', color: '#9edcd6', pattern: 'spots', top: 'tuft', wear: 'glasses' }, voice: ['chime', 1.12], tint: '#2b7a78', profile: { sound: 0.55, light: 0.22, people: 0.45, talk: 0.3, time: 0.5, change: 0.4 } },
  fen: { name: 'Fen', role: 'works two desks down', minor: true, look: { shape: 'spiky', color: '#f6cf5b', pattern: 'plain', top: 'horns', wear: 'none' }, voice: ['hum', 0.92], tint: '#8a6a12', profile: { sound: 0.6, light: 0.92, people: 0.6, talk: 0.5, time: 0.3, change: 0.4 } },
  // ten and twenty years on (they appear only in the visits listed in acts)
  tomas: { name: 'Tomas', role: 'runs the mail room at the Works', minor: true, acts: [2], look: { shape: 'boxy', color: '#7d9fe0', pattern: 'plain', top: 'tuft', wear: 'scarf', wheels: true }, voice: ['hum', 0.88], tint: '#3f5a87', profile: { sound: 0.5, light: 0.5, people: 0.55, talk: 0.4, time: 0.4, change: 0.4 } },
  ada: { name: 'Ada', role: 'started at the Works this spring', minor: true, acts: [2], look: { shape: 'round', color: '#bfa9f0', pattern: 'spots', top: 'longears', wear: 'hat' }, voice: ['chime', 1.1], tint: '#6c5c9e', profile: { sound: 0.45, light: 0.22, people: 0.5, talk: 0.5, time: 0.5, change: 0.4 } },
  ines: { name: 'Ines', role: 'fixes lantern frames with Wren', minor: true, acts: [2, 3], look: { shape: 'tall', color: '#9fd3b0', pattern: 'stripes', top: 'antennae', wear: 'glasses' }, voice: ['click', 1.05], tint: '#2b7a5a', profile: { sound: 0.3, light: 0.45, people: 0.3, talk: 0.15, time: 0.5, change: 0.3 } },
  marta: { name: 'Marta', role: 'drives the van', minor: true, acts: [2], look: { shape: 'blobby', color: '#f6cf5b', pattern: 'belly', top: 'ears', wear: 'hat' }, voice: ['hum', 0.95], tint: '#8a6a12', profile: { sound: 0.6, light: 0.6, people: 0.5, talk: 0.5, time: 0.3, change: 0.5 } },
  sana: { name: 'Sana', role: 'answers the call bell, for twelve towns', minor: true, voiceOnly: true, acts: [2], voice: ['chime', 1.0], tint: '#4f6f8f' },
  unit: { name: 'Unit', role: 'sorts the mail now', minor: true, voiceOnly: true, machine: true, acts: [2], voice: ['click', 1.4], tint: '#8a7f70' },
  juno: { name: 'Juno', role: 'new in town', minor: true, acts: [3], look: { shape: 'spiky', color: '#f2a99a', pattern: 'stripes', top: 'antennae', wear: 'flower' }, voice: ['whistle', 1.15], tint: '#c8553d', profile: { sound: 0.5, light: 0.5, people: 0.5, talk: 0.5, time: 0.5, change: 0.5 } },
  hester: { name: 'Hester', role: 'of the Founders\' Fund', minor: true, acts: [3], look: { shape: 'tall', color: '#c9b8a6', pattern: 'plain', top: 'ears', wear: 'hat' }, voice: ['hum', 1.02], tint: '#8a6f4e', profile: { sound: 0.5, light: 0.55, people: 0.5, talk: 0.45, time: 0.4, change: 0.35 } },
  bao: { name: 'Bao', role: 'sells dumplings with Lin, from a cart', minor: true, acts: [3], look: { shape: 'round', color: '#ffc98e', pattern: 'spots', top: 'longears', wear: 'bow' }, voice: ['chime', 1.05], tint: '#9a3a22', profile: { sound: 0.65, light: 0.6, people: 0.75, talk: 0.5, time: 0.4, change: 0.6 } },
  pomeroy: { name: 'Pomeroy', role: 'sells apples on the square, loudly', minor: true, look: { shape: 'round', color: '#e4796a', pattern: 'belly', top: 'ears', wear: 'hat' }, voice: ['hum', 0.78], tint: '#9a3a22', profile: { sound: 0.85, light: 0.6, people: 0.85, talk: 0.4, time: 0.2, change: 0.5 } },
};

// where people are: [fromMin, toMin, place, spot] per day (0 = any day). place 'town' | 'works' | 'hall' | 'away'
export const ROUTINES = {
  gil: [[0, 510, 'away'], [510, 1050, 'works', 'gil'], [1050, 1150, 'town', 'cartFront'], [1150, 1500, 'away']],
  pip: [[0, 420, 'away'], [420, 900, 'town', 'bakery'], [900, 1050, 'town', 'commons'], [1050, 1230, 'town', 'squareW'], [1230, 1500, 'away']],
  moss: [[0, 480, 'away'], [480, 1170, 'town', 'cart'], [1170, 1500, 'away']],
  rue: [[0, 540, 'away'], [540, 1080, 'town', 'kiosk'], [1080, 1200, 'town', 'bench_square'], [1200, 1500, 'away']],
  bea: [[0, 480, 'away'], [480, 630, 'town', 'house3'], [630, 780, 'town', 'squareE'], [780, 960, 'town', 'garden'], [960, 1080, 'town', 'busBench'], [1080, 1500, 'away']],
  wren: [[0, 420, 'away'], [420, 720, 'town', 'workshop'], [720, 780, 'town', 'pond'], [780, 1200, 'town', 'workshop'], [1200, 1500, 'away']],
  clover: [[0, 480, 'away'], [480, 1080, 'town', 'shed'], [1080, 1500, 'away']],
  hollis: [[0, 540, 'away'], [540, 720, 'town', 'hallSteps'], [720, 840, 'town', 'statueSide'], [840, 1080, 'town', 'hallSteps'], [1080, 1500, 'away']],
  dot: [[0, 500, 'away'], [500, 1020, 'works', 'dot'], [1020, 1500, 'away']],
  fen: [[0, 495, 'away'], [495, 1030, 'works', 'fen'], [1030, 1500, 'away']],
  pomeroy: [[0, 480, 'away'], [480, 1140, 'town', 'apples'], [1140, 1500, 'away']],
};
// ten and twenty years on: one festival day each. Anyone not listed is away (moved, retired, or never born yet).
// who someone is, in the visit you're in (some roles move on with the years)
export const roleOf = (id, act) => { const c = CAST[id]; return c ? (c.roles && c.roles[act]) || c.role : ''; };
export const ROUTINES_ACT = {
  2: {
    gil: [[0, 480, 'away'], [480, 700, 'works', 'gil'], [700, 1080, 'town', 'cartFront'], [1080, 1500, 'away']],
    pip: [[0, 420, 'away'], [420, 900, 'town', 'bakery'], [900, 1050, 'town', 'commons'], [1050, 1230, 'town', 'squareW'], [1230, 1500, 'away']],
    moss: [[0, 480, 'away'], [480, 1170, 'town', 'cart'], [1170, 1500, 'away']],
    rue: [[0, 540, 'away'], [540, 1080, 'town', 'kiosk'], [1080, 1500, 'away']],
    bea: [[0, 470, 'away'], [470, 560, 'town', 'busBench'], [560, 760, 'hall', 'kiosk'], [760, 980, 'town', 'crossing'], [980, 1080, 'town', 'squareE'], [1080, 1500, 'away']],
    wren: [[0, 420, 'away'], [420, 1200, 'town', 'workshop'], [1200, 1500, 'away']],
    ines: [[0, 540, 'away'], [540, 1140, 'town', 'wrenBench'], [1140, 1500, 'away']],
    clover: [[0, 480, 'away'], [480, 1080, 'town', 'shed'], [1080, 1500, 'away']],
    hollis: [[0, 540, 'away'], [540, 1080, 'town', 'hallSteps'], [1080, 1500, 'away']],
    pomeroy: [[0, 480, 'away'], [480, 1140, 'town', 'apples'], [1140, 1500, 'away']],
    tomas: [[0, 480, 'away'], [480, 1050, 'works', 'tomas'], [1050, 1500, 'away']],
    ada: [[0, 495, 'away'], [495, 700, 'works', 'ada'], [700, 1500, 'away']],
    marta: [[0, 470, 'away'], [470, 1200, 'town', 'van'], [1200, 1500, 'away']],
  },
  3: {
    gil: [[0, 470, 'away'], [470, 1050, 'town', 'shedYard'], [1050, 1500, 'away']],
    clover: [[0, 470, 'away'], [470, 620, 'town', 'shedYard2'], [620, 900, 'town', 'bench_commons'], [900, 1500, 'away']],
    rue: [[0, 470, 'away'], [470, 640, 'town', 'shedYard3'], [640, 1080, 'town', 'kiosk'], [1080, 1500, 'away']],
    ines: [[0, 470, 'away'], [470, 1050, 'town', 'shedYard4'], [1050, 1500, 'away']],
    pip: [[0, 420, 'away'], [420, 900, 'town', 'bakery'], [900, 1050, 'town', 'commons'], [1050, 1230, 'town', 'squareW'], [1230, 1500, 'away']],
    moss: [[0, 480, 'away'], [480, 1170, 'town', 'cart'], [1170, 1500, 'away']],
    bea: [[0, 480, 'away'], [480, 900, 'town', 'house3'], [900, 1140, 'town', 'squareE'], [1140, 1500, 'away']],
    wren: [[0, 420, 'away'], [420, 1200, 'town', 'workshop'], [1200, 1500, 'away']],
    hollis: [[0, 540, 'away'], [540, 1080, 'town', 'hallSteps'], [1080, 1500, 'away']],
    juno: [[0, 560, 'away'], [560, 1140, 'town', 'junoSpot'], [1140, 1500, 'away']],
    hester: [[0, 660, 'away'], [660, 1020, 'town', 'statueSide'], [1020, 1500, 'away']],
    bao: [[0, 540, 'away'], [540, 1140, 'town', 'apples'], [1140, 1500, 'away']],
  },
};

export const HINTS = {
  henderson: { by: 'gil', t: 'It would be great if someone could take a look at the Henderson file.', literal: 'Someone could look at it, if they have time.', between: 'He wants you to do it. Today.', truth: 'between',
    right: 'You finished the Henderson file before lunch. Gil looked relieved, then pretended he had not been worried.', wrong: 'The next morning Gil asked, very gently, how the Henderson file was coming along. It was not coming along.', asked: '"Oh! Yes. Today, if you can. Sorry, I should have just said."' },
  norush: { by: 'gil', t: 'No rush at all on the slides, whenever you get a sec!', literal: 'There is no rush.', between: 'There is a rush.', truth: 'between',
    right: 'The slides were done by three. At four, Gil presented them to the board, which he had not mentioned.', wrong: 'At four, Gil presented an empty slide that said SLIDES. He did not say anything to you about it, which was worse.', asked: '"Ha. By four, ideally. The board meets at four. Huh. I should have said."' },
  advisement: { by: 'hollis', t: 'A fascinating idea. I shall take it under advisement.', literal: 'He will think it over.', between: 'That was a polite no.', truth: 'between',
    right: 'You did not wait around. Hollis seemed almost relieved to be understood.', wrong: 'You waited a day for Hollis to take it out from under advisement. It stayed there.', asked: '"Ah. Well. If I am honest, no. Not unless it passes at the town meeting."' },
  busy: { by: 'pip', t: 'Well! You must be very busy.', literal: 'Pip thinks you are busy.', between: 'Pip needs to close up.', truth: 'between',
    right: 'You said goodbye and Pip flipped the sign to CLOSED with a grateful little wave.', wrong: 'You stayed and chatted while Pip wiped the same spot on the counter eleven times.', asked: '"Oh, ha, no, I\'m closing! But come back tomorrow, really."' },
  advisement_gil: { by: 'gil', t: 'Love it. Love the energy. Let\'s think about it!', literal: 'He is going to think about it.', between: 'That was a no, for now.', truth: 'between',
    right: 'You did not hold your breath. Gil never brought it up again, and you had already taken it elsewhere.', wrong: 'You waited for Gil to bring it up again. He never did.', asked: '"Honestly? Not this quarter. Take it to the town meeting, maybe."' },
  // three where the words mean exactly what they say
  bea_pot: { by: 'bea', t: 'Bring the pot back whenever. Not never. Whenever.', literal: 'Whenever suits you.', between: 'She wants it back today.', truth: 'literal',
    right: 'You brought the pot back when you were ready. Bea took it, delighted. "See? Whenever. Not never."', wrong: 'You hurried the pot back that same evening, still damp. Bea blinked at it. "I said whenever, dear. I meant whenever."', asked: '"Whenever means whenever, dear. Just not never."' },
  clover_six: { by: 'clover', t: 'Rough sketch now. Proper drawings on your phone by six.', literal: 'The drawings will be there at six.', between: 'That means sometime. Do not wait up.', truth: 'literal',
    right: 'At six on the dot, the drawings were on your phone. Clover means six.', wrong: 'You stopped expecting them. At six on the dot, the drawings were on your phone anyway. Clover means six.', asked: '"Six. As in six o\'clock. Why, is six bad?"' },
  moss_leave: { by: 'moss', t: 'I\'ll leave you to it, then. Tea\'s there if you want it.', literal: 'She is giving you some peace.', between: 'You have overstayed your welcome.', truth: 'literal',
    right: 'You sat with your tea and nobody needed anything from you. Moss came back just as the cup was empty.', wrong: 'You apologized to Moss for being a bother. She looked puzzled. "Bother? I was giving you some peace, love."', asked: '"Leave you to it. Your tea, your quiet. Nothing more to it, love."' },
  comein: { by: 'wren', t: 'Come in or do not. I am working either way.', literal: 'You are welcome to come in.', between: 'Wren wants you to go away.', truth: 'literal',
    right: 'You came in. Wren handed you a coil of wire without looking up, which turned out to be the warmest thing Wren does.', wrong: 'You left. Later Wren asked Moss if you were all right, because you had gone without saying anything.', asked: '"I said come in. I meant come in."' },
};

export const BARRIER = {
  works: { title: 'The Works', over: { light: 'The ceiling panels glare, and one of them flutters at the edge of your eye.', sound: 'Keyboards, a radio, three phone calls at once. Louder than you like.', people: 'Desks pressed close. Somebody is always just behind you.', time: 'The afternoon drags on. Your body clocked out a while ago.', change: 'Every minute here is already scheduled by someone else.' }, under: { time: 'Your body has not agreed that it is morning yet.', sound: 'The hum is the loudest thing in the room. Nobody talks.', people: 'Everyone has headphones in. You could be anywhere.', change: 'Same desk, same chair, same nine o\'clock. Forever, it feels like.' } },
  market: { title: 'Market Square', over: { sound: 'Music from two stalls at once, a cart rattling, someone selling apples by shouting at them.', people: 'The noon rush. Bodies on every side, all moving in different directions.', light: 'Sun off every window and every pane of the kiosk.' }, under: { people: 'Hardly anyone around. The square feels like it is waiting for something.' } },
  transit: { title: 'Transit Stop', over: { change: 'A crackle from the speaker. Something about the route. Then nothing.', sound: 'Engines idling, brakes hissing, the speaker clearing its throat.' }, under: { change: 'The timetable has not changed since before you were born.' } },
  commons: { title: 'The Commons', over: { light: 'Bright open lawn and nowhere to stand in the shade.' }, under: { people: 'A quiet park. Pleasant, but nobody to talk to.', sound: 'Very still. Just a wind chime somewhere.' } },
  farend: { title: 'The Far End', over: {}, under: { sound: 'It is so quiet you can hear your thoughts going in circles.', people: 'Not a soul around. It is peaceful, and a little lonely.', light: 'The lanes are dim. The lanterns are not lit yet.' } },
  homerow: { title: 'Home Row', over: { people: 'Neighbors drop by without warning. Somebody is always at a door.' }, under: { people: 'Curtains drawn up and down the row.' } },
  hall: { title: 'Town Hall', over: { people: 'Every bench full. Every face turned the same way.', sound: 'Murmuring that never quite stops, then a gavel.', talk: 'Everyone is speaking in the careful way people speak when they mean something else.' }, under: {} },
  street: { title: 'Larkspur', over: { sound: 'Traffic and voices bouncing between the buildings.', people: 'A crowd on the sidewalk.', light: 'Glare from every window.' }, under: { people: 'Empty streets.', sound: 'Very quiet.' } },
  festival: { title: 'The Lantern Festival', over: { people: 'Everyone in Larkspur, in one square, at once.', sound: 'Music, laughter, a brass band that is mostly enthusiasm.', light: 'Strings of lights, flash after flash of phones.', time: 'It is late, and the night is just getting started.' }, under: {} },
};
// what your body does first, by what pinches and which way (no lessons here; the card does the rest)
export const GUTS = {
  over: {
    light: ['Your eyes want to close.', 'You squint without meaning to.'],
    sound: ['Your shoulders have climbed up toward your ears.', 'Every sound arrives at once.'],
    people: ['You make yourself smaller without deciding to.', 'You keep checking who is behind you.'],
    talk: ['You replay what they said, looking for what they meant.'],
    time: ['Your body clocked out a while ago.'],
    change: ['You keep checking the clock, as if it might change too.'],
  },
  under: {
    light: ['You lean in to see, and lean in again.'],
    sound: ['The quiet rings in your ears.', 'You can hear your own thoughts going in circles.'],
    people: ['You check your phone for no reason.', 'You catch yourself waiting for someone.'],
    talk: ['It lands harder than they meant it.'],
    time: ['You yawn, and then yawn again.'],
    change: ['Your mind wanders off to somewhere less fixed.'],
  },
};
// who else pays when an owner changes a place for you: [speaker, line]; the speaker is named on the line
export const BYSTANDER = {
  gil: { over: { light: ['Fen', 'Bit dim for me now. I\'ll bring my lamp tomorrow.'], other: ['Fen', 'No radio? Fine. I\'ll hum.'] }, under: { other: ['Ola', 'Radio\'s on? Fine. I\'ll wear my earplugs.'] } },
  moss: { over: { other: ['A regular', 'Was enjoying that song. Ah well.'] }, under: { other: ['A regular', 'Bit loud for a Tuesday.'] } },
  clover: { over: { other: ['clover', 'Freckles. I\'ll live.'] }, under: { other: ['clover', 'My hinge can wait. It\'s waited this long.'] } },
  wren: { over: { other: ['wren', 'It is a bad radio. I will work around it.'] }, under: { other: ['wren', 'It is a bad radio. I will work around it.'] } },
  hollis: { over: { other: ['clover', 'Bit nippy. I\'ll keep my coat on.'] }, under: { other: ['clover', 'Bit nippy. I\'ll keep my coat on.'] } },
};
// a hand you can give back, at their busy time on festival day (one per person per visit); zone is where it costs you
export const FAVOURS = {
  gil: { m: 630, zone: 'market', ask: 'Could you run the festival mail over to the square? It\'s piling up.', from: 'Gil (work)',
    yes: [{ note: 'You carry a crate of festival mail across the square. Every envelope says URGENT in Gil\'s handwriting.' }, { who: 'gil', t: 'You\'re a lifesaver. A lifesaver! Okay. Great.' }], keep: 'You ran the festival mail for Gil',
    no: { who: 'gil', t: 'Totally fine! Totally. I\'ll do a second trip. Great exercise.' } },
  moss: { m: 720, zone: 'market', ask: 'Could you mind the cart for the noon rush? Half an hour.', from: 'Moss',
    yes: [{ note: 'You mind the cart through the noon rush. Forty-one teas. One man asks for coffee and is gently turned away.' }, { who: 'moss', t: 'You\'re a natural, love. Sit. That one\'s yours.' }], keep: 'You minded Moss\'s cart',
    no: { who: 'moss', t: 'Course not, love. I\'ve done it on my own for years. I\'ll do it once more.' } },
  clover: { m: 840, zone: 'commons', ask: 'Can you hold a gate at the Shed? Two minutes. Possibly twenty.', from: 'Clover',
    yes: [{ note: 'You hold a gate level in the bright Commons while Clover argues with a hinge, lovingly.' }, { who: 'clover', t: 'Hold it... hold it... perfect. That gate will outlive us both.' }], keep: 'You held a gate for Clover',
    no: { who: 'clover', t: 'Not yet is fine! I\'ll prop it with a brick. The brick is very reliable.' } },
  hollis: { m: 1110, zone: 'market', ask: 'Might you help hang the bunting on the square? Civic duty calls. Loudly.', from: 'Hollis',
    yes: [{ note: 'You hang bunting across the square while Hollis directs from the ground, mostly with his eyebrows.' }, { who: 'hollis', t: 'Splendid! Slightly to the left. No, the other left. Splendid!' }], keep: 'You hung bunting with Hollis',
    no: { who: 'hollis', t: 'Quite right. Quite right. I shall ask the bakery delegation.' } },
  wren: { m: 1140, zone: 'market', ask: 'Can you carry lanterns to the square with me? One crate. It is heavy.', from: 'Wren',
    yes: [{ note: 'You carry a crate of lanterns to the square. Wren walks beside you and counts them twice.' }, { who: 'wren', t: 'One hundred and twelve. All here. Thank you for not swinging the crate.' }], keep: 'You carried lanterns with Wren',
    no: { who: 'wren', t: 'That is a clear answer. Thank you. I will take two trips.' } },
};
export const NOTICE = {
  works: { light: 'The third panel from the window stutters now and then. Most people tune it out. You can\'t, and that is not in your head. It is in the ballast.', sound: 'Under everything there is a hum at the pitch of a held note. It is the lights.', talk: 'Nobody here says what they want. They say what would be "great."' },
  market: { sound: 'Two speakers, two songs, half a beat apart. Of course it feels like a headache.', people: 'The stalls funnel everyone into one lane at noon.' },
  transit: { change: 'The timetable has an asterisk. The asterisk says "subject to change." The changes are only ever announced out loud.', sound: 'The speaker is mounted facing the road, not the bench.' },
  homerow: { people: 'Nobody on Home Row can tell from outside whether a neighbor wants company.', talk: 'Every door has a different rule, and none of them are written down.' },
  farend: { people: 'Wren\'s sign says "knock once." It is the clearest sign in town.' },
};
export const ASK = {
  gil: { yes: '"Oh! Sure, sure. I can turn the radio off and switch off the row by your desk. Anything for the new person."', no: '"Hm. Everyone else seems pretty happy with it? Let\'s see how it goes."',
    yesUnder: '"Too quiet? Ha! Easy. Radio\'s going on, low. And I\'ll swing by more. Not too much. Some."', noUnder: '"Hm. I think people like it quiet in here? Let\'s see how it goes."' },
  moss: { yes: '"Say no more. Stool behind the cart, love. I\'ll turn the speaker down."', no: '"Wish I could. It\'s not my music, love."',
    yesUnder: '"Slow one today, isn\'t it? Radio\'s on. Pull up a stool and keep me company."', noUnder: '"Wish I could fill it up for you, love. It\'s a slow day for everyone."' },
  clover: { yes: '"Shade! Course. Here, take the parasol."', no: '"Nothing I can move, sorry."',
    yesUnder: '"Too quiet out here? Come hold this hinge. I\'ll tell you all about hinges. You\'ll regret it."', noUnder: '"I\'m up to my elbows in a gate. Later?"' },
  wren: { yes: '"I can put the radio on. It is a bad radio."', no: '"No. I need the quiet. The Commons has music."' },
  hollis: { yes: '"Let us open a window, then! Fresh air for democracy."', no: '"Ah. Well. We have always done it this way."' },
};

// ---------- the prologue ----------
export const PROLOGUE = {
  bus: ['Larkspur. About a thousand people, give or take one.', 'It was planned around a statue.', 'Nobody in town looks quite like it. Nobody seems to mind.'],
  arrive: 'No. 2, Home Row. Yours.',
  room: 'Empty, for now. First things first: you.',
  setup: 'Now make it yours. Everything in here can be set the way you like it.',
  done: 'There. Everything in this room is set exactly the way you like it.',
  doneGut: 'Remember how this feels.',
};
export const SETUP = {
  lamp: { q: 'How bright do you like it?', lo: 'Soft and dim', hi: 'Bright and clear', dim: 'light' },
  radio: { q: 'How loud do you like the world?', lo: 'Quiet', hi: 'Lively', dim: 'sound' },
  sign: { q: 'Your door sign. Who is welcome, and when?', lo: 'Drop by any time!', hi: 'Text first, please', dim: 'people', invert: true },
  note: { q: 'House rules for visitors. How do you like to be told things?', lo: 'Say exactly what you mean', hi: 'I will read the room', dim: 'talk' },
  clock: { q: 'When does your day really start?', lo: 'At sunrise', hi: 'Around noon, ideally', dim: 'time' },
  calendar: { q: 'Your week.', lo: 'Planned, in pen', hi: 'We will see what happens', dim: 'change' },
};
export const TEXTS = {
  arrival: [['Gil (work)', 'Welcome to the team!! We start at 9ish but most folks are in by 8:45 :)'], ['Blend', 'Moving is stressful. Blend helps new residents fit in 3x faster. Tap to learn more!'], ['Bea, No. 4', 'This is Bea from No. 4. There\'s soup on your step. The pot is mine.']],
};

// ---------- people ----------
export const TALK = {
  gil: {
    shift1: [
      { if: 'flag.late1', go: 'late' },
      { who: 'gil', t: 'You made it! Welcome, welcome. That desk by the plant is all yours.' }, { go: 'tour' },
      { label: 'late' }, { who: 'gil', t: 'Oh hey! No worries, no worries at all. Most folks are in by quarter to, but honestly, no worries.' }, { gut: 'Three no-worries. That is one worry.' },
      { label: 'tour' },
      { who: 'gil', t: 'Coffee is there, printer is there, the light by the window does a little dance. We love it.' },
      { notice: 'light', zone: 'works', do: ['idea.dim'] },
      { hint: 'henderson' },
      { who: 'gil', t: 'Anyway! Shout if you need anything. My door is always open.' },
      { gut: 'His door is glass. And closed.' },
    ],
    meeting2: [
      { who: 'gil', t: 'Okay team! Quick sync. Super quick. Should be fifteen minutes.' },
      { note: 'It is forty minutes. Nobody writes anything down.' },
      { notice: 'talk', zone: 'works', do: ['idea.plain'] },
      { hint: 'norush' },
      { if: 'fix.dim=proposal|fix.dim=ready|fix.plain=proposal|fix.plain=ready|fix.ramp=proposal|fix.ramp=ready', go: 'idea' }, { go: 'out' },
      { label: 'idea' }, { who: 'you', t: 'I have an idea for the office, actually.' },
      { who: 'gil', t: 'Love that. Love the energy.' }, { hint: 'advisement_gil' },
      { label: 'out' }, { who: 'gil', t: 'Great sync, everyone. Great sync.' }, { do: ['know.gil.under'] },
    ],
    d1: [{ who: 'gil', t: 'Hey, it\'s the new person! Settling in? The tea here is better than ours, don\'t tell anyone.' }, { gut: 'He looks tired around the eyes.' },
      { if: 'blend & !flag.gil_pills', go: 'pills' }, { end: true },
      { label: 'pills' }, { who: 'gil', t: 'Oh, you got Blend? Me too. It reminds me to take my pills. Best thing on my phone. Also the worst thing on my phone.' }, { do: ['flag.gil_pills'] }],
    d2: [
      { who: 'gil', t: 'Long day. Those panels give me a headache by three, honestly. Don\'t tell anyone. Management has to love the panels.' },
      { do: ['flag.gil_head', 'know.gil.over'] },
      { ask: [{ t: 'They give me one too.', tag: 'plain', do: ['bond.gil+1'], go: 'same' }, { t: 'You could ask for different ones.', do: ['idea.dim'] }, { t: 'Say nothing.', tag: 'quiet' }, { t: 'The panels are great, though!', blend: true, if: 'blend', go: 'great', id: 'blend_gil' }] },
      { end: true }, { label: 'same' }, { who: 'gil', t: 'Really? Huh. I thought it was just me.' }, { do: ['idea.dim'] }, { end: true },
      { label: 'great' }, { who: 'gil', t: 'Ha! Yeah. Great panels. Management loves them.' }, { gut: 'He rubs his eyes when he thinks nobody is looking.' },
    ],
    d3: [{ who: 'gil', t: 'Big night tonight. Hollis is doing a speech. Hollis is always doing a speech.' }],
    again: [{ who: 'gil', t: 'Shout if you need anything!' }],
    back: {
      dim: [{ who: 'gil', t: 'Softer lights? For the whole office?' }, { if: 'flag.gil_head', go: 'yes' }, { who: 'gil', t: 'I mean... I do get headaches. Fine. Put me down.' }, { do: ['back.dim', 'know.gil.helps'] }, { end: true }, { label: 'yes' }, { who: 'gil', t: 'You remembered. Yes. Put me down. Put me down twice.' }, { do: ['back.dim', 'bond.gil+1', 'know.gil.helps'] }],
    },
  },
  moss: {
    d1: [
      { who: 'moss', t: 'New face. Sit, if you like. Tea\'s on me the first time, and every time after that you look like you need it.' },
      { do: ['energy+10', 'self+2', 'bond.moss+1', 'know.moss.love'] },
      { who: 'moss', t: 'The square gets loud at noon. I keep headphones and shades under the counter for regulars, at cost. For when it\'s a lot.' },
      { ask: [{ t: 'Can I see them?', do: [], go: 'shop' }, { t: 'Thanks. Good to know.', tag: 'warm' }, { t: 'Thanks!! Super helpful!', blend: true, if: 'blend', go: 'blend', id: 'blend_moss' }] },
      { end: true }, { label: 'shop' }, { call: 'shop' }, { end: true },
      { label: 'blend' }, { who: 'moss', t: 'Super helpful. Mm. You sound like Rue\'s phone, love. They\'re under the counter if you need them.' },
    ],
    d2: [
      { who: 'moss', t: 'Noon is when my regulars leave. The ones who come for the quiet. Then it\'s just me and the shouting.' },
      { do: ['idea.quiet', 'know.moss.over', 'know.moss.under'] },
      { ask: [{ t: 'What if the market had a quiet hour?', go: 'q' }, { t: 'Can I see the headphones again?', go: 'shop' }, { t: 'That sounds lonely.', tag: 'warm', do: ['bond.moss+1'] }] },
      { end: true }, { label: 'q' }, { who: 'moss', t: 'A quiet hour. Hah. I\'ve wished for one out loud for six years. Out loud is the wrong way to wish for quiet, I suppose.' }, { end: true },
      { label: 'shop' }, { call: 'shop' },
    ],
    d3: [{ who: 'moss', t: 'Festival tonight. I\'ll be the one with the tea and the slightly overwhelmed face.' }, { ask: [{ t: 'Can I see the headphones?', go: 'shop' }, { t: 'Save me a cup.', tag: 'warm', do: ['bond.moss+1'] }] }, { end: true }, { label: 'shop' }, { call: 'shop' }],
    again: [{ who: 'moss', t: 'Back again. Good.' }, { ask: [{ t: 'Can I see the headphones and shades?', go: 'shop' }, { t: 'Just saying hi.', tag: 'warm', go: 'hi' }] }, { end: true }, { label: 'shop' }, { call: 'shop' }, { end: true },
      { label: 'hi' }, { if: 'hint.moss_leave=right|hint.moss_leave=wrong|hint.moss_leave=asked', end: true }, { hint: 'moss_leave' }],
    back: {
      quiet: [{ who: 'moss', t: 'A quiet hour. Put my name down. Put it down quietly.' }, { do: ['back.quiet', 'bond.moss+1', 'know.moss.helps'] }],
      lanterns: [{ who: 'moss', t: 'Lights that say come in or not now? I\'d know when to bring tea and when to leave it on the step. Yes.' }, { do: ['back.lanterns'] }],
    },
  },
  pip: {
    d1: [
      { who: 'pip', t: 'New face! First loaf is free. Second loaf is also free if you tell me what Gil said about my scones.' }, { do: ['know.pip.love', 'know.gil.love'] },
      { ask: [{ t: 'He did not say anything about your scones.', tag: 'plain', go: 'plain' }, { t: 'He loved them.', go: 'nice' }, { t: 'He LOVED them!!', blend: true, if: 'blend', go: 'nice', id: 'blend_pip' }] },
      { label: 'plain' }, { who: 'pip', t: 'Nothing! Nothing is worse than bad. You\'re honest, I like that. Take two.' }, { do: ['bond.pip+1', 'energy+6'] }, { end: true },
      { label: 'nice' }, { who: 'pip', t: 'Did he! Ha. Ha ha. He didn\'t, did he.' }, { do: ['energy+6'] },
    ],
    d2: [
      { who: 'pip', t: 'Delivered forty rolls to the Works this morning. Up those steps. With a cart. I\'ve dropped seven trays on those steps this year.' },
      { do: ['idea.ramp'] },
      { who: 'pip', t: 'And I miss half the bus changes. The ovens are louder than the speaker.' }, { do: ['know.pip.over'] },
      { do: ['idea.board'] },
      { if: 'late', go: 'closing' }, { end: true },
      { label: 'closing' }, { hint: 'busy' },
    ],
    d3: [{ who: 'pip', t: 'Town meeting tonight. I vote for whatever keeps people coming through my door. Bring me something that does that.' }, { who: 'pip', t: 'An empty shop makes me nervous. Quiet is nice for other people.' }, { do: ['know.pip.under'] }],
    again: [{ who: 'pip', t: 'Still here! Want a bun?' }, { do: ['energy+3'] }],
    back: {
      ramp: [{ who: 'pip', t: 'A ramp at the Works? Seven trays. This year. Yes. Where do I sign.' }, { do: ['back.ramp', 'bond.pip+1', 'know.pip.helps'] }],
      board: [{ who: 'pip', t: 'A board that shows the changes? Then I can stop asking strangers if the bus is the bus. Yes.' }, { do: ['back.board', 'know.pip.helps'] }],
    },
  },
  rue: {
    pitch: [
      { who: 'rue', t: 'Hi! Hi. New in town? You have the look. Moving is SO much. That\'s what Blend is for!' },
      { who: 'rue', t: 'It coaches you in real time. A little nudge here, a smoother answer there, and you just... fit. I have a {rueStreak}-day streak.' },
      { ask: [{ t: 'Install Blend', sub: 'free', tag: 'blend', do: ['blend.install'], go: 'yes' }, { t: 'What does it cost?', go: 'cost' }, { t: 'Maybe later.', go: 'later' }] },
      { label: 'cost' }, { who: 'rue', t: 'It\'s free! You pay in attention. That\'s a joke. Mostly.' },
      { ask: [{ t: 'Install Blend', sub: 'free', tag: 'blend', do: ['blend.install'], go: 'yes' }, { t: 'Maybe later.', go: 'later' }] },
      { label: 'later' }, { who: 'rue', t: 'Totally! It\'ll be here. It\'s always here.' }, { do: ['know.rue.no'] }, { end: true },
      { label: 'yes' }, { who: 'rue', t: 'Yay! Welcome to Blend! You\'re going to love how easy everything gets.' }, { face: 'happy', who: 'rue' },
    ],
    d2: [
      { who: 'rue', t: 'Day four hundred and thirteen! Honestly I don\'t remember what day one felt like.' },
      { if: 'flag.rue_cracked', go: 'still' },
      { ask: [{ t: 'Do you ever turn it off?', tag: 'plain', go: 'off', id: 'rue_off2' }, { t: 'Congrats!', go: 'yay', id: 'rue_yay' }, { t: 'Congrats!! Day 413 is HUGE!', blend: true, if: 'blend', go: 'yay', id: 'blend_rue' }] },
      { label: 'yay' }, { who: 'rue', t: 'Thank you!! That\'s the right answer! Blend would have suggested exactly that.' }, { who: 'rue', t: 'Honestly, a day without a notification and I wouldn\'t know what to do with my hands.' }, { do: ['know.rue.under'] }, { end: true },
      { label: 'off' }, { who: 'rue', t: 'Once.' }, { face: 'sad', who: 'rue' }, { who: 'rue', t: 'I didn\'t like who was there. Or I didn\'t know them. I used to work at the Works, you know. I never knew what anyone wanted from me. Then Blend told me.' },
      { do: ['flag.rue_cracked', 'bond.rue+1', 'idea.plain', 'know.rue.over'] }, { end: true },
      { label: 'still' }, { who: 'rue', t: 'I\'m still thinking about what you asked. It\'s very inconvenient.' },
    ],
    // at the pond, if she asked you to come (her hardest scene; Settings can summarize it)
    pond: [
      { who: 'rue', t: 'You came. I wasn\'t sure you would. I wasn\'t sure I would.' },
      { who: 'rue', t: 'The phone\'s in the kiosk drawer. I keep thinking I can hear it buzzing from here. I can\'t. I just know it is.' },
      { who: 'rue', t: 'Some mornings I can\'t get out of bed. The streak is how I get up. I\'m scared of what\'s under it.' },
      { ask: [{ t: 'You don\'t have to decide anything today.', tag: 'plain', go: 'a', id: 'pond_nodecide' }, { t: 'What helps, on the bad mornings?', go: 'b', id: 'pond_helps' }] },
      { label: 'a' }, { who: 'rue', t: 'No. I don\'t, do I. Huh.' }, { go: 'end' },
      { label: 'b' }, { who: 'rue', t: 'Moss leaves tea at the kiosk without asking. Wren lent me a pencil. And you asked. That\'s three things. That\'s a lot of things.' },
      { label: 'end' },
      { who: 'rue', t: 'I\'ve started talking to someone at the clinic on Thursdays. About the mornings. I haven\'t told anyone that.' },
      { do: ['flag.rue_pond', 'w.rue_pond', 'bond.rue+1', 'know.rue.helps'] },
    ],
    pondSummary: [{ note: 'You sit with Rue by the pond for a while. She tells you about the hard mornings, and that she has started talking to someone at the clinic about them.' }, { do: ['flag.rue_pond', 'w.rue_pond', 'bond.rue+1', 'know.rue.helps'] }],
    d3: [
      { if: 'rue=easing & !smooth', go: 'free' },
      { who: 'rue', t: 'Big night! I\'ll be at the festival with my streak. Four hundred and fourteen!' }, { end: true },
      { label: 'free' }, { who: 'rue', t: 'I\'ve been thinking about what you asked. About turning it off.' },
      { who: 'rue', t: 'I\'m going to the festival tonight without it. Will you say hi, if you see me? I might be hard to recognize. Even to me.' },
      { who: 'rue', t: 'I used to draw. Every day. I might bring a pencil.' }, { do: ['know.rue.love'] },
      { who: 'rue', t: 'I still use something to help me read people. A notes app. It just doesn\'t keep score.' },
      { ask: [{ t: 'I will find you.', tag: 'warm', do: ['flag.rue_free', 'bond.rue+1'] }, { t: 'Are you sure?', go: 'sure' }] },
      { end: true }, { label: 'sure' }, { who: 'rue', t: 'No. That\'s sort of the point.' }, { do: ['flag.rue_free'] },
    ],
    again: [
      { who: 'rue', t: 'Smooth day? Don\'t forget your daily drop!' },
      { if: 'flag.rue_cracked | !day=1', end: true },
      { ask: [{ t: 'Do you ever turn it off?', tag: 'plain', go: 'off', id: 'rue_off1' }, { t: 'I won\'t forget.', id: 'rue_drop' }] }, { end: true },
      { label: 'off' }, { who: 'rue', t: 'Once.' }, { face: 'sad', who: 'rue' }, { who: 'rue', t: 'I didn\'t like who was there. Or I didn\'t know them. I used to work at the Works, you know. I never knew what anyone wanted from me. Then Blend told me.' },
      { do: ['flag.rue_cracked', 'bond.rue+1', 'idea.plain', 'know.rue.over'] },
    ],
    back: {
      plain: [{ who: 'rue', t: 'Notes that say who does what by when? If the Works had done that, I might still work there. Yes. Sign me up.' }, { do: ['back.plain', 'bond.rue+1', 'know.rue.helps'] }],
    },
  },
  bea: {
    d1: [
      { who: 'bea', t: 'Ah, No. 2. Did you get the soup?' }, { hint: 'bea_pot' }, { do: ['know.bea.no'] },
      { who: 'bea', t: 'I\'ve lived on this row for fifty years. Got the Town Hall its ramp, you know. Took four years and a great many casseroles.' }, { do: ['know.bea.love'] },
      { ask: [{ t: 'Four years for one ramp?', tag: 'plain', go: 'ramp' }, { t: 'How do I get things changed here?', go: 'how' }] },
      { label: 'ramp' }, { who: 'bea', t: 'For one ramp. They kept saying people coped. People were coping because they had no choice, I told them.' }, { do: ['bond.bea+1'] }, { end: true },
      { label: 'how' }, { who: 'bea', t: 'Find who else it pinches. There\'s always someone. Then go see Clover at the Fix-It Shed and make a nuisance of yourself.' }, { do: ['bond.bea+1', 'flag.knows_shed'] },
    ],
    bus1: [
      { if: 'flag.blend_heard', go: 'phone' },
      { who: 'bea', t: 'Did you catch that, dear? No? Nobody ever does. The 5:40 must have gone down Elm again. Nobody told the bench.' }, { go: 'on' },
      { label: 'phone' }, { who: 'bea', t: 'Your phone heard it? Read it to me, dear. Elm. So the 5:40 went down Elm today, did it? Well. Nobody told the bench.' },
      { label: 'on' },
      { who: 'bea', t: 'They only say the changes over that speaker. Says them to the road, mostly. My daughter missed the festival last year on account of it.' },
      { do: ['idea.board', 'flag.bea_bus', 'know.bea.under'] },
    ],
    d2: [
      { who: 'bea', t: 'My cart and the Works steps have an understanding. The understanding is no.' },
      { do: ['idea.ramp'] },
      { who: 'bea', t: 'And at noon the market makes my hearing aid sing. Like a kettle with opinions.' },
      { do: ['idea.quiet', 'know.bea.over'] },
      { ask: [{ t: 'I am working on it.', tag: 'plain', do: ['bond.bea+1'] }, { t: 'That sounds hard.', tag: 'warm' }, { t: 'Aw, that sounds SO hard! Stay positive!', blend: true, if: 'blend', go: 'pos', id: 'blend_bea' }] },
      { end: true }, { label: 'pos' }, { who: 'bea', t: 'Positive. Yes, dear. I\'ll let my hearing aid know.' },
    ],
    d3: [{ who: 'bea', t: 'My daughter takes the 7:40 in for the festival. If the route changes again I\'ll be standing at that bench like a lamppost.' }, { if: 'fix.board=built|fix.board=approved', go: 'ok' }, { end: true }, { label: 'ok' }, { who: 'bea', t: 'Though I hear the board works now. Imagine that. Written down.' }, { face: 'happy', who: 'bea' }],
    again: [{ who: 'bea', t: 'Still here, dear. So am I. So is the bench.' }],
    back: {
      quiet: [{ who: 'bea', t: 'A quiet hour? My hearing aid would write you a thank-you card.' }, { do: ['back.quiet', 'know.bea.helps'] }],
      board: [{ who: 'bea', t: 'Written down. Where a person can read it. Oh, yes.' }, { do: ['back.board', 'bond.bea+1', 'know.bea.helps'] }],
      ramp: [{ who: 'bea', t: 'A ramp at the Works? Took me four years last time. Let\'s see if you\'re quicker.' }, { do: ['back.ramp', 'bond.bea+1'] }],
    },
  },
  wren: {
    d1: [
      { hint: 'comein' },
      { if: 'hint.comein=wrong', end: true },
      { who: 'wren', t: 'I make lanterns. One hundred and twelve for the festival. I have finished sixty-one.' },
      { who: 'wren', t: 'People here think I am rude. I am not rude. I am specific.' },
      { ask: [{ t: 'I like specific.', tag: 'plain', do: ['bond.wren+1'], go: 'like' }, { t: 'How are you, though, really?', go: 'how' }, { t: 'Can I help?', go: 'help' }] },
      { label: 'like' }, { who: 'wren', t: 'Good. Then I will tell you a specific thing: the glue is on the left.' }, { end: true },
      { label: 'how' }, { who: 'wren', t: 'Tired. Sixty-one of one hundred and twelve. You asked.' }, { end: true },
      { label: 'help' }, { who: 'wren', t: 'Yes. Fold along the line. The line is the line, not near the line.' }, { call: 'fold' }, { do: ['bond.wren+1', 'self+4', 'know.wren.love'] },
    ],
    d2: [
      { who: 'wren', t: 'The Works sends me briefs. This one says "make it pop." Pop is not a size. Pop is not a color.' },
      { do: ['idea.plain'] },
      { who: 'wren', t: 'And people knock and then stand there waiting for me to guess why. If I could put a light out that says come in, and a light that says not now, I would never have to guess.' },
      { do: ['idea.lanterns', 'know.wren.over'] },
      { ask: [{ t: 'Can I fold some lanterns?', go: 'help' }, { t: 'You should not have to guess.', tag: 'plain', do: ['bond.wren+1'] }] },
      { end: true }, { label: 'help' }, { call: 'fold' }, { do: ['bond.wren+1', 'self+4'] },
    ],
    d3: [
      { who: 'wren', t: 'One hundred and twelve. Done. Almost. I left three blank. For you to paint, for people you know. Not for people in general. For people.' },
      { call: 'paint' },
      { who: 'wren', t: 'I do not usually go to the festival. Too much guessing.' },
      { if: 'fix.lanterns=built|fix.lanterns=approved', go: 'lights' },
      { who: 'wren', t: 'Do you want me to come? Say it plainly.' },
      { ask: [{ t: 'Yes. I would like you there.', tag: 'plain', do: ['flag.wren_invited', 'bond.wren+1'], go: 'yes' }, { t: 'Only if you want to!', go: 'vague' }, { t: 'Up to you.', go: 'vague' }, { t: 'Totally up to you, no pressure!!', blend: true, if: 'blend', go: 'blend', id: 'blend_wren' }] },
      { label: 'vague' }, { who: 'wren', t: 'That is not an answer. I will stay here.' }, { end: true },
      { label: 'blend' }, { who: 'wren', t: 'That is a lot of words and no answer. I will stay here.' }, { end: true },
      { label: 'yes' }, { who: 'wren', t: 'Then I will come. Thank you for saying it like that.' }, { face: 'happy', who: 'wren' }, { do: ['know.wren.under'] }, { end: true },
      { label: 'lights' }, { who: 'wren', t: 'But there will be lanterns on the porches now. Teal for come in. I can read that. I will come.' }, { do: ['flag.wren_invited'] }, { face: 'happy', who: 'wren' },
    ],
    again: [{ who: 'wren', t: 'Still working.' }, { ask: [{ t: 'Can I fold a few?', go: 'help' }, { t: 'I will leave you to it.', tag: 'plain' }] }, { end: true }, { label: 'help' }, { call: 'fold' }, { do: ['self+3'] }],
    back: {
      plain: [{ who: 'wren', t: 'One note. Who does what by when. Yes. Obviously yes.' }, { do: ['back.plain', 'bond.wren+1', 'know.wren.helps'] }],
      lanterns: [{ who: 'wren', t: 'Porch lanterns. I will make them. At the price on my sign. People always ask for free.' }, { do: ['back.lanterns', 'bond.wren+1', 'know.wren.helps'] }],
    },
  },
  clover: {
    d1: [
      { who: 'clover', t: 'Ooh, a new face! Welcome to the Fix-It Shed. Mostly we fix gates. Sometimes we fix towns.' }, { who: 'clover', t: 'A shed with nothing to fix is the saddest place in Larkspur. So I go looking.' }, { do: ['know.clover.under'] },
      { who: 'clover', t: 'Here\'s how it works. Bring me whatever pinches. I sketch it. Then we find who else it pinches, because there\'s always someone, and we take it to whoever decides.' },
      { call: 'proposals' },
    ],
    d2: [
      { if: '!flag.statue_seen', go: 'archive' }, { who: 'clover', t: 'Back! What have you got for me?' }, { call: 'proposals' }, { end: true },
      { label: 'archive' }, { call: 'archive' }, { call: 'proposals' },
    ],
    d3: [
      { if: '!flag.statue_seen', go: 'archive' }, { who: 'clover', t: 'Festival day. I\'m loading the cart with everything that might break tonight. Which is everything.' }, { call: 'proposals' }, { end: true },
      { label: 'archive' }, { call: 'archive' }, { call: 'proposals' },
    ],
    again: [{ who: 'clover', t: 'Back again! Show me what you have.' }, { call: 'proposals' }],
    back: {
      dim: [{ who: 'clover', t: 'Softer lights at the Works? I\'ve replaced that flickering ballast twice. They keep buying the cheap ones. Yes.' }, { do: ['back.dim'] }],
    },
    archive: [
      { who: 'clover', t: 'You\'ll want to see this. I was clearing out the loft and found the founders\' ledger.' },
      { who: 'clover', t: 'Every step in town is eight inches, because that suited the Standard\'s legs. Every bell is as loud as the Standard liked. Every workday starts at the hour the Standard woke up.' },
      { who: 'clover', t: 'And the Standard itself? The founders measured the volunteers at the Works one summer. Whoever was young and around. Then they averaged them.' },
      { note: 'A faded photo: a summer crew in work shirts, squinting into the sun.' },
      { who: 'clover', t: 'Nobody in town matches it. Not one. Not even Hollis, and he\'s tried.' },
      { do: ['flag.statue_seen', 'know.clover.love'] },
      { if: 'day=2 & !flag.council', go: 'tell' }, { end: true },
      { label: 'tell' }, { who: 'clover', t: 'Tell Hollis before the meeting, if you like. He reads a ledger the way other people read letters.' },
    ],
  },
  hollis: {
    d1: [
      { who: 'hollis', t: 'Welcome to Larkspur! A town that fits its people like a glove.' },
      { who: 'hollis', t: 'Built to the measure of the Standard Resident, you know. Every step, every bell. It works beautifully.' },
      { ask: [{ t: 'Does it fit you?', tag: 'plain', go: 'fit' }, { t: 'It is a lovely town.', go: 'lovely' }, { t: 'Best town ever, honestly!', blend: true, if: 'blend', go: 'best', id: 'blend_hollis' }] },
      { label: 'fit' }, { who: 'hollis', t: 'Me? Well, I... It fits everyone. That is what standard means.' }, { gut: 'He shifted his weight when he said it.' }, { do: ['know.hollis.under'] }, { end: true },
      { label: 'lovely' }, { who: 'hollis', t: 'Is it not! Is it not.' }, { do: ['bond.hollis+1', 'know.hollis.love'] }, { end: true },
      { label: 'best' }, { who: 'hollis', t: 'Best town ever! The county agrees: top ten for smoothness, three years running. Blend keeps the scores.' }, { do: ['bond.hollis+1', 'know.hollis.love'] },
    ],
    d2: [
      { if: 'flag.statue_seen & !flag.hollis_archive & !flag.council', go: 'show' },
      { who: 'hollis', t: 'Busy, busy! The town meeting is tonight, and the agenda refuses to shorten itself.' }, { if: 'flag.idea_any', go: 'idea' }, { end: true }, { label: 'idea' }, { who: 'you', t: 'I have some ideas for the town.' }, { hint: 'advisement' }, { end: true },
      { label: 'show' }, { who: 'you', t: 'Clover found the founders\' ledger. The Standard was measured off one summer\'s crew at the Works.' },
      { who: 'hollis', t: 'One summer... I see. And nobody since?' }, { who: 'you', t: 'Nobody matches it. Not even you.' },
      { who: 'hollis', t: 'Not even me. I have tried, you know. For years.' }, { face: 'sad', who: 'hollis' },
      { who: 'hollis', t: 'I always thought the statue looked a little smug, if I am honest. Bring your proposals tonight. I will listen properly.' },
      { do: ['flag.hollis_archive', 'bond.hollis+1', 'know.hollis.helps'] },
    ],
    d3: [
      { if: 'flag.statue_seen & !flag.hollis_archive', go: 'show' }, { who: 'hollis', t: 'The Lantern Festival, tonight at eight! I have written a speech. It is mostly about bunting.' }, { end: true },
      { label: 'show' }, { who: 'you', t: 'Clover found the founders\' ledger. The Standard was measured off one summer\'s crew at the Works.' },
      { who: 'hollis', t: 'One summer... I see. And nobody since?' }, { who: 'you', t: 'Nobody matches it. Not even you.' },
      { who: 'hollis', t: 'Not even me. I have tried, you know. For years.' }, { face: 'sad', who: 'hollis' },
      { who: 'hollis', t: 'I always thought the statue looked a little smug, if I am honest. Next season, bring me proposals. I will listen properly.' },
      { do: ['flag.hollis_archive', 'bond.hollis+1', 'know.hollis.helps'] },
    ],
    again: [{ who: 'hollis', t: 'Onward, upward, and a little to the left!' }],
    back: {},
  },
  dot: {
    d1: [{ who: 'dot', t: 'Hi. Dot. Next desk. Sorry in advance: I talk to the lights. They don\'t answer.' }, { who: 'dot', t: 'Is it very bright in here, or is it me? I ask every day, and every day it\'s both.' }],
    d2: [{ who: 'dot', t: 'Permits today. Four years I\'ve checked these. I\'ve never once seen one match.' }],
    d3: [{ if: 'fix.dim=built', go: 'soft' }, { who: 'dot', t: 'Short day. Same lights. Same Dot.' }, { end: true }, { label: 'soft' }, { who: 'dot', t: 'Did they change the lights? My eyes have stopped arguing with me.' }],
    again: [{ who: 'dot', t: 'Sorry. Still bright. Not your fault.' }],
  },
  fen: {
    d1: [{ who: 'fen', t: 'Fen. Two desks down. Twenty-six years at the Works.' }, { who: 'fen', t: 'I like it bright. My eyes are older than the building, and the panels are the only thing that lets me read the small print.' }],
    d2: [{ who: 'fen', t: 'Bright day. Good. I can see every typo.' }],
    d3: [{ if: 'fix.dim=built & stake.dim=listened', go: 'lamp' }, { if: 'fix.dim=built', go: 'own' }, { who: 'fen', t: 'Bright and steady. Just how I like it.' }, { end: true }, { label: 'lamp' }, { who: 'fen', t: 'My lamp is turned all the way up. Don\'t look straight at it. I do.' }, { end: true }, { label: 'own' }, { note: 'Fen has brought a lamp from home. Fen says nothing about it.' }],
    again: [{ who: 'fen', t: 'Can\'t stop. Small print.' }],
  },
  pomeroy: {
    d1: [{ who: 'pomeroy', t: 'APPLES! Oh. Sorry. Inside voice. I don\'t have one.' }, { who: 'pomeroy', t: 'Pomeroy. Thirty years selling apples by shouting at them. Have one. On the house. The house is me.' }, { do: ['energy+4'] }],
    d2: [{ who: 'pomeroy', t: 'Noon\'s my whole day. Folk hear me from the bus stop. That\'s the business.' }],
    d3: [{ if: 'fix.quiet=built & stake.quiet=listened', go: 'side' }, { if: 'fix.quiet=built', go: 'whisper' }, { who: 'pomeroy', t: 'APPLES! Festival apples! Same as the other apples!' }, { end: true }, { label: 'side' }, { who: 'pomeroy', t: 'I kept my side loud. The corner kept its side quiet. Everybody\'s got a side.' }, { end: true }, { label: 'whisper' }, { who: 'pomeroy', t: 'I whisper at the apples now. Sales are down. The apples seem calmer.' }],
    again: [{ who: 'pomeroy', t: 'APPLES! Sorry. Habit.' }],
  },
};

// backing the return visits' fixes (Acts 2 and 3): the same shape as the back scripts above
Object.assign(TALK.bea.back, {
  crossing: [{ who: 'bea', t: 'My petition, dear? Sign there. And there. I\'ve been very thorough.' }, { do: ['back.crossing', 'bond.bea+1'] }],
  bay: [{ who: 'bea', t: 'A bay for the bots? My cart and I would like a word with that ramp. Yes.' }, { do: ['back.bay'] }],
  farstalls: [{ who: 'bea', t: 'Stalls at the Far End? I\'ll bring soup to the first one. Yes.' }, { do: ['back.farstalls'] }],
});
Object.assign(TALK.pip.back, {
  crossing: [{ who: 'pip', t: 'A longer light? My cart and I have raced that light for years. Yes.' }, { do: ['back.crossing'] }],
  counter: [{ who: 'pip', t: 'A person at the counter? One who knows rye from ride? Yes. Where do I sign.' }, { do: ['back.counter', 'bond.pip+1'] }],
  rentcap: [{ who: 'pip', t: 'Rents up every year while the queue\'s out the door. Yes. Cap them.' }, { do: ['back.rentcap'] }],
});
Object.assign(TALK.gil.back, {
  counter: [{ who: 'gil', t: 'A human at the counter. The kiosk calls me Jill. Every time. Yes.' }, { do: ['back.counter'] }],
  bay: [{ who: 'gil', t: 'A bay. Paint and a sign. I can do paint and a sign. Yes.' }, { do: ['back.bay'] }],
});
Object.assign(TALK.moss.back, {
  rentcap: [{ who: 'moss', t: 'A cap for the old stalls? Thirty years on that corner. Yes, love.' }, { do: ['back.rentcap'] }],
  farstalls: [{ who: 'moss', t: 'The Far End? It\'s quiet there. I\'d like a bit of quiet. Yes.' }, { do: ['back.farstalls'] }],
});

// the one person each fix costs, what they'd change, and what that costs you (every option costs someone something)
export const STAKES = {
  quiet: { who: 'pomeroy', loses: 'Pomeroy\'s noon trade: he sells apples by shouting.', lessLoss: 'Pomeroy, less: he keeps his side of the square loud.', variantName: 'on the bench side, away from the apple stall', cost: 'For you: the corner is a little less quiet at noon.',
    talk: [{ who: 'pomeroy', t: 'You\'re the one with the quiet corner. Pomeroy. Apples. I sell them by shouting at them.' }, { who: 'pomeroy', t: 'Noon\'s my whole day. A quiet corner by my stall, and I\'m a man whispering at fruit.' }, { who: 'pomeroy', t: 'Put it on the bench side, and I\'ll keep my side loud. Everybody gets a side.' }],
    change: 'On the bench side. Your side stays loud.', keep: 'It needs to be where it\'s drawn.',
    listened: { who: 'pomeroy', t: 'Fair\'s fair. I\'ll shout in the other direction.' }, overruled: { who: 'pomeroy', t: 'Right. Well. I\'ll whisper at them, then.' },
    thanks: 'Saw Clover\'s drawing. Quiet on the bench side, loud on mine. You thought of my apples before I asked. Fair\'s fair.' },
  board: { who: 'hollis', loses: 'some of the festival bunting budget.', lessLoss: 'the bunting budget, less: the board shares festival news.', variantName: 'shared with festival news', cost: 'For you: route changes share the board with festival news.',
    talk: [{ who: 'hollis', t: 'The bus board! Splendid idea. Ruinous price.' }, { who: 'hollis', t: 'It comes out of the festival budget, you see. The bunting budget. People do love the bunting.' }, { who: 'hollis', t: 'Could the board share? Bus changes, and festival news. Then the bunting committee could call it theirs.' }],
    change: 'It can share. Bus changes first.', keep: 'Just the bus changes.',
    listened: { who: 'hollis', t: 'Bus changes first, bunting second. A compromise. I adore a compromise.' }, overruled: { who: 'hollis', t: 'Then a little less bunting. I shall tell the committee myself. Gently.' } },
  lanterns: { who: 'bea', loses: 'dropping in with soup, unannounced, the way the row says hello.', lessLoss: 'Bea, less: amber still means soup on the step.', variantName: 'amber still means soup on the step', cost: 'For you: on an amber night, soup may still turn up on your step.',
    talk: [{ who: 'bea', t: 'These porch lights. Teal for come in, amber for not now. Have I got that right, dear?' }, { who: 'bea', t: 'I\'ve dropped by with soup unannounced for fifty years. It\'s how this row says hello.' }, { who: 'bea', t: 'Could amber still mean soup on the step? I won\'t knock. I\'ll just leave it.' }],
    change: 'Amber can still mean soup on the step.', keep: 'Amber means not now. Even for soup.',
    listened: { who: 'bea', t: 'Soup on the step, then. No knock. I can do that.' }, overruled: { who: 'bea', t: 'Then I\'ll learn to text first. In capitals.' } },
  ramp: { who: 'gil', loses: 'Gil\'s tomato planters by the steps.', lessLoss: 'Gil\'s tomatoes, less: they move along the rail.', variantName: 'along the rail, beside the tomatoes', cost: 'For you: the ramp is a little narrower. It still fits.',
    talk: [{ who: 'gil', t: 'A ramp! Love it. Love the energy. One tiny thing.' }, { who: 'gil', t: 'The planters by the steps? My tomatoes. Nine years. They\'re the only thing in this building that\'s thriving.' }, { who: 'gil', t: 'Could the ramp run along the rail, with the tomatoes beside it? A bit narrower. Still fits a cart. I measured. Twice.' }],
    change: 'Along the rail, with the tomatoes.', keep: 'The ramp needs the room.',
    listened: { who: 'gil', t: 'Great. Great! Tomatoes love a rail.' }, overruled: { who: 'gil', t: 'Okay! They can come up to my desk. They don\'t like it in here. Neither do I.' } },
  dim: { who: 'fen', loses: 'Fen\'s bright desk: Fen needs strong light to read.', lessLoss: 'Fen, less: she keeps a lamp at her desk, turned up.', variantName: 'with a lamp at Fen\'s desk, turned up', cost: 'For you: Fen\'s lamp spills a little onto your desk.',
    talk: [{ who: 'fen', t: 'Fen, two desks down. I heard about the lights.' }, { who: 'fen', t: 'I like it bright. My eyes are older than the building. The panels are the only thing that lets me read the small print.' }, { who: 'fen', t: 'Could I keep a lamp at my desk, turned all the way up? It\'ll spill onto yours a little. Sorry in advance.' }],
    change: 'A lamp at your desk, as bright as you like.', keep: 'Soft everywhere. That\'s the point.',
    listened: { who: 'fen', t: 'Thank you. I\'ll point it at the wall. Mostly.' }, overruled: { who: 'fen', t: 'Okay.' },
    thanks: 'Saw the sketch. Softer panels, and a lamp I can turn all the way up. You thought of my eyes before I asked. Thank you.' },
  plain: { who: 'gil', loses: 'Gil\'s wiggle room: "let\'s think about it" is how he says no.', lessLoss: 'Gil, less: a note can say "not this quarter".', variantName: 'a note can say "not this quarter"', cost: 'For you: some notes say "not this quarter" instead of "no".',
    talk: [{ who: 'gil', t: 'Plain notes. Who does what by when. Love it. I\'m also a little scared of it.' }, { who: 'gil', t: 'Sometimes "let\'s think about it" is how I say no without saying no. Corporate likes a maybe.' }, { who: 'gil', t: 'Could a note say "not this quarter" instead of "no"? Then I can still be nice about it.' }],
    change: '"Not this quarter" is plain enough.', keep: 'A no should say no.',
    listened: { who: 'gil', t: 'Not this quarter. That\'s... actually plain. Huh. Great.' }, overruled: { who: 'gil', t: 'Okay. No means no. Great. Great.' } },
};

// the people the return visits' fixes cost (Acts 2 and 3); same shape as above
Object.assign(STAKES, {
  crossing: { who: 'marta', loses: 'Marta\'s timetable: the van runs a little late at every long crossing.', lessLoss: 'Marta, less: the light only waits when someone holds the button.', variantName: 'with a button to hold for more time', cost: 'For you: you hold the button, or ask someone to.',
    talk: [{ who: 'marta', t: 'You\'re the one with Bea\'s petition? Marta. I drive the van.' }, { who: 'marta', t: 'Every time I wait at that light, the van runs late, and the app tells everyone it\'s my fault.' }, { who: 'marta', t: 'Could it wait only when someone holds a button? Then I\'m only late when somebody needs it.' }],
    change: 'A button to hold for more time.', keep: 'The light waits for whoever is crossing.',
    listened: { who: 'marta', t: 'A button. Fair. The app can blame the button.' }, overruled: { who: 'marta', t: 'Right. I\'ll tell the app it\'s the town. It won\'t listen either.' } },
  counter: { who: 'sana', call: true, loses: 'Sana\'s team: a counter in Larkspur comes out of the operators\' contract for twelve towns.', lessLoss: 'Sana\'s team, less: volunteers staff the counter, and the operators keep the bell.', variantName: 'with volunteers at the counter and the operators on the bell', cost: 'For you: sometimes the volunteer has to ring the bell too.',
    talk: [{ who: 'sana', t: 'Hello, this is Sana, on the call bell. Someone put in a note about a counter in Larkspur.' }, { who: 'sana', t: 'Twelve towns, one headset. If Larkspur pays for a counter, it comes out of our contract, and the other eleven wait longer.' }, { who: 'sana', t: 'Could the counter be volunteers, with us on the bell for the hard ones? I\'ll put a note in either way.' }],
    change: 'Volunteers at the counter, the operators on the bell.', keep: 'A paid person at the counter.',
    listened: { who: 'sana', t: 'Volunteers and the bell. I can write that up. Thank you for calling it in.' }, overruled: { who: 'sana', t: 'Understood. I\'ll put a note in. It\'ll be a short note.' } },
  bay: { who: 'pip', loses: 'Pip\'s flour: when the bots wait in the bay, her deliveries wait too.', lessLoss: 'Pip, less: the bots pull in only at shift changes.', variantName: 'with bots pulling in at shift changes only', cost: 'For you: between shift changes, a bot may still be on the ramp.',
    talk: [{ who: 'pip', t: 'A passing bay for the bots? Good. Mostly good.' }, { who: 'pip', t: 'My flour comes up that ramp on a bot. If it sits in a bay every time someone passes, my bread rises late.' }, { who: 'pip', t: 'Could they pull in only at shift changes? That\'s when the ramp\'s busy anyway.' }],
    change: 'Only at shift changes.', keep: 'Whenever someone needs the ramp.',
    listened: { who: 'pip', t: 'Shift changes. Perfect. My dough thanks you.' }, overruled: { who: 'pip', t: 'Fine! My dough will learn patience.' } },
  rentcap: { who: 'bao', loses: 'Bao and Lin, fourteenth on the waiting list: capped stalls hardly ever come free.', lessLoss: 'Bao and Lin, less: half the stalls that come free go to the waiting list.', variantName: 'with half the free stalls for the waiting list', cost: 'For you: Moss is capped, but her neighbours may change.',
    talk: [{ who: 'bao', t: 'Bao. And that\'s Lin, with the steamer. The dumpling cart. We\'re fourteenth on the waiting list.' }, { who: 'bao', t: 'If the old stalls are capped, nobody ever gives one up. We\'ll be fourteenth forever.' }, { who: 'bao', t: 'Could half the stalls that come free go to the list? We\'d bid like everyone else for the rest.' }],
    change: 'Half the free stalls to the waiting list.', keep: 'A cap for the old stalls, and that\'s all.',
    listened: { who: 'bao', t: 'Half. We can work with half. Have a dumpling.' }, overruled: { who: 'bao', t: 'Fourteenth it is. The dumplings are still good.' } },
  farstalls: { who: 'wren', loses: 'Wren, and the Far End\'s quiet: stalls on the lane, and people all afternoon.', lessLoss: 'Wren, less: the stalls open in the afternoon only, and the lane is quiet by dusk.', variantName: 'open afternoons only', cost: 'For you: the stalls close at dusk, when people want them most.',
    talk: [{ who: 'wren', t: 'Stalls on the lane outside my workshop. I am told this is good news.' }, { who: 'wren', t: 'The Far End is the one quiet place left. People come here to not be in the square.' }, { who: 'wren', t: 'Afternoons only. Closed by dusk. Then the lanterns are still the loudest thing here.' }],
    change: 'Afternoons only.', keep: 'All day, like the square.',
    listened: { who: 'wren', t: 'Afternoons. Thank you for saying it plainly.' }, overruled: { who: 'wren', t: 'Then I will put a new sign on my door. It will say knock once. It will mean it.' } },
  quietrow: { who: 'juno', loses: 'Juno\'s lively shortcut: the music and the bikes stop at the corner now.', lessLoss: 'Juno, less: the quiet zone ends at the garden cut.', variantName: 'ending at the garden cut', cost: 'For you: the far end of Home Row stays lively.',
    talk: [{ who: 'juno', t: 'The quiet zone on Home Row? That\'s my way to the square.' }, { who: 'juno', t: 'I cut through with my speaker on. It\'s the best two minutes of my day.' }, { who: 'juno', t: 'Could it stop at the garden cut? Your end quiet, my end loud.' }],
    change: 'Stop at the garden cut.', keep: 'The whole row.',
    listened: { who: 'juno', t: 'Your end quiet, my end loud. Deal.' }, overruled: { who: 'juno', t: 'Okay. I\'ll go the long way. With the speaker.' } },
});

// ---------- the town meeting ----------
export const COUNCIL = {
  open: [{ who: 'hollis', t: 'Order! Order. Item one: the Lantern Festival, which is tonight, which is fine. Item two: anything from the floor.' }],
  none: [{ who: 'hollis', t: 'Nothing from the floor? Splendid. To the festival!' }],
  present: { quiet: 'A quiet corner at the market, by the benches, softer at noon.', board: 'A bus board that shows route changes in writing, not just over the speaker.', lanterns: 'Porch lanterns on Home Row. Teal means come in. Amber means not now.', ramp: 'A ramp beside the Works steps.', dim: 'Softer, dimmable lights at the Works.', plain: 'Every meeting at the Works ends with one plain note: who does what, by when.',
    crossing: 'A crossing light that waits until everyone in the middle of the street is across.', counter: 'A person at the old counter on festival mornings, for anyone the kiosk can\'t hear.', bay: 'A passing bay on the Works ramp. The bots pull in, and people go first.', rentcap: 'A rent cap for stallholders who have been on the square ten years or more.', farstalls: 'Six stalls at the Far End, along Founders\' Row, at the old rent.' },
  frame: [{ t: 'It helps more people than you would think.', key: 'many' }, { t: 'I need this. So do they.', key: 'need' }, { t: 'Let the people it helps speak.', key: 'voices' }],
  blendArg: { who: 'hollis', t: 'But the Smooth Scores say people are coping beautifully! Larkspur is in the county top ten.' },
  rueSpeaks: ['Can I say something? Nobody asked me to.', 'Four hundred and thirteen of those days are mine. Some of those mornings I couldn\'t get out of bed. The score went up anyway.', 'It doesn\'t measure whether we\'re all right. It measures whether we look it.'],
  // each voter says what would move them before you speak, and why they voted after
  lean: { pip: 'Does it bring people through my door?', hollis: 'I\'d need more than a feeling.', clover: 'Who did you ask about who it costs?', rue: 'Who did you ask, and who did you count?' },
  votes: {
    rue: { yes: 'We asked the person it costs, and we changed it. Yes.', no: 'Nobody asked the person it costs. Not yet. No.', overruled: 'We asked, and then we didn\'t listen. Not yet. No.' },
    pip: { yes: 'More people through my door. Yes.', no: 'I don\'t see what it does for the shop. No.', neighbour: 'Pomeroy\'s my neighbour. If he\'s against it, so am I. No.' },
    clover: { yes: 'We asked who it costs, and we changed it. Yes.', no: 'We didn\'t ask who it costs. Not yet. No.', overruled: 'We asked who it costs, and then we didn\'t listen. Not yet. No.' },
    hollis: { yes: 'I have seen the ledger. Yes.', yesPlain: 'For Larkspur. Yes.', no: 'We have always done it this way. No.' },
  },
  passed: 'Carried. It goes up overnight.', passedTonight: 'Carried. It goes up tonight, in time for the festival.', passedRule: 'Carried. It takes effect tonight.', passedClover: 'Already loading the cart.', passedCloverRule: 'In the ledger tonight. In pen.', failed: 'Not carried. It goes on file for next season.',
  // the Founders' Fund's clause, read out when it applies (Act 3)
  clause: { who: 'clover', t: 'Before the vote: the Fund\'s gift came with a clause. Any project on Founders\' Row needs the Fund\'s sign-off. It hasn\'t been signed.' },
  stalled: { who: 'hollis', t: 'Then it is referred for further study. Next season.' },
  budget1: 'The budget covers one more this season. Choose which.', budget2: 'The budget covers two this season. Choose which.', budget0: 'Two this season already, I am told. These go on file for next year.',
  rule: { who: 'hollis', t: 'Order. Stillness in the chamber, please. It\'s in the rules. Page four.' },
  ruleAsk: [{ t: 'Keep still', sub: 'the rules say so', id: 'rule_still' }, { t: 'Keep moving', sub: 'it helps you think', id: 'rule_move' }],
  ruleMove: { who: 'hollis', t: 'Ah. Well. Page four is very old. Carry on.' },
  presenter: 'presents it for you, since you stepped out.',
  tabledClover: 'They tabled it. The hall\'s built for people who like a full room. I asked Hollis for a quiet row at the back next time.',
};

// ---------- festival day: the fixes in use (each one used on screen by two named people) ----------
// zone and time window where it happens, two lines, and the moment you keep
export const FELT = {
  quiet: { zone: 'market', sub: 'quietcorner', from: 690, to: 840, lines: ['Noon in the quiet corner. Moss\'s regulars are back on the bench, holding their tea with both hands.', 'Bea sits down beside them and turns her hearing aid back up. From the far side of the square: "APPLES!"'], keep: 'The quiet corner, in use', hush: ['Noon in the quiet corner. Moss\'s regulars are back on the bench, holding their tea with both hands.', 'Bea sits down beside them and turns her hearing aid back up. From the apple stall, a loud whisper: "apples."'] },
  board: { zone: 'transit', from: 930, to: 1050, lines: ['The bus board says VIA ELM ST in letters a person can read from the bench. Bea reads it out for her daughter\'s bus, then reads it again for the fun of it.', 'Pip checks it for the flour van, nods, and goes back to the ovens.'], keep: 'The bus board, in use' },
  lanterns: { zone: 'homerow', from: 540, to: 1140, lines: ['You deliver festival programmes up Home Row. Bea\'s porch light is teal. She waves you in for soup.', 'At the Far End, Wren\'s light is amber. A note on the box: "Not now. Leave it in the box." You leave it in the box.'], keep: 'The porch lanterns, in use' },
  ramp: { zone: 'street', at: 'works', from: 540, to: 660, lines: ['You help Pip roll the bun cart up the new ramp at the Works. Not one tray falls.', 'A parent with a stroller comes up right behind you, and doesn\'t have to ask anyone for anything.'], keep: 'The ramp, in use' },
  dim: { zone: 'works', from: 540, to: 660, lines: ['The Works, festival morning. Gil is working under a soft panel and has not mentioned his head once.', 'Two desks down, Fen turns her lamp all the way up and goes back to the small print.'], keep: 'The soft lights, in use', own: ['The Works, festival morning. Gil is working under a soft panel and has not mentioned his head once.', 'Two desks down, Fen has brought a lamp from home. She says nothing about it.'] },
  plain: { zone: 'works', from: 540, to: 660, lines: ['On the board by the door, one plain note: "Gil: festival permits, by 11." Nobody has to guess what it means.', 'Rue reads it through the window on her way past, and laughs out loud.'], keep: 'The plain notes, in use' },
};

// ---------- the festival ----------
export const FESTIVAL = {
  arrive: 'The square is full of lanterns, and nearly everyone you know is here.',
  lines: {
    bea_daughter: { who: 'bea', t: 'She made the 7:40! The board said Elm Street, in letters this big. Dear, meet my daughter.' },
    bea_alone: { who: 'bea', t: 'The 7:40 went down Elm again. She\'ll try tomorrow. I\'ve written to the depot. Twice. In capitals.' },
    wren_here: { who: 'wren', t: 'I came. The lanterns are the right color. That one is mine. And that one. Most of them.' },
    wren_work: { who: 'wren', t: 'Still working. I can hear the festival from here. That is close enough.' },
    wren_away: { note: 'Far off at the Far End, one porch light is still on. Wren is working.' },
    rue_free: { who: 'rue', t: 'Hi. It\'s me. No app. My face is doing things I didn\'t tell it to. Tomorrow might be a bad one. That\'s allowed too.' },
    rue_streak: { who: 'rue', t: 'Four hundred and fourteen! Smile for the leaderboard!' },
    gil_dim: { who: 'gil', t: 'I sat under the new lights for ten minutes before I came. No headache. I keep touching my forehead to check.' },
    gil_plain: { who: 'gil', t: 'I already wrote Thursday\'s plain note. Who, what, by when. It felt like taking off a tie.' },
    gil_same: { who: 'gil', t: 'Great festival! Great, great festival.' },
    moss_quiet: { who: 'moss', t: 'Tea in the quiet corner. My regulars came back. Pomeroy\'s still shouting, over on his side. It\'s nice, somehow.' },
    moss_quiet_hush: { who: 'moss', t: 'Tea in the quiet corner. My regulars came back. Even Pomeroy is whispering. He says the apples don\'t mind.' },
    moss_same: { who: 'moss', t: 'Tea? You look like you need it. Everyone looks like they need it.' },
    hollis_new: { who: 'hollis', t: 'Next year, I am thinking a new statue. Lots of shapes. Possibly a committee.' },
    hollis_same: { who: 'hollis', t: 'A triumph! Larkspur, fitting like a glove.' },
    pip: { who: 'pip', t: 'Sold every bun. Every one. Do you know how many buns that is? You don\'t want to know.' },
    clover: { who: 'clover', t: 'Look at it. A town is just a lot of fixes nobody remembers asking for.' },
  },
  release: 'Your lantern, the color you came in with.',
  releaseBlend: 'Your lantern. It is the color of the statue. You do not remember choosing it.',
};

export const ENDINGS = {
  blended: { title: 'Blended', text: 'You fit. Everyone says so. Most days you cannot quite remember what you were like when you arrived, and Blend says that is the point.' },
  remade: { title: 'The Remade Town', text: 'Several things in Larkspur work differently now, and people you have never met are using them. Nobody remembers who asked first. That is usually how it goes.' },
  manyplace: { title: 'A Little Wider', text: 'Larkspur did not change everywhere. But somewhere in it, a place that used to pinch now fits more people than it did, you included.' },
  movedon: { title: 'Moved On', text: 'You found the places that fit and stopped going to the ones that did not. The town kept its shape. You kept yours.' },
  island: { title: 'The Island', text: 'You found your people and the places you could share. The rest of Larkspur stayed exactly as it was.' },
  working: { title: 'Still Working It Out', text: 'Some days you bent, some days you asked, some days you just went home. Most people\'s seasons look like this.' },
};
export const QUESTIONS = ['Who bent this season?', 'Who decided they should?'];

// ---------- Blend's voice ----------
export const BLEND = {
  smoothToast: ['Smoothed it over for you!', 'Handled! You fit right in.', 'Smooth! Nobody noticed a thing.', 'There. Nobody will know.'],
  drop: ['Your daily drop is ready. It is always 25 points.', 'Daily drop: 25 points, same as yesterday.', 'Your streak is counting on you!'],
  badges: { first: 'Smooth Operator', crowd: 'Crowd Pleaser', early: 'Early Riser', streak: 'Unbreakable', top: 'Larkspur Top 10' },
  board: [['Rue', 4410], ['Hollis', 2330], ['Pip', 1940], ['Gil', 1210], ['Moss', 15]],
  lose: 'Your streak ended. Blend is sad. Start a new one?',
  delete: 'Delete Blend? You will lose your streak, your badges and your points. Your badges will miss you.',
  suggest: 'Blend suggests',
  pings: ['Your Smooth Score is slipping! Tap to restore.', 'Rue just passed you on the leaderboard!', 'A mystery box is waiting. It is always 10 points. It expires at midnight.', 'You have not smoothed anything in a while. Everything okay?', 'Three people near you are calmer than you right now.', 'Your streak misses you.'],
};

export const NIGHT = {
  1: (S) => [S.flags.bea_bus ? ['Bea, No. 4', 'The 5:40 went down Elm. Nobody told the bench. Goodnight, dear.'] : ['Bea, No. 4', 'Did you like the soup? The pot is still mine.'], S.flags.folded ? ['Wren', 'Lantern 74 done. You folded the line correctly.'] : S.met.wren ? ['Wren', 'Lantern 74 done. Sixty-one was this morning.'] : ['Clover', 'Fix-It Shed is open tomorrow 8 to 6. Bring me anything that pinches!']].concat(S.flags.rue_cracked ? [['Rue', 'Can I ask you something tomorrow? Not on the app. The pond, half four?']] : []),
  2: (S) => [['Moss', 'Tea\'s on me tomorrow. Big day.'], S.flags.rue_pond ? ['Rue', 'Festival tomorrow. I might leave the phone at home. Might.'] : ['Blend', 'Your Smooth Score went up this week. You are doing great!']],
};

// ---------- people: a guide you fill by asking and listening ----------
// slots: over (too much for them), under (too little), no (how they say no), helps (what helps). Three filled unlock a reveal.
export const SLOT_LABEL = { over: 'Too much for them', under: 'Too little for them', no: 'How they say no', helps: 'What helps them' };
export const PEOPLE = {
  gil: { over: 'The ceiling panels. Headaches by three, which he only admits after five.', under: 'A quiet room. He fills every silence with "great."', no: '"Love it, let\'s think about it!" means no, for now.', helps: 'Light he can turn down himself. People saying plainly what they need.', love: 'Pip\'s scones. He will deny it.',
    reveal: 'After everyone leaves, Gil switches off the ceiling panels and works by his desk lamp. He sighs every time, like taking off a tie.' },
  pip: { over: 'The ovens at noon, louder than the bus speaker.', under: 'An empty shop. Quiet makes her nervous.', no: '"You must be very busy!" means she is closing.', helps: 'A ramp for the bread cart. Bus changes in writing.', love: 'Feeding the whole town. Sprinkles on everything.',
    reveal: 'At noon, when the ovens roar, Pip wears foam earplugs under her bow. "Nobody needs to know," she says. "Everybody does it."' },
  moss: { over: 'Noon at the market: two songs at once and a man shouting about apples.', under: 'A day with none of her regulars.', no: '"Wish I could, love" means it is not hers to change.', helps: 'A quiet hour. A stool behind the cart.', love: 'Regulars who come for the quiet. Very strong tea.',
    reveal: 'Moss keeps a pair of headphones under the counter for herself. Not the good ones she sells. The cheap ones. "They\'re broken in."' },
  rue: { over: 'Not knowing what people want from her.', under: 'A day without a notification. She does not know what to do with her hands.', no: 'Rue does not say no. Blend suggests yes.', helps: 'Notes that say who does what by when.', love: 'Drawing. She drew every day, before the streak.',
    reveal: 'In the kiosk drawer there is a sketchbook. The last drawing is dated the day before her streak began. It is the pond, at dusk.' },
  bea: { over: 'The market at noon. It makes her hearing aid sing.', under: 'Being told nothing. Changes announced to the road.', no: '"Whenever" means not never.', helps: 'Things written down. A quiet hour.', love: 'Soup. Her daughter. Casseroles as a form of protest.',
    reveal: 'At the market Bea turns her hearing aid down and reads lips instead. She has done it for twenty years. "I\'m very good at it. I shouldn\'t have to be."' },
  wren: { over: 'Guessing. People who knock and then wait for Wren to guess why.', under: 'Company, sometimes. They will not say so first.', no: 'Wren says no as "no." Wren says yes as "come in."', helps: 'Porch lanterns. Briefs with sizes in them. Being asked plainly.', love: 'The exact right shade of amber.',
    reveal: 'Wren made one lantern that is not for the festival. It is teal, and it hangs inside their own door. It says come in, to themself.' },
  clover: { over: 'Meetings where nobody writes anything down.', under: 'A shed with nothing to fix. She goes looking.', no: '"Not yet" means not yet. It never means no.', helps: 'Two backers and a sketch. Someone who notices what pinches.', love: 'A good hinge. Graph paper. The founders\' ledger, which she reads like a thriller.',
    reveal: 'Clover hums loudly when she concentrates. At town meetings she hums into her sleeve so nobody hears.' },
  hollis: { over: 'Speaking in public. He practices for hours.', under: 'Plain answers. Nobody gives a mayor one.', no: '"I shall take it under advisement" means no.', helps: 'Being told plainly. Evidence in a ledger.', love: 'Larkspur. Sincerely, every brick of it, and the bunting on festival night.',
    reveal: 'At dawn Hollis practices his speeches to the statue. The podium was built to the Standard\'s height, so he has always stood on a box behind it. He has never once mentioned the box.' },
};
// after a first talk you guess how it went; the truth, overheard later, is usually warmer
export const LIKED = {
  pip: 'Later, Pip told Moss: "The new one? Lovely. A bit quiet. I hope {they} come{s} back tomorrow."',
  moss: 'Later, Moss told Bea: "Good company, the new one. Didn\'t need to fill every silence."',
  bea: 'Later, Bea told her daughter on the phone: "The one at No. 2 is a sweetheart. Ate every drop of the soup."',
  wren: 'Later, Wren told Moss: "The new one was specific. I liked that."',
  clover: 'Later, Clover wrote in the shed log: "New neighbor. Notices things. Good."',
  gil: 'Later, Gil told the whole office: "Great new hire. Great. Really great." He meant it, which surprised him.',
  rue: 'Later, Rue posted on Blend: "met someone real today!!" Then deleted it. Then posted it again.',
  hollis: 'Later, Hollis mentioned you in a speech to the pigeons. Favorably.',
};
// lanterns you paint for people: glow comes from their needs, color from who they are, pattern from what they love
export const LANTERN_PREFS = {
  gil: { glow: 'soft', color: '#cbb9a2', pattern: 'words', yes: 'Soft. Of course it\'s soft. You remembered the headaches. I won\'t cry at a festival. I won\'t.', near: 'Oh, that\'s nice. That\'s really, genuinely nice.', kind: 'Great lantern! Great. Really great.' },
  pip: { glow: 'bright', color: '#ffc98e', pattern: 'dots', yes: 'Bright! The brightest one! Everyone knows me, but you KNOW me.', near: 'Ooh, nearly! Bit more sparkle and that\'s me exactly.', kind: 'For me? A lantern? You\'re getting a free loaf for this.' },
  moss: { glow: 'soft', color: '#9fd3b0', pattern: 'plain', yes: 'Soft, and green, and plain. You\'ve been paying attention, love.', near: 'Nearly my sort of thing. Nearly is plenty.', kind: 'It\'s not quite me, love. I\'ll wave it off all the same.' },
  rue: { glow: 'medium', color: '#f3a0c2', pattern: 'doodle', yes: 'A drawing. On a lantern. For me. I\'m going to need a minute.', near: 'That\'s so close to something I\'d have made. Before.', kind: 'Aw. Blend would have picked beige. I like yours better.' },
  bea: { glow: 'medium', color: '#c9b6ef', pattern: 'words', yes: 'Written down! Where a person can read it. Oh, dear. Oh, that\'s lovely.', near: 'Nearly my colors, dear. You\'ve got an eye.', kind: 'Well! Nobody\'s made me a lantern in thirty years. I\'ll watch it all the way up.' },
  wren: { glow: 'soft', color: '#ffcf7a', pattern: 'plain', yes: 'That is the right amber. Not near the right amber. The right amber.', near: 'Near the right amber. Thank you for near.', kind: 'It is not what I would make. That is fine. You made it.' },
  clover: { glow: 'bright', color: '#cde38f', pattern: 'stripes', yes: 'Bright, lime and ruled like graph paper. It\'s a blueprint. You made me a blueprint.', near: 'Ooh, almost my style. Let me just adjust one hinge.', kind: 'A lantern! I\'ll fix it if it breaks. It won\'t break. You did good.' },
  hollis: { glow: 'bright', color: '#93c2ee', pattern: 'stripes', yes: 'Stripes, like bunting! Very civic. Very me. I may have to make a speech about it.', near: 'Most distinguished. Very nearly mayoral.', kind: 'A lantern from a constituent. I shall treasure it, officially.' },
};
// once people know you, some of them adjust before you ask
export const UNASKED = {
  market: { who: 'moss', over: 'Saw you coming. I turned the speaker down. There\'s a stool behind the cart.', under: 'Saw you coming. Slow day, so the radio\'s on. Pull up a stool and keep me company.' },
  commons: { who: 'clover', over: 'Parasol\'s up. I put it where you like it.', under: 'Too quiet out here? I brought my radio. And a gate to fix, if you want to hold it.' },
  farend: { who: 'wren', over: 'The teal one is on. It means you.', under: 'The teal one is on. It means you.' },
  homerow: { who: 'bea', over: 'I texted before I came over. Did you see? I\'m learning.', under: 'I knocked twice. Thought you might like the company. There\'s soup.' },
  works: { who: 'gil', over: 'I switched off the row of panels over your desk. You looked like you needed it. Don\'t tell corporate.', under: 'Radio\'s on, low. You looked like the quiet was getting to you.' },
};

