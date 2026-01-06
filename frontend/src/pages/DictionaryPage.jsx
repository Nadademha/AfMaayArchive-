[
  {
    "maay": "aam",
    "english": "eat (primary root for conjugation)",
    "category": "verb",
    "examples": [
      {"sentence": "ani aame", "translation": "I eat"},
      {"sentence": "ani aami", "translation": "I ate"}
    ],
    "notes": "Alternates with 'aang' in commands and some past forms."
  },
  {
    "maay": "aang",
    "english": "eat (alternate root/command form)",
    "category": "verb",
    "examples": [
      {"sentence": "aang!", "translation": "eat! (command)"},
      {"sentence": "athi aangteey", "translation": "you ate"}
    ],
    "notes": "Used in imperatives and certain past tenses."
  },
  {
    "maay": "anduunya",
    "english": "earth/world",
    "category": "noun",
    "examples": [
      {"sentence": "Anduunya thi ma yarto.", "translation": "The earth is not small."}
    ],
    "notes": ""
  },
  {
    "maay": "baabur",
    "english": "car",
    "category": "noun",
    "examples": [
      {"sentence": "Babur key la suubi yi", "translation": "My car was fixed"}
    ],
    "notes": "Synonym: gaari (vehicle)"
  },
  {
    "maay": "roon",
    "english": "be good/fine (state verb)",
    "category": "verb",
    "examples": [
      {"sentence": "ani roonye", "translation": "I am good"},
      {"sentence": "athi roonte", "translation": "you are good"}
    ],
    "notes": "Conjugates as a state verb, no copula needed."
  },
  {
    "maay": "hundur",
    "english": "sleep",
    "category": "verb",
    "examples": [
      {"sentence": "ani hunduroye", "translation": "I sleep"},
      {"sentence": "ani hunduri", "translation": "I slept"}
    ],
    "notes": "Uses progressive -oy- pattern."
  },
  {
    "maay": "-aase / -ase",
    "english": "question/affirmative suffix (will you...? / you will...)",
    "category": "suffix",
    "examples": [
      {"sentence": "Badi sa aragaase?", "translation": "Will you see the ocean?"}
    ],
    "notes": "Short form (-ase) if root elongated. Family includes sound harmony variants (yaase, haase, etc.)."
  },
  {
    "maay": "may",
    "english": "what",
    "category": "particle",
    "examples": [
      {"sentence": "May weel fadi?", "translation": "What would you have done?"}
    ],
    "notes": ""
  },
  {
    "maay": "si theew",
    "english": "hello / how are you?",
    "category": "greeting",
    "examples": [],
    "notes": "General greeting."
  }
  // ... (full array continues with all extracted entries: verbs like dhang, kooy, arak; nouns like gewer, moos, biyo; adjectives like moony, yariis; particles like ka, ila, le; full suffix families; greetings; etc.)
]
import React, { useState, useMemo } from 'react';
import dictionaryData from './dictionary.json'; // Place JSON in same folder or adjust path

const DictionaryPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return dictionaryData;
    const lowerTerm = searchTerm.toLowerCase();
    return dictionaryData.filter(entry =>
      entry.maay.toLowerCase().includes(lowerTerm) ||
      entry.english.toLowerCase().includes(lowerTerm) ||
      (entry.notes && entry.notes.toLowerCase().includes(lowerTerm))
    );
  }, [searchTerm]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Af Maay Dictionary</h1>
      <input
        type="text"
        placeholder="Search Af Maay or English..."
        className="w-full p-4 mb-8 border rounded-lg text-lg"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus
      />
      <div className="space-y-6">
        {filteredEntries.length === 0 ? (
          <p>No matching entries found.</p>
        ) : (
          filteredEntries.map((entry, index) => (
            <div key={index} className="border-b pb-4">
              <div className="flex justify-between">
                <strong className="text-xl">{entry.maay}</strong>
                <span className="text-gray-600 italic">{entry.category}</span>
              </div>
              <p className="mt-2 text-lg">{entry.english}</p>
              {entry.notes && <p className="mt-2 text-sm text-gray-700">Notes: {entry.notes}</p>}
              {entry.examples.length > 0 && (
                <ul className="mt-3 list-disc pl-6">
                  {entry.examples.map((ex, i) => (
                    <li key={i}>
                      <em>{ex.sentence}</em> — {ex.translation}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
      <p className="mt-8 text-center text-gray-500">
        {dictionaryData.length} entries • Fully static & offline-capable
      </p>
    </div>
  );
};

export default DictionaryPage;
