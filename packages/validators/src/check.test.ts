import { describe, expect, it } from 'vitest';
import { createRegistry } from '@playgenx/registry';
import { validate } from './check.js';

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
    // Same body should fail with the default registry.
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
      options: [
        { id: 'a', label: '3' },
        { id: 'b', label: '4' },
      ],
    });
    // Without skipJsxCheck this would fail because of the `<` in JSON-ish
    // content; with skipJsxCheck=true it's allowed.
    expect(validate(json, undefined, { skipJsxCheck: true })).toBeNull();
  });

  it('skipJsxCheck=true: still catches eval/import/forbidden constructs', () => {
    const body = '{"x": eval("1")}';
    const err = validate(body, undefined, { skipJsxCheck: true });
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/eval/);
  });

  it('skipJsxCheck=true: still catches unknown components', () => {
    const body = '{"x": "<MyEvil />"}';
    const err = validate(body, undefined, { skipJsxCheck: true });
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/Unknown component/);
  });
});
