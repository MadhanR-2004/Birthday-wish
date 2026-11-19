// Replaces every {name} in the settings with the actual name.
export function fillInName(config) {
  const fill = (text) => text.replaceAll("{name}", config.name);
  return {
    ...config,
    address: config.address.map(fill),
    letter: {
      ...config.letter,
      label: fill(config.letter.label),
      greeting: fill(config.letter.greeting),
      paragraphs: config.letter.paragraphs.map(fill),
      signature: fill(config.letter.signature),
    },
    secret: {
      date: (config.secret?.date ?? "").trim(),
      hint: fill(config.secret?.hint ?? ""),
    },
    memories: (config.memories ?? []).map((memory) => ({
      ...memory,
      title: fill(memory.title),
      when: fill(memory.when),
      paragraphs: memory.paragraphs.map(fill),
      // "pictures" is a list; a single "image" still works too.
      pictures: (memory.pictures ?? [memory.image]).filter(Boolean),
    })),
  };
}
