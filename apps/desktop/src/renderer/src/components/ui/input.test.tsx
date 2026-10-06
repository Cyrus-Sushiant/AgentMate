import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Combobox } from './combobox';
import { Input } from './input';
import { SecretInput } from './secret-input';
import { Textarea } from './textarea';

// The tests only look at classes, so a change goes nowhere.
const ignore = (): void => undefined;

describe('shared field surface', () => {
  it('draws Input, Textarea and the Combobox trigger with the field surface by default', () => {
    render(
      <>
        <Input aria-label="Name" />
        <Textarea aria-label="Notes" />
        <Combobox ariaLabel="Model" options={[]} value="" onChange={ignore} />
      </>,
    );
    expect(screen.getByLabelText('Name')).toHaveClass('field-surface', 'rounded-full');
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveClass(
      'field-surface',
      'rounded-full',
    );
    // A multi-line box keeps the surface but not the pill shape.
    const notes = screen.getByLabelText('Notes');
    expect(notes).toHaveClass('field-surface');
    expect(notes).not.toHaveClass('rounded-full');
  });

  it('draws a number field on its shell, which holds the step buttons too', () => {
    render(<Input aria-label="Port" type="number" />);
    const port = screen.getByLabelText('Port');
    expect(port).not.toHaveClass('field-surface');
    expect(port.parentElement).toHaveClass('field-surface', 'rounded-full');
  });

  it('gives a secret field the surface too', () => {
    render(<SecretInput aria-label="Key" value="" onChange={ignore} />);
    expect(screen.getByLabelText('Key')).toHaveClass('field-surface');
  });

  it('drops the surface for the bare variant without passing the variant to the DOM', () => {
    render(
      <>
        <Input aria-label="Bare" variant="bare" />
        <Textarea aria-label="Bare notes" variant="bare" />
        <Combobox ariaLabel="Bare pick" variant="bare" options={[]} value="" onChange={ignore} />
      </>,
    );
    expect(screen.getByLabelText('Bare')).not.toHaveClass('field-surface');
    expect(screen.getByLabelText('Bare')).not.toHaveAttribute('variant');
    expect(screen.getByLabelText('Bare notes')).not.toHaveClass('field-surface');
    expect(screen.getByRole('combobox', { name: 'Bare pick' })).not.toHaveClass('field-surface');
  });

  it('marks a rejected combobox value as invalid', () => {
    render(<Combobox ariaLabel="Region" invalid options={[]} value="" onChange={ignore} />);
    expect(screen.getByRole('combobox', { name: 'Region' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
