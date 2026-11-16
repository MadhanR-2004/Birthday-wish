// ─────────────────────────────────────────────────────────────
//  Everything you might want to personalise, in one place.
//  Edit the values below and the page updates automatically.
//  Anywhere you write {name}, the name below is filled in for you.
// ─────────────────────────────────────────────────────────────

export const BIRTHDAY = {
  // The birthday person's name, used on the envelope and in the letter.
  name: "Someone",

  seal: {
    // Letters pressed into the wax seal: 1 to 3 characters, e.g. "S", "SM", "RJK".
    // Leave empty ("") to use the first letter of the name.
    text: "M",

    // Wax colour: "red", "green", "blue", "gold" or "black".
    color: "red",
  },

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
};
