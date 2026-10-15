import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { LoopPanel, type DashboardLoop } from './LoopPanel';

const LOOP: DashboardLoop = {
  number: 2,
  goal: { id: 'g1', name: '30 trial signups/mo', metric: 'signups', targetValue: 30, unit: 'signups' },
  strategy: { id: 's1', name: 'founder-led outbound' },
  experiment: { id: 'e1', name: 'LinkedIn DM test', status: 'COMPLETED', metric: 'replies', endDate: null },
  rail: [
    { node: 'STRATEGY', state: 'DONE' },
    { node: 'EXPERIMENT', state: 'DONE' },
    { node: 'OUTCOME', state: 'CURRENT' },
    { node: 'LEARNING', state: 'TODO' },
  ],
};

describe('LoopPanel', () => {
  it('names the loop and the goal it serves', () => {
    renderWithProviders(<LoopPanel loop={LOOP} />);

    expect(screen.getByText(i18n.t('app.dashboard.loopTitle', { number: 2 }))).toBeInTheDocument();
    expect(screen.getByText('30 trial signups/mo')).toBeInTheDocument();
  });

  it('renders one rail node per entry, labelled and with its state exposed', () => {
    renderWithProviders(<LoopPanel loop={LOOP} />);

    const nodes = screen.getAllByTestId('rail-node');
    expect(nodes).toHaveLength(4);
    expect(nodes.map((node) => node.getAttribute('data-state'))).toEqual(['DONE', 'DONE', 'CURRENT', 'TODO']);
    expect(screen.getByText(i18n.t('app.dashboard.rail.OUTCOME'))).toBeInTheDocument();
  });

  it('explains every rail node in-app', () => {
    renderWithProviders(<LoopPanel loop={LOOP} />);

    // web/CLAUDE.md rule 2: Loop, Outcome and Learning appear here for the
    // first time, so each node carries its own Help — four nodes plus the
    // loop itself. `Help` exposes role="button" with an "Explain: <title>"
    // accessible name (src/components/Help.tsx:21-25).
    expect(screen.getAllByRole('button', { name: /^Explain:/ })).toHaveLength(5);
  });

  it('renders without a goal', () => {
    renderWithProviders(<LoopPanel loop={{ ...LOOP, goal: null }} />);

    expect(screen.getByText(i18n.t('app.dashboard.loopTitle', { number: 2 }))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('app.dashboard.noGoal'))).toBeInTheDocument();
  });

  it('renders before an experiment exists', () => {
    renderWithProviders(
      <LoopPanel
        loop={{
          ...LOOP,
          experiment: null,
          rail: [
            { node: 'STRATEGY', state: 'DONE' },
            { node: 'EXPERIMENT', state: 'CURRENT' },
            { node: 'OUTCOME', state: 'TODO' },
            { node: 'LEARNING', state: 'TODO' },
          ],
        }}
      />,
    );

    expect(screen.getAllByTestId('rail-node')).toHaveLength(4);
    expect(screen.queryByText('LinkedIn DM test')).not.toBeInTheDocument();
  });
});
