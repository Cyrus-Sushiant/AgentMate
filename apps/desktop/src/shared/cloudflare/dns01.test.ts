import { describe, expect, it } from 'vitest';
import { dns01Coverage, zoneCovering } from './dns01';

describe('DNS-01 coverage', () => {
  it('finds the longest zone a name belongs to, wildcards included', () => {
    expect(zoneCovering('*.app.example.com', ['example.com', 'app.example.com'])).toBe(
      'app.example.com',
    );
    expect(zoneCovering('Example.com', ['example.com'])).toBe('example.com');
    expect(zoneCovering('notexample.com', ['example.com'])).toBeNull();
  });

  it('is covered only when every domain has a zone token', () => {
    expect(dns01Coverage(['example.com', '*.example.com'], ['example.com'])).toEqual({
      covered: true,
      missing: [],
      wildcard: true,
    });
    expect(dns01Coverage(['example.com', 'example.org'], ['example.com'])).toEqual({
      covered: false,
      missing: ['example.org'],
      wildcard: false,
    });
    expect(dns01Coverage([], ['example.com']).covered).toBe(false);
  });
});
