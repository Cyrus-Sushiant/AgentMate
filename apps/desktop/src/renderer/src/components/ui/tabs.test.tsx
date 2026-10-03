import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

describe('Tabs', () => {
  it('shows a focus ring on the tab and the panel a keyboard reaches', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First</TabsContent>
        <TabsContent value="two">Second</TabsContent>
      </Tabs>,
    );

    await user.tab();
    const tab = screen.getByRole('tab', { name: 'One' });
    expect(document.activeElement).toBe(tab);
    expect(tab.className).toContain('focus-visible:ring-2');

    await user.tab();
    const panel = screen.getByRole('tabpanel', { name: 'One' });
    expect(document.activeElement).toBe(panel);
    expect(panel.className).toContain('focus-visible:ring-2');
  });
});
