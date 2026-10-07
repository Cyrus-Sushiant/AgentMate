import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

describe('overlay surface', () => {
  it('opens a dropdown menu on the shared glass surface with neutral rows', () => {
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem tone="danger">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('overlay-surface', 'overlay-motion');
    expect(menu.className).not.toContain('bg-popover');

    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(rename).toHaveClass('rounded-lg', 'focus:bg-foreground/[0.07]');
    expect(rename.className).not.toContain('bg-primary');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass(
      'text-destructive',
      'focus:bg-destructive/10',
    );
  });

  it('opens a popover on the same surface', () => {
    render(
      <Popover open>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent>Panel body</PopoverContent>
      </Popover>,
    );

    const panel = screen.getByRole('dialog');
    expect(panel).toHaveClass('overlay-surface', 'overlay-motion');
    expect(panel).toHaveTextContent('Panel body');
  });
});
