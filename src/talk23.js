// What people say in the later visits, as data: Act 2's and Act 3's talk scripts and Juno's card. Kept free of
// imports so the content checker can walk them like the scripts in content.js (labels, effects, notes, flags, words).

// ---------- talk: what people say to you, ten years on ----------
export const TALK2 = {
  gil: [{ who: 'gil', t: 'You came back! Festival mail\'s on. Your old desk is free for the morning. Unit has Dot\'s desk. Dot runs the archive now. She has a lamp the size of a sunflower.' }],
  gilAfter: [{ who: 'gil', t: 'Festival mail, done. Every year I say "never again". Every year: again.' }],
  gilMissed: [{ who: 'gil', t: 'Mail\'s out. Unit and I managed. No hard feelings. Kettle\'s still warm.' }],
  gilLeft: [{ who: 'gil', t: 'Unit and I have the mail. No hard feelings. Kettle\'s on, if you want it.' }],
  pip: [
    { who: 'pip', t: 'You\'re back! Want a bun? Everyone wants a bun. Blend\'s top-ten list says buns.' },
    { note: 'Where the rye used to be, a heart-shaped sign: TOP 10 THIS WEEK.' },
    { who: 'pip', t: 'Nobody hearted the rye. Everybody ate it. So now there\'s no rye.' },
    { ask: [
      { t: 'Can I buy a rye anyway?', sub: '5 coins; Pip bakes one off the menu', go: 'buy', id: 'rye_buy' },
      { t: 'Heart the rye on Blend', sub: 'one tap', if: 'blend', go: 'heart', id: 'rye_heart' },
      { t: 'Who decided the menu?', tag: 'plain', go: 'who', id: 'rye_who' },
    ] },
    { label: 'buy' }, { who: 'pip', t: 'Off the menu. From under the counter. Don\'t heart it.' }, { do: ['coins-5', 'w.rye_bought', 'flag.rye2', 'note.valuecapture'] }, { end: true },
    { label: 'heart' }, { note: 'You add a heart to the rye. The list doesn\'t move. Somewhere, a number goes up by one.' }, { do: ['blend.score+1', 'flag.rye2', 'note.valuecapture'] }, { end: true },
    { label: 'who' }, { who: 'pip', t: 'Blend\'s top-ten list. I bake to the list now. It\'s easier than guessing.' }, { who: 'pip', t: 'I miss guessing, a bit.' }, { do: ['flag.rye2', 'note.valuecapture', 'know.pip.no'] },
  ],
  pipAgain: [{ who: 'pip', t: 'Still here! Still buns.' }, { do: ['energy+3'] }],
  moss: [{ who: 'moss', t: 'Ten years and you still come for the tea. Good. Sit, if you like.' }, { do: ['energy+8', 'self+2'] },
    { ask: [{ t: 'Can I see what\'s under the counter?', go: 'shop', id: 'moss2_shop' }, { t: 'Just the tea, thanks.', tag: 'warm', id: 'moss2_tea' }] }, { end: true }, { label: 'shop' }, { call: 'shop' }],
  rue: [
    { if: 'rue=easing', go: 'eased' },
    { who: 'rue', t: 'You came back! I\'m on Blend\'s measures team now. I measure what makes people feel good.' },
    { who: 'rue', t: 'Hearts are up again this year! People feel good. That counts. Doesn\'t it?' }, { go: 'demo' },
    { label: 'eased' },
    { who: 'rue', t: 'You came back! I\'m on Blend\'s measures team now. Funny, I know. I wanted to see how the numbers get made.' },
    { who: 'rue', t: 'We counted hearts. Hearts went up. So did people saying the coach agrees with everything.' }, { do: ['note.specgaming'] },
    { label: 'demo' },
    { who: 'rue', t: 'Want to try the coach? Tell it an idea. Any idea.' },
    { ask: [{ t: 'Paint the statue orange.', go: 'c', id: 'coach_orange' }, { t: 'Cancel the festival.', go: 'c', id: 'coach_cancel' }, { t: 'Put a car park where the pond is.', go: 'c', id: 'coach_pond' }] },
    { label: 'c' }, { who: 'rue', t: 'The coach says: "What a wonderful idea! You should definitely do that."' }, { do: ['note.sycophancy', 'note.aiuse', 'flag.coach'] },
    { if: 'rue=easing', go: 'e2' }, { who: 'rue', t: 'See? So supportive.' }, { end: true },
    { label: 'e2' }, { who: 'rue', t: 'See? It agrees with everything. That\'s the measure working. I\'m writing that down.' },
  ],
  rueAgain: [{ who: 'rue', t: 'Measures don\'t take a festival day off. I\'m trying to.' }],
  bea: [{ who: 'bea', t: 'You\'re still here, dear. So am I. So is the bench. It got new slats. I got new glasses.' }],
  wren: [
    { who: 'wren', t: 'You came back. Good. This is Ines. She fixes the frames. We do not waste words.' },
    { who: 'ines', t: 'Hello. I\'m Ines. Wren said you were plain-spoken. Good.' },
    { who: 'wren', t: 'My new apprentice says "maybe" when she means yes. I have learned to ask: is that a yes? It works. She likes it.' },
    { if: 'w.wren_paid', go: 'paid' },
    { who: 'wren', t: 'I made thirty porch lanterns for free. Then I stopped.' }, { end: true },
    { label: 'paid' }, { who: 'wren', t: 'The porch lanterns paid for a new sign. It says the prices. People still ask for free. I point at the sign.' },
  ],
  wrenAgain: [{ who: 'wren', t: 'Still working. Ines is still fixing. The apprentice is still saying maybe.' }],
  ines: [{ who: 'ines', t: 'Wren is inside. Knock once. Once means once.' }],
  clover: [{ who: 'clover', t: 'Back! The Shed\'s still here, and so am I. Still on the council, too. Somebody has to read the ledger.' }, { call: 'onfile' }],
  cloverAgain: [{ who: 'clover', t: 'Whatever pinches, bring it to the meeting. Six o\'clock. Bring a cardigan.' }],
  hollis: [{ who: 'hollis', t: 'You are back! The Smooth Scores put us in the county top five. The kiosk is doing marvellously. Nobody applied for the morning shift, but still.' }],
  hollisAgain: [{ who: 'hollis', t: 'Onward, upward, and slightly to the left, as ever.' }],
  pomeroy: [{ who: 'pomeroy', t: 'APPLES! Ten years and I still haven\'t found my inside voice. I\'ve stopped looking.' }, { do: ['energy+4'] }],
  tomas: [{ who: 'tomas', t: 'Tomas. Mail room. Festival mail week: people write each other letters like it\'s a hundred years ago. Best week of the year.' }],
  ada: [{ if: 'fix.dim=built', go: 'plants' }, { who: 'ada', t: 'Ada. I started in the spring. I like it dim, so I wear my cap indoors. Nobody\'s said anything yet.' }, { end: true },
    { label: 'plants' }, { who: 'ada', t: 'Ada. I started in the spring. I like it dim, so I sit by the plants. The plants like it dim too.' }],
  marta: [{ who: 'marta', t: 'Marta. I drive the van. The app says I\'m four minutes late. The app has never driven a van.' }],
};

// what Juno brings: your fix, where it is, what pinches, and what Juno says
export const JUNO_CARD = {
  quiet: { zone: 'market', dim: 'sound', at: [23.5, 31.2], says: 'The quiet corner. Your corner, they say. I play drums. I need noise like you need quiet, and the only bench in the shade is in your corner.', rule: 'Fridays, the corner can be loud', redesign: 'A loud corner too, at the other end of the square, by the apples', fixCost: 'The apple end gets loud on Fridays, and the dumpling cart is there' },
  dim: { zone: 'works', dim: 'light', at: [-3.0, 2.2], loc: 'works', says: 'I started at the Works on Monday. It\'s so dim. I can\'t read my own handwriting. They say the soft lights were yours.', rule: 'Panels up at the new desks', redesign: 'A bright row by the windows, and the soft lights everywhere else', fixCost: 'Two desks by the windows move, and the people at them liked the shade' },
  lanterns: { zone: 'homerow', dim: 'people', at: [9.5, 37.4], says: 'Everyone\'s porch light on Home Row is amber. I moved in next door to you. I\'d like company, and I can\'t tell who else would. They say the lanterns were yours.', rule: 'Teal unless you say otherwise', redesign: 'A third color: knock, I\'m happy to be asked', fixCost: 'Wren makes the new lanterns, at the price on Wren\'s sign, and the Shed pays' },
  plain: { zone: 'works', dim: 'talk', at: [-7.0, 1.2], loc: 'works', says: 'The Works notes say exactly who does what by when. It feels like being scolded, every Monday. They say the plain notes were yours.', rule: 'A friendlier line at the top of each note', redesign: 'Plain notes, and a chat after, for anyone who likes one', fixCost: 'Monday meetings run longer, for everyone' },
  bench: { zone: 'market', dim: 'people', at: [30, 26.8], says: 'The benches round the statue are the Standard\'s height. My feet don\'t touch the ground. Nobody ever changed them. You keep the Shed now.', rule: 'One lower bench, by the statue', ruleSub: 'The Shed\'s budget pays, so mending the Shed\'s roof waits a month', askLabel: 'Put in a lower bench', tag: 'the Shed decides now', redesign: 'Benches at three heights, round the statue', fixCost: 'The Shed\'s budget pays, so mending the Shed\'s roof waits a year' },
};

export const TALK3 = {
  clover: [{ who: 'clover', t: 'Retired. It suits me. I still drop in at the Shed every day, to make sure it doesn\'t need me.' }],
  gil: [{ who: 'gil', t: 'I came in to help and I\'ve made four cups of tea. Nobody asked for tea. Everyone drank it.' }],
  rue: [{ if: 'rue=easing', go: 'e' }, { who: 'rue', t: 'They made me head of measures at Blend. Then I measured myself. I quit in the spring.' }, { who: 'rue', t: 'I run plain-notes workshops now. People come in scared of a pen. They leave with a list.' }, { who: 'rue', t: 'I\'m on the council too, these days. I ask who things cost. Out loud.' }, { do: ['note.recovery'] }, { end: true },
    { label: 'e' }, { who: 'rue', t: 'I\'m drawing again. Mornings are mornings. Some are bad. That\'s allowed.' }, { who: 'rue', t: 'I run plain-notes workshops, and I\'m on the council now. Somebody has to ask who it costs.' }, { do: ['note.recovery'] }],
  ines: [{ who: 'ines', t: 'The hinges are in the second drawer. Clover told you that. She tells everyone that.' }],
  pip: [{ who: 'pip', t: 'Twenty years of buns! Want one? It\'s a festival bun. It\'s the same bun with a flag in it.' }, { if: 'w.rye_bought', go: 'rye' }, { end: true }, { label: 'rye' }, { who: 'pip', t: 'The rye is back, by the way. You asked for one when nobody hearted it. I thought about that.' }],
  moss: [{ who: 'moss', t: 'Still pouring. Sit, if you like. The stool remembers you.' }, { do: ['energy+8', 'self+2'] },
    { ask: [{ t: 'Still got things under the counter?', go: 'shop', id: 'moss3_shop' }, { t: 'Just the tea, thanks.', tag: 'warm', id: 'moss3_tea' }] }, { end: true }, { label: 'shop' }, { who: 'moss', t: 'Always, love. Headphones, shades. Same as ever. Better batteries.' }, { call: 'shop' }],
  bea: [{ who: 'bea', t: 'Festival soup for three hundred. I\'m in charge of the ladle. Nobody argues with the ladle.' }],
  wren: [{ who: 'wren', t: 'One hundred and twelve lanterns. Twenty years. I still count. Counting is not the same as worrying. Mostly.' }],
  hollis: [{ who: 'hollis', t: 'Still mayor! Nobody else would take the hat.' }],
  juno: [{ who: 'juno', t: 'Hi again. Larkspur\'s growing on me. Slowly.' }],
  hester: [{ who: 'hester', t: 'Hester, of the Founders\' Fund. Lovely festival. I\'m told my great-great-grandfather would have hated the noise.' }],
  bao: [{ who: 'bao', t: 'Dumplings! Lin steams, I sell. Fourteenth on the waiting list, first in your heart.' }, { do: ['energy+4'] }],
};
