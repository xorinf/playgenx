import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import {
  Button,
  TextField,
  Slider,
  Chart,
  Container,
  Code,
  Heading,
  Text,
  Stepper,
  Card,
  List,
  componentMap,
} from './index.js';
import { DEFAULT_REGISTRY } from '@playgenx/registry';

afterEach(() => cleanup());

describe('Button', () => {
  it('renders with the supplied label', () => {
    render(<Button label="Go" />);
    expect(screen.getByText('Go')).toBeTruthy();
  });

  it('forwards click events', () => {
    let clicks = 0;
    render(<Button label="Go" onClick={() => clicks++} />);
    fireEvent.click(screen.getByText('Go'));
    expect(clicks).toBe(1);
  });

  it('does not click when disabled', () => {
    let clicks = 0;
    render(<Button label="x" disabled onClick={() => clicks++} />);
    fireEvent.click(screen.getByText('x'));
    expect(clicks).toBe(0);
  });
});

describe('TextField', () => {
  it('renders an input', () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText('Name')).toBeTruthy();
  });

  it('emits onChange events', () => {
    let value = '';
    render(<TextField label="Name" value={value} onChange={(e) => (value = e.target.value)} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'hello' } });
    expect(value).toBe('hello');
  });

  it('respects placeholder', () => {
    render(<TextField placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeTruthy();
  });
});

describe('Slider', () => {
  it('clamps the value to the [min, max] range', () => {
    render(<Slider min={0} max={10} value={50} />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(Number(input.value)).toBe(10);
  });

  it('renders the current value numerically', () => {
    render(<Slider min={0} max={10} value={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('reaches min when value is below', () => {
    render(<Slider min={2} max={5} value={-100} />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(Number(input.value)).toBe(2);
  });

  it('updates internal state when uncontrolled', () => {
    render(<Slider min={0} max={10} label="Volume" />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '7' } });
    expect(input.value).toBe('7');
    expect(screen.getByText('7')).toBeTruthy();
  });
});

describe('Chart', () => {
  it('renders a bar chart for {labels, values}', () => {
    const { container } = render(
      <Chart kind="bar" data={{ labels: ['A', 'B'], values: [3, 5] }} title="Bar" />,
    );
    expect(screen.getByText('Bar')).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders a line chart for {x, y}', () => {
    const { container } = render(<Chart kind="line" data={{ x: [1, 2, 3], y: [10, 20, 15] }} />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });

  it('renders a pie chart for {labels, values}', () => {
    const { container } = render(
      <Chart kind="pie" data={{ labels: ['X', 'Y'], values: [1, 3] }} />,
    );
    expect(container.querySelectorAll('svg path').length).toBeGreaterThan(0);
  });

  it('falls back to <pre> for malformed data', () => {
    render(<Chart kind="bar" data={{ nope: true }} />);
    const pre = document.querySelector('pre');
    expect(pre).toBeTruthy();
  });
});

describe('Container', () => {
  it('renders children', () => {
    render(
      <Container>
        <span data-testid="x">hi</span>
      </Container>,
    );
    expect(screen.getByTestId('x')).toBeTruthy();
  });

  it('applies padding and gap from props', () => {
    const { container } = render(
      <Container padding="32px" gap="20px">
        <span>x</span>
      </Container>,
    );
    const root = container.querySelector('[data-pgx="Container"]') as HTMLElement;
    expect(root.style.padding).toBe('32px');
    expect(root.style.gap).toBe('20px');
  });
});

describe('Code', () => {
  it('renders inline code', () => {
    render(<Code>x = 1</Code>);
    expect(screen.getByText('x = 1')).toBeTruthy();
  });

  it('renders multi-line as <pre><code>', () => {
    const { container } = render(<Code>{'line1\nline2'}</Code>);
    expect(container.querySelector('pre code')).toBeTruthy();
  });

  it('uses language in data-attribute', () => {
    const { container } = render(<Code language="ts">x</Code>);
    const code = container.querySelector('[data-language]') as HTMLElement;
    expect(code.dataset.language).toBe('ts');
  });
});

describe('Heading', () => {
  it('renders the matching tag for level', () => {
    const { container } = render(<Heading level={3}>Title</Heading>);
    expect(container.querySelector('h3')?.textContent).toBe('Title');
  });

  it('clamps an over-high level to <h6>', () => {
    const { container } = render(<Heading level={99}>x</Heading>);
    expect(container.querySelector('h6')?.textContent).toBe('x');
  });

  it('clamps an under-low level to <h1>', () => {
    const { container } = render(<Heading level={0}>x</Heading>);
    expect(container.querySelector('h1')?.textContent).toBe('x');
  });

  it('falls back to <h2> when level is undefined', () => {
    const { container } = render(<Heading>x</Heading>);
    expect(container.querySelector('h2')).toBeTruthy();
  });
});

describe('Text', () => {
  it('renders children inside a <p>', () => {
    const { container } = render(<Text>hello</Text>);
    expect(container.querySelector('p')?.textContent).toBe('hello');
  });

  it('applies weight and color', () => {
    const { container } = render(
      <Text weight="bold" color="#ff0000">
        x
      </Text>,
    );
    const root = container.querySelector('p') as HTMLElement;
    expect(root.style.fontWeight).toBe('600');
    expect(root.style.color).toBe('rgb(255, 0, 0)');
  });
});

describe('Stepper', () => {
  const steps = [
    { id: 'a', title: 'A', body: <p>one</p> },
    { id: 'b', title: 'B', body: <p>two</p> },
    { id: 'c', title: 'C', body: <p>three</p> },
  ];

  it('starts on initial step', () => {
    render(<Stepper steps={steps} initial={1} />);
    // The active step is the one with aria-current=step.
    const step1 = screen.getByLabelText('Step 1: A');
    const step2 = screen.getByLabelText('Step 2: B');
    const step3 = screen.getByLabelText('Step 3: C');
    expect(step1.getAttribute('aria-current')).toBe(null);
    expect(step2.getAttribute('aria-current')).toBe('step');
    expect(step3.getAttribute('aria-current')).toBe(null);
  });

  it('marks the first step as current by default', () => {
    render(<Stepper steps={steps} />);
    expect(screen.getByLabelText('Step 1: A').getAttribute('aria-current')).toBe('step');
    expect(screen.getByLabelText('Step 2: B').getAttribute('aria-current')).toBe(null);
  });

  it('disables step circles ahead of the current one', () => {
    render(<Stepper steps={steps} initial={0} />);
    const step3 = screen.getByLabelText('Step 3: C') as HTMLButtonElement;
    expect(step3.disabled).toBe(true);
  });

  it('does not disable step circles at or behind the current one', () => {
    render(<Stepper steps={steps} initial={1} />);
    expect((screen.getByLabelText('Step 1: A') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Step 2: B') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Step 3: C') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Card', () => {
  it('renders title and children', () => {
    render(
      <Card title="Card title">
        <span data-testid="kid">content</span>
      </Card>,
    );
    expect(screen.getByText('Card title')).toBeTruthy();
    expect(screen.getByTestId('kid')).toBeTruthy();
  });

  it('elevation=0 means no shadow', () => {
    const { container } = render(<Card elevation={0}>x</Card>);
    const root = container.querySelector('section') as HTMLElement;
    expect(root.style.boxShadow).toBe('none');
  });
});

describe('List', () => {
  it('renders a list from a string array', () => {
    render(<List items={['a', 'b', 'c']} />);
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('c')).toBeTruthy();
  });

  it('ordered prop switches to <ol>', () => {
    const { container } = render(<List ordered items={['a']} />);
    expect(container.querySelector('ol')).toBeTruthy();
  });

  it('handles undefined items gracefully', () => {
    render(<List />);
    expect(document.querySelector('ul')).toBeTruthy();
  });
});

describe('registry ↔ componentMap coverage', () => {
  it('componentMap has an entry for every name in DEFAULT_REGISTRY', () => {
    for (const name of DEFAULT_REGISTRY.list()) {
      expect(componentMap[name]).toBeTruthy();
    }
  });

  it('componentMap has no orphan keys', () => {
    const regSet = new Set(DEFAULT_REGISTRY.list());
    for (const key of Object.keys(componentMap)) {
      expect(regSet.has(key)).toBe(true);
    }
  });
});

describe('render determinism', () => {
  it('Chart SVG output is byte-stable across two renders with same data', () => {
    const data = { labels: ['A', 'B'], values: [3, 5] };
    const a = render(<Chart kind="bar" data={data} title="t" />).container.innerHTML;
    cleanup();
    const b = render(<Chart kind="bar" data={data} title="t" />).container.innerHTML;
    expect(a).toBe(b);
  });

  it('Heading output is stable across renders', () => {
    const a = render(<Heading level={2}>x</Heading>).container.innerHTML;
    cleanup();
    const b = render(<Heading level={2}>x</Heading>).container.innerHTML;
    expect(a).toBe(b);
  });

  it('Stepper is stable when initial step is fixed', () => {
    const steps = [{ id: 'a', title: 'A', body: <p>x</p> }];
    const a = render(<Stepper steps={steps} initial={0} />).container.innerHTML;
    cleanup();
    const b = render(<Stepper steps={steps} initial={0} />).container.innerHTML;
    expect(a).toBe(b);
  });
});
