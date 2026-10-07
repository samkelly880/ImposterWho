import { emptyDeck } from "./deck.ts";
import { defaultSetup } from "./defaults.ts";
import { describe, expect, it } from "./testkit.ts";
import { categoryById, pack, wordEntry } from "./pack.ts";
import { dealRound } from "./round.ts";
import type { SetupState } from "./types.ts";

// Audience bar for future pack edits (not encoded as assertions):
// - Hints must be familiar to NZ early teens (heard in normal life, not specialist hobby jargon).
// - A hint should be sayable as a clue and must not uniquely identify the word.
// - Proper nouns and short phrases are allowed.
// - US/media terms are fine; do not force kiwi slang.
// - Further hint changes come from playtest flags, not a wholesale rewrite.

function norm(value: string): string {
  return value.trim().toLowerCase();
}

const ORIGINAL_EIGHT_WORDS: Record<string, string[]> = {
  food: [
    "Pizza",
    "Sushi",
    "Taco",
    "Burger",
    "Pancake",
    "Popcorn",
    "Banana",
    "Chocolate",
    "Soup",
    "Sandwich",
    "Ice cream",
    "Pasta",
    "Apple",
    "Salad",
    "Cookie",
    "Waffle",
  ],
  animals: [
    "Elephant",
    "Penguin",
    "Lion",
    "Dolphin",
    "Giraffe",
    "Owl",
    "Kangaroo",
    "Turtle",
    "Butterfly",
    "Shark",
    "Cat",
    "Dog",
    "Frog",
    "Bee",
    "Horse",
    "Snake",
  ],
  places: [
    "Beach",
    "Library",
    "Airport",
    "Zoo",
    "Museum",
    "Hospital",
    "Park",
    "Stadium",
    "Kitchen",
    "Castle",
    "Desert",
    "Farm",
    "Cinema",
    "Bridge",
    "Island",
    "Mountain",
  ],
  jobs: [
    "Doctor",
    "Teacher",
    "Chef",
    "Pilot",
    "Farmer",
    "Firefighter",
    "Dentist",
    "Artist",
    "Judge",
    "Nurse",
    "Mechanic",
    "Baker",
    "Police",
    "Astronaut",
    "Librarian",
    "Plumber",
  ],
  sports: [
    "Soccer",
    "Basketball",
    "Tennis",
    "Baseball",
    "Swimming",
    "Golf",
    "Volleyball",
    "Hockey",
    "Boxing",
    "Skiing",
    "Cricket",
    "Rugby",
    "Cycling",
    "Bowling",
    "Skating",
    "Archery",
  ],
  movies: [
    "Frozen",
    "Shrek",
    "Titanic",
    "Jaws",
    "Avatar",
    "Cinderella",
    "Batman",
    "Superman",
    "Toy Story",
    "Finding Nemo",
    "Star Wars",
    "Harry Potter",
    "Lion King",
    "Jurassic Park",
    "Spider-Man",
    "Inside Out",
  ],
  household: [
    "Couch",
    "Fridge",
    "Lamp",
    "Vacuum",
    "Pillow",
    "Blanket",
    "Toaster",
    "Microwave",
    "Broom",
    "Clock",
    "Mirror",
    "Curtains",
    "Table",
    "Chair",
    "Kettle",
    "Dishwasher",
  ],
  school: [
    "Pencil",
    "Backpack",
    "Homework",
    "Recess",
    "Cafeteria",
    "Textbook",
    "Chalkboard",
    "Principal",
    "Exam",
    "Locker",
    "Glue",
    "Ruler",
    "Compass",
    "Calculator",
    "Desk",
    "Bell",
  ],
};

const NEW_CATEGORY_WORDS: Record<string, string[]> = {
  music: [
    "Guitar",
    "Piano",
    "Drum",
    "Violin",
    "Microphone",
    "Concert",
    "Karaoke",
    "Choir",
    "Ukulele",
    "Trumpet",
    "Flute",
    "Rap",
    "Playlist",
    "Band",
    "Recorder",
    "DJ",
  ],
  transport: [
    "Car",
    "Bus",
    "Train",
    "Plane",
    "Bike",
    "Ferry",
    "Boat",
    "Helicopter",
    "Scooter",
    "Truck",
    "Taxi",
    "Motorbike",
    "Skateboard",
    "Ambulance",
    "Tractor",
    "Submarine",
  ],
  clothes: [
    "Hoodie",
    "Jeans",
    "Sneakers",
    "T-shirt",
    "Socks",
    "Hat",
    "Jacket",
    "Scarf",
    "Gloves",
    "Dress",
    "Skirt",
    "Shorts",
    "Sunglasses",
    "Pyjamas",
    "Boots",
    "Raincoat",
  ],
  nature: [
    "Forest",
    "River",
    "Volcano",
    "Rain",
    "Rainbow",
    "Thunder",
    "Lightning",
    "Waterfall",
    "Lake",
    "Flower",
    "Tree",
    "Cloud",
    "Snow",
    "Sunset",
    "Cave",
    "Storm",
  ],
  technology: [
    "Phone",
    "Laptop",
    "Wifi",
    "Headphones",
    "Tablet",
    "Keyboard",
    "Mouse",
    "Camera",
    "Robot",
    "Drone",
    "Charger",
    "App",
    "Password",
    "Printer",
    "Remote",
    "Emoji",
  ],
  holidays: [
    "Christmas",
    "Birthday",
    "Halloween",
    "Easter",
    "Camping",
    "Wedding",
    "New Year",
    "Fireworks",
    "Present",
    "Sleepover",
    "Costume",
    "Santa",
    "Parade",
    "Picnic",
    "Cruise",
    "Balloon",
  ],
  videogames: [
    "Minecraft",
    "Fortnite",
    "Roblox",
    "Mario",
    "Pokemon",
    "Zelda",
    "Sonic",
    "Tetris",
    "Pac-Man",
    "Geometry Dash",
    "Angry Birds",
    "Among Us",
    "FIFA",
    "Subway Surfers",
    "Brawl Stars",
    "Rocket League",
  ],
  medieval: [
    "Knight",
    "King",
    "Queen",
    "Sword",
    "Shield",
    "Crown",
    "Princess",
    "Armour",
    "Drawbridge",
    "Dungeon",
    "Throne",
    "Catapult",
    "Jester",
    "Peasant",
    "Blacksmith",
    "Tournament",
  ],
};

describe("word pack", () => {
  it("has sixteen family-friendly categories of 16 words with 2 hints", () => {
    expect(pack.categories).toHaveLength(16);
    expect(pack.categories.map((c) => c.id)).toEqual([
      "food",
      "animals",
      "places",
      "jobs",
      "sports",
      "movies",
      "household",
      "school",
      "music",
      "transport",
      "clothes",
      "nature",
      "technology",
      "holidays",
      "videogames",
      "medieval",
    ]);
    expect(pack.categories.map((c) => c.name)).toEqual([
      "Food",
      "Animals",
      "Places",
      "Jobs",
      "Sports",
      "Movies",
      "Household",
      "School",
      "Music",
      "Transport",
      "Clothes",
      "Nature",
      "Technology",
      "Holidays",
      "Video games",
      "Medieval",
    ]);
    for (const category of pack.categories) {
      expect(category.words).toHaveLength(16);
      const words = category.words.map((w) => w.word.toLowerCase());
      expect(new Set(words).size).toBe(16);
      for (const entry of category.words) {
        expect(entry.hints).toHaveLength(2);
        for (const hint of entry.hints) {
          expect(hint.trim().length).toBeGreaterThan(0);
          expect(hint.toLowerCase()).not.toBe(entry.word.toLowerCase());
        }
      }
    }
  });

  it("keeps the original eight secret-word lists unchanged", () => {
    for (const [id, words] of Object.entries(ORIGINAL_EIGHT_WORDS)) {
      expect(categoryById(id).words.map((entry) => entry.word)).toEqual(words);
    }
  });

  it("uses the closed IW-7 secret-word lists for the new categories", () => {
    for (const [id, words] of Object.entries(NEW_CATEGORY_WORDS)) {
      expect(categoryById(id).words.map((entry) => entry.word)).toEqual(words);
    }
  });

  it("keeps every secret unique across the whole pack", () => {
    const seen = new Set<string>();
    for (const category of pack.categories) {
      for (const entry of category.words) {
        const key = norm(entry.word);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(256);
  });

  it("keeps hints mechanically distinct from each other and from secrets in the same category", () => {
    for (const category of pack.categories) {
      const secrets = new Set(category.words.map((entry) => norm(entry.word)));
      const hintPairs = new Set<string>();

      for (const entry of category.words) {
        expect(entry.hints).toHaveLength(2);
        const [first, second] = entry.hints.map(norm);
        expect(first.length).toBeGreaterThan(0);
        expect(second.length).toBeGreaterThan(0);
        expect(first).not.toBe(second);
        expect(secrets.has(first)).toBe(false);
        expect(secrets.has(second)).toBe(false);

        const pairKey = [first, second].sort().join("\0");
        expect(hintPairs.has(pairKey)).toBe(false);
        hintPairs.add(pairKey);
      }
    }
  });

  it("applies the closed IW-3 hint replacements and Sofa → Couch rename", () => {
    const expected = [
      ["food", "Popcorn", ["Movies", "Salty"]],
      ["food", "Salad", ["Greens", "Fresh"]],
      ["animals", "Dolphin", ["Echolocation", "Ocean"]],
      ["school", "Pencil", ["Sharpen", "Eraser"]],
      ["school", "Locker", ["Storage", "Hallway"]],
      ["school", "Bell", ["Ring", "Breaktime"]],
      ["household", "Curtains", ["Window", "Shutter"]],
      ["household", "Microwave", ["Defrost", "Heat"]],
      ["household", "Dishwasher", ["Plates", "Wash"]],
      ["household", "Lamp", ["Light", "Bulb"]],
      ["household", "Couch", ["Cushion", "Lounge"]],
      ["movies", "Star Wars", ["Spaceship", "Force"]],
      ["movies", "Superman", ["Cape", "Flight"]],
      ["sports", "Hockey", ["Turf", "Stick"]],
      ["sports", "Baseball", ["Bat", "Catch"]],
      ["jobs", "Librarian", ["Books", "Silence"]],
      ["jobs", "Nurse", ["Patient", "Hospital"]],
      ["jobs", "Judge", ["Court", "Verdict"]],
      ["jobs", "Dentist", ["Scary", "Filling"]],
      ["jobs", "Doctor", ["Clinic", "Hospital"]],
    ] as const;

    for (const [categoryId, word, hints] of expected) {
      const category = categoryById(categoryId);
      expect(wordEntry(category, word).hints).toEqual([...hints]);
    }

    const householdWords = categoryById("household").words.map((entry) => entry.word);
    expect(householdWords).toContain("Couch");
    expect(householdWords).not.toContain("Sofa");
  });

  it("still deals Baseball imposters a Bat or Catch hint from the pack", () => {
    const sports = categoryById("sports");
    const used = sports.words.map((entry) => entry.word).filter((word) => word !== "Baseball");
    const setup: SetupState = {
      ...defaultSetup(pack),
      names: ["Ada", "Bob", "Cara"],
      enabledCategoryIds: ["sports"],
      imposterCount: 1,
      autoImposters: false,
      hintsEnabled: true,
      trollEnabled: false,
    };
    const { round } = dealRound({
      setup,
      pack,
      deck: { usedByCategory: { sports: used }, lastEnabledKey: "sports" },
      random: () => 0,
    });
    expect(round.secretWord).toBe("Baseball");
    const imposters = round.assignments.filter((assignment) => assignment.role === "imposter");
    expect(imposters.length).toBeGreaterThan(0);
    for (const assignment of imposters) {
      expect(["Bat", "Catch"]).toContain(assignment.hint);
    }
  });

  it("deals a Video games secret when only that category is enabled", () => {
    const words = categoryById("videogames").words.map((entry) => entry.word);
    const setup: SetupState = {
      ...defaultSetup(pack),
      names: ["Ada", "Bob", "Cara"],
      enabledCategoryIds: ["videogames"],
      trollEnabled: false,
    };
    const { round } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    expect(words).toContain(round.secretWord);
  });
});
