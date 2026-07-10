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
  });
});