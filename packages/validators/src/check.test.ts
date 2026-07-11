import { describe, expect, it } from 'vitest';
import { createRegistry } from '@playgenx/registry';
import { validate, validateForKind } from './check.js';

describe('validate', () => {
  it('returns null for a clean artifact using allowed components', () => {
    const body = '<Card><Heading>Hi</Heading><Text>world</Text></Card>';
    expect(validate(body)).toBeNull();
  });

  it('catches `eval(`', () => {
    const body = 'const x = eval("1+1");';
    const err = validate(body);
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/eval/);
  });

  it('catches `new Function(` (case-insensitive)', () => {
    const body = 'const f = new function("return 1");';
    const err = validate(body);
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/new Function/);
  });

  it('catches import statements', () => {
    const body = 'import x from "y";';
    const err = validate(body);
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/import/);
  });

  it('catches require()', () => {
    const body = 'const x = require("y");';
    const err = validate(body);
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/require/);
  });

  it('catches unbalanced tags', () => {
    const body = '<div><span>x</div>';
    const err = validate(body);
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/Unbalanced/);
  });

  it('catches unknown components', () => {
    const body = '<MyEvilComponent />';
    const err = validate(body);
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/Unknown component: MyEvilComponent/);
  });

  it('allows built-in HTML tags without registry membership', () => {
    const body = '<div><p>hi</p></div>';
    expect(validate(body)).toBeNull();
  });

  it('allows user-supplied registry to whitelist extra components', () => {
    const custom = createRegistry(['MyWidget']);
    expect(validate('<MyWidget />', custom)).toBeNull();
    expect(validate('<MyWidget />')).not.toBeNull();
  });

  it('returns null for empty body', () => {
    expect(validate('')).toBeNull();
  });

  it('comment-stripping: // eval() in a comment is allowed', () => {
    const body = '// eval("nope")\n<Card />';
    expect(validate(body)).toBeNull();
  });

  it('comment-stripping: /* require() */ in a comment is allowed', () => {
    const body = '/* require("nope") */\n<Card />';
    expect(validate(body)).toBeNull();
  });

  it('skipJsxCheck=true: JSON-bodied artifacts with no tags pass', () => {
    const json = JSON.stringify({
      question: 'What is 2 + 2?',
      options: [{ id: 'a', label: '3' }, { id: 'b', label: '4' }],
    });
    expect(validate(json, undefined, { skipJsxCheck: true })).toBeNull();
  });

  it('skipJsxCheck=true: still catches eval/import/forbidden constructs', () => {
    const body = '{"x": eval("1")}';
    const err = validate(body, undefined, { skipJsxCheck: true });
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/eval/);
  });

  it('skipJsxCheck=true: still catches unknown components outside strings', () => {
    // Tag is in JSX, not inside a string.
    const body = '{"leading": "json"}\n<MyEvil />';
    const err = validate(body, undefined, { skipJsxCheck: true });
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/Unknown component/);
  });

  it('skipJsxCheck=true: ignores unknown components inside string literals', () => {
    // Tag is inside a string — should be ignored (the validator's "unknown
    // component" check runs on tagNames which strips strings).
    const body = '{"x": "<MyEvil />"}';
    expect(validate(body, undefined, { skipJsxCheck: true })).toBeNull();
  });

  it('string-literal robustness: forbidden constructs inside strings do not trigger', () => {
    // "import " inside a string is not an import statement.
    const body = '<Card>{"text": "import is forbidden in this context"}</Card>';
    expect(validate(body)).toBeNull();
    // eval inside a string is not a call.
    const body2 = '<Card>{"text": "eval(something)"}</Card>';
    expect(validate(body2)).toBeNull();
  });
});

describe('validateForKind (kind-specific JSON shape checks)', () => {
  describe('poll', () => {
    const valid = JSON.stringify({
      question: 'What is 2 + 2?',
      options: [
        { id: 'a', label: '3' },
        { id: 'b', label: '4' },
      ],
    });

    it('accepts a well-formed poll', () => {
      expect(validateForKind('poll', valid)).toBeNull();
    });

    it('rejects invalid JSON', () => {
      const err = validateForKind('poll', '{not valid json');
      expect(err).not.toBeNull();
      expect(err?.message).toMatch(/not valid JSON/);
    });

    it('rejects missing question', () => {
      const err = validateForKind(
        'poll',
        JSON.stringify({ options: [{ id: 'a', label: 'x' }] }),
      );
      expect(err?.message).toMatch(/missing `question`/);
    });

    it('rejects too-few options', () => {
      const err = validateForKind(
        'poll',
        JSON.stringify({
          question: 'q',
          options: [{ id: 'a', label: 'x' }],
        }),
      );
      expect(err?.message).toMatch(/between 2 and 4/);
    });

    it('rejects too-many options', () => {
      const err = validateForKind(
        'poll',
        JSON.stringify({
          question: 'q',
          options: [
            { id: 'a', label: '1' },
            { id: 'b', label: '2' },
            { id: 'c', label: '3' },
            { id: 'd', label: '4' },
            { id: 'e', label: '5' },
          ],
        }),
      );
      expect(err?.message).toMatch(/between 2 and 4/);
    });

    it('rejects option missing id or label', () => {
      const err = validateForKind(
        'poll',
        JSON.stringify({
          question: 'q',
          options: [{ id: 'a' }, { label: 'b' }],
        }),
      );
      expect(err?.message).toMatch(/id|label/);
    });

    it('skipJsonCheck bypasses the shape check', () => {
      expect(validateForKind('poll', '{garbage', undefined, { skipJsonCheck: true })).toBeNull();
    });
  });

  describe('quiz', () => {
    const valid = JSON.stringify({
      questions: [
        {
          id: 'q1',
          prompt: 'Pick A',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'a',
        },
        {
          id: 'q2',
          prompt: 'Pick B',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'b',
        },
        {
          id: 'q3',
          prompt: 'Pick C',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'a',
        },
      ],
    });

    it('accepts a well-formed quiz', () => {
      expect(validateForKind('quiz', valid)).toBeNull();
    });

    it('rejects too-few questions', () => {
      const err = validateForKind(
        'quiz',
        JSON.stringify({
          questions: [
            {
              id: 'q1',
              prompt: 'p',
              options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
              answer: 'a',
            },
          ],
        }),
      );
      expect(err?.message).toMatch(/between 3 and 8/);
    });

    it('rejects answer that does not match any option id', () => {
      const err = validateForKind(
        'quiz',
        JSON.stringify({
          questions: [
            {
              id: 'q1',
              prompt: 'p',
              options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
              answer: 'c',
            },
            {
              id: 'q2',
              prompt: 'p',
              options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
              answer: 'a',
            },
            {
              id: 'q3',
              prompt: 'p',
              options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
              answer: 'a',
            },
          ],
        }),
      );
      expect(err?.message).toMatch(/answer.*doesn't match/);
    });
  });

  describe('flashcards', () => {
    const valid = JSON.stringify({
      cards: [
        { id: 'c1', front: 'F1', back: 'B1' },
        { id: 'c2', front: 'F2', back: 'B2' },
        { id: 'c3', front: 'F3', back: 'B3' },
        { id: 'c4', front: 'F4', back: 'B4' },
        { id: 'c5', front: 'F5', back: 'B5' },
      ],
    });

    it('accepts a well-formed deck', () => {
      expect(validateForKind('flashcards', valid)).toBeNull();
    });

    it('rejects too-few cards', () => {
      const err = validateForKind(
        'flashcards',
        JSON.stringify({
          cards: [
            { id: 'c1', front: 'F', back: 'B' },
            { id: 'c2', front: 'F', back: 'B' },
          ],
        }),
      );
      expect(err?.message).toMatch(/between 5 and 20/);
    });

    it('rejects card missing required field', () => {
      const err = validateForKind(
        'flashcards',
        JSON.stringify({
          cards: [
            { id: 'c1', front: 'F' },
            { id: 'c2', front: 'F', back: 'B' },
            { id: 'c3', front: 'F', back: 'B' },
            { id: 'c4', front: 'F', back: 'B' },
            { id: 'c5', front: 'F', back: 'B' },
          ],
        }),
      );
      expect(err?.message).toMatch(/flashcard 0 is missing `back`/);
    });

    it('rejects duplicate card IDs', () => {
      const err = validateForKind(
        'flashcards',
        JSON.stringify({
          cards: [
            { id: 'c1', front: 'F1', back: 'B1' },
            { id: 'c1', front: 'F2', back: 'B2' }, // dup
            { id: 'c3', front: 'F3', back: 'B3' },
            { id: 'c4', front: 'F4', back: 'B4' },
            { id: 'c5', front: 'F5', back: 'B5' },
          ],
        }),
      );
      expect(err?.message).toMatch(/flashcard 1 has duplicate `id` "c1"/);
    });

    it('rejects a card that is not an object', () => {
      const err = validateForKind(
        'flashcards',
        JSON.stringify({
          cards: [
            { id: 'c1', front: 'F1', back: 'B1' },
            'not an object',
            { id: 'c3', front: 'F3', back: 'B3' },
            { id: 'c4', front: 'F4', back: 'B4' },
            { id: 'c5', front: 'F5', back: 'B5' },
          ],
        }),
      );
      expect(err?.message).toMatch(/flashcard 1 is not an object/);
    });
  });

  // ────────────────── new poll/quiz validation (v0.2.x) ──────────────────
  describe('poll: duplicate IDs and non-object entries', () => {
    it('rejects duplicate option IDs', () => {
      const err = validateForKind(
        'poll',
        JSON.stringify({
          question: 'q',
          options: [
            { id: 'a', label: '1' },
            { id: 'a', label: '2' }, // dup
          ],
        }),
      );
      expect(err?.message).toMatch(/poll has duplicate option `id` "a"/);
    });

    it('rejects an option that is not an object', () => {
      const err = validateForKind(
        'poll',
        JSON.stringify({
          question: 'q',
          options: [{ id: 'a', label: '1' }, null],
        }),
      );
      expect(err?.message).toMatch(/poll option 1 is not an object/);
    });
  });

  describe('quiz: duplicate IDs, non-object entries, non-empty answer', () => {
    it('rejects duplicate question IDs across the deck', () => {
      const err = validateForKind(
        'quiz',
        JSON.stringify({
          questions: [
            { id: 'q1', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
            { id: 'q1', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' }, // dup
            { id: 'q3', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
          ],
        }),
      );
      expect(err?.message).toMatch(/quiz question 1 has duplicate `id` "q1"/);
    });

    it('rejects duplicate option IDs within a question', () => {
      const err = validateForKind(
        'quiz',
        JSON.stringify({
          questions: [
            { id: 'q1', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }], answer: 'a' },
            { id: 'q2', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
            { id: 'q3', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
          ],
        }),
      );
      expect(err?.message).toMatch(/quiz q0 has duplicate option `id` "a"/);
    });

    it('rejects empty-string answer', () => {
      const err = validateForKind(
        'quiz',
        JSON.stringify({
          questions: [
            { id: 'q1', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: '' },
            { id: 'q2', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
            { id: 'q3', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
          ],
        }),
      );
      expect(err?.message).toMatch(/quiz question 0 is missing `answer`/);
    });

    it('rejects a question that is not an object', () => {
      const err = validateForKind(
        'quiz',
        JSON.stringify({
          questions: [
            null,
            { id: 'q2', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
            { id: 'q3', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
          ],
        }),
      );
      expect(err?.message).toMatch(/quiz question 0 is not an object/);
    });

    it('scopes option IDs per question (does not leak across questions)', () => {
      // Previously the optionIds set was hoisted outside the loop, so
      // question 0 could have answer="x" where "x" was an option in question 2.
      // After the fix, option IDs are scoped per question.
      const err = validateForKind(
        'quiz',
        JSON.stringify({
          questions: [
            { id: 'q1', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'c' },
            { id: 'q2', prompt: 'p', options: [{ id: 'c', label: 'C' }, { id: 'd', label: 'D' }], answer: 'c' },
            { id: 'q3', prompt: 'p', options: [{ id: 'e', label: 'E' }, { id: 'f', label: 'F' }], answer: 'e' },
          ],
        }),
      );
      // Question 0's answer "c" is NOT in its own options, even though
      // question 1 has an option id "c". Should be rejected.
      expect(err?.message).toMatch(/answer.*"c".*doesn't match/);
    });
  });

  describe('TSX kinds (playground, simulation, lab)', () => {
    it('does not run JSON shape checks on playground', () => {
      const tsx = '<Card><Text>hi</Text></Card>';
      expect(validateForKind('playground', tsx)).toBeNull();
    });

    it('does not run JSON shape checks on simulation', () => {
      const tsx = '<div><Text>sim</Text></div>';
      expect(validateForKind('simulation', tsx)).toBeNull();
    });

    it('does not run JSON shape checks on lab', () => {
      const tsx = '<div><Heading>Lab</Heading><Button>Hint</Button></div>';
      expect(validateForKind('lab', tsx)).toBeNull();
    });

    it('rejects non-deterministic expressions (Math.random, Date.now, window.*)', () => {
      const tsx = '<Button onClick={() => Math.random()} />';
      const err = validateForKind('playground', tsx);
      expect(err).not.toBeNull();
      expect(err?.message).toMatch(/Non-deterministic expression/);
      expect(err?.message).toContain('Math');
    });

    it('rejects Date.now() inside a JSX expression', () => {
      const tsx = '<Text>{Date.now()}</Text>';
      const err = validateForKind('playground', tsx);
      expect(err?.message).toContain('Date');
    });

    it('accepts the word "Math" inside a JS string literal', () => {
      const tsx = '<Heading label="Math is fun" />';
      expect(validateForKind('playground', tsx)).toBeNull();
    });

    it('accepts identifiers that share prefixes (matches, updatedAt, ...)', () => {
      const tsx = '<Card><Text>{matches.length}</Text><Text>{updatedAt}</Text></Card>';
      expect(validateForKind('playground', tsx)).toBeNull();
    });

    it('does not run the non-deterministic check on JSON kinds', () => {
      // JSON-body check is via validateForKind for poll/quiz/flashcards.
      // A JSON body that happens to contain the word "Math" should
      // still parse fine — the determinism check is TSX-only.
      const json = JSON.stringify({
        question: 'What is Math?',
        options: [{ id: 'a', label: 'A study' }, { id: 'b', label: 'B study' }],
      });
      expect(validateForKind('poll', json)).toBeNull();
    });
  });
});