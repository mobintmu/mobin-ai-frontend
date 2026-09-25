import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../src/components/Markdown';

describe('safe Markdown', () => {
  it('renders tables, code, lists and known citations', () => {
    render(<Markdown content={'### Heading\n\n1. Parent\n   - Child\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n`code` [c1] [missing]'} citations={[{ citation_id: 'c1', title: 'Article', url: 'https://mobinshaterian.com/blog/article' }]} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /c1/ })).toHaveAttribute('href', 'https://mobinshaterian.com/blog/article');
    expect(screen.getByText('[missing]')).toBeInTheDocument();
  });
  it('does not render raw HTML or hostile links', () => {
    const { container } = render(<Markdown content={'<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) [data](data:text/html,evil)'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});
