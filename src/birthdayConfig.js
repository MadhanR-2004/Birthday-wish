// ─────────────────────────────────────────────────────────────
//  Everything you might want to personalise, in one place.
//  Edit the values below and the page updates automatically.
//  Anywhere you write {name}, the name below is filled in for you.
// ─────────────────────────────────────────────────────────────

export const BIRTHDAY = {
  // The birthday person's name, used on the envelope and in the letter.
  name: "Someone",

  // The owl who delivers the letter (in the tower room she's named).
  owlName: "Hedwig",

  seal: {
    // Letters pressed into the wax seal: 1 to 3 characters, e.g. "S", "SM", "RJK".
    // Leave empty ("") to use the first letter of the name.
    text: "M",

    // Wax colour: "red", "green", "blue", "gold" or "black".
    color: "red",
  },

  // In the tower room, the letter's wax seal asks for our important date
  // before it breaks. Write it as day / month / year, e.g. "05/09/2023".
  // Leave date empty ("") to open the letter without asking.
  secret: {
    date: "14/02/2024",
    // shown after two wrong tries
    hint: "Think back to the day everything changed for us.",
  },

  // In the tower room, a mandrake sings when you pull it up. Give it your
  // own recording to sing: put the file in the "public/songs" folder and
  // write its name here, e.g. "songs/our-song.mp3". Leave it empty ("")
  // and it sings Happy Birthday instead.
  song: "",

  // The gramophone in the tower room plays your favourite songs: each tap
  // (or spell) puts on the next one, and after the last it stops. Put the
  // files in the "public/songs" folder and list them here. With none, it
  // plays Happy Birthday.
  favourites: [
    // { title: "Our song", file: "songs/our-song.mp3" },
  ],

  // Handwritten address on the front of the envelope (first line is the biggest).
  address: ["To {name}", "The Brightest Star,", "Above the Highest Tower,", "The Castle on the Hill"],

  letter: {
    label: "SEALED WITH STARLIGHT",
    greeting: "Dearest {name},",
    paragraphs: [
      "On the night you were born, a new star blinked awake above the highest tower. The old owls still talk about it. Every year since, on this very day, it burns a little brighter, and tonight it is the brightest thing in the sky.",
      "So the whole castle has been busy. Every torch is lit, every window is glowing gold, the stars have gathered overhead, and the oldest owl in the tower flew all night to carry this letter to you.",
      "This year, may your path always be lit, may your spells work on the first try, may your friends stay close, and may every wish you make find its way home.",
    ],
    signature: "Written by moonlight, with all our magic",
  },

  // Memories of the two of you. They come back one by one in the tower room
  // (each spell you cast brings back the next one) and live in the stone
  // memory basin too. Add, remove or reorder as you like.
  // Pictures: put photos in the "public/memories" folder next to "src" and list
  // them, e.g. pictures: ["/memories/beach.jpg", "/memories/cake.jpg"].
  // The ones there now are drawn placeholders; swap in your real photos any time.
  memories: [
    {
      title: "The night we met",
      when: "Where it all began",
      pictures: ["/memories/star-tower.jpg", "/memories/owls.jpg"],
      paragraphs: [
        "I still remember the first thing you said to me, and how I forgot every clever thing I'd planned to say back.",
        "We talked until the sky went dark and the stars came out, and I didn't want the night to end.",
        "Somewhere in the middle of it, without either of us noticing, everything changed.",
      ],
    },
    {
      title: "Our first summer",
      when: "Warm evenings, long ago",
      pictures: ["/memories/fireflies.jpg", "/memories/roses.jpg", "/memories/teapot.jpg"],
      paragraphs: [
        "A garden full of fireflies, your hand finding mine, and neither of us saying a word for a while.",
        "You laughed at something silly I did, and I decided right then that I wanted to hear that laugh for the rest of my life.",
      ],
    },
    {
      title: "Our first winter",
      when: "Snow on the windows",
      pictures: ["/memories/snow-forts.jpg", "/memories/fireside.jpg"],
      paragraphs: [
        "Cold noses, a snowball fight you definitely started, and a surrender I definitely didn't mean.",
        "Afterwards we sat by the fire with hot chocolate, wrapped in one blanket, and the whole world felt very small and very warm.",
      ],
    },
    {
      title: "Tonight",
      when: "Right now",
      pictures: ["/memories/torches.jpg", "/memories/cake.jpg"],
      paragraphs: [
        "This one is still being made. The candles are lit, the letter is waiting, and I'm thinking of you.",
        "Of all my favourite memories, every single one has you in it, {name}.",
        "Happy birthday, my love.",
      ],
    },
  ],
};
