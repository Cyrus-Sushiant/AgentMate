import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricChart } from './MetricChart';

/** The chart's readout: by pointer, by keyboard, and in words for a screen reader. */

const times = [0, 1_000, 2_000, 3_000];
const series = [
  { key: 'rx', label: 'Received', color: '#00994d', values: [10, 20, 30, 40] },
  { key: 'tx', label: 'Sent', color: '#2a78d6', values: [1, 2, 3, 4] },
];

function renderChart(overrides: Partial<Parameters<typeof MetricChart>[0]> = {}) {
  return render(
    <MetricChart
      title="Network"
      times={times}
      series={series}
      yMax={50}
      formatValue={(v) => `${v} B/s`}
      formatTime={(at) => `t${at}`}
      axisTimes={(at) => `a${at}`}
      {...overrides}
    />,
  );
}

describe('MetricChart', () => {
  it('sums up the readings in its label and draws one line per series', () => {
    const { container } = renderChart();
    expect(
      screen.getByRole('img', {
        name: 'Network, 4 readings from t0 to t3000. Latest: Received 40 B/s, Sent 4 B/s.',
      }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('path[data-series]')).toHaveLength(2);
    expect(screen.getByText('a1500')).toBeInTheDocument();
  });

  it('moves the readout with the arrow keys, Home and End, and hides it on Escape', () => {
    renderChart();
    const plot = screen.getByRole('img');
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('t200030 B/sReceived3 B/sSent');
    fireEvent.keyDown(plot, { key: 'Home' });
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('t0');
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('t1000');
    fireEvent.keyDown(plot, { key: 'End' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('t3000');
    fireEvent.keyDown(plot, { key: 'a' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('t3000');
    fireEvent.keyDown(plot, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    fireEvent.blur(plot);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('snaps the crosshair to the reading nearest the pointer', () => {
    renderChart();
    const plot = screen.getByRole('img');
    plot.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 100 }) as DOMRect;
    fireEvent.pointerMove(plot, { clientX: 110 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('t1000');
    fireEvent.pointerMove(plot, { clientX: 290 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('t3000');
    fireEvent.pointerLeave(plot);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('says when there are no readings and ignores the keys then', () => {
    renderChart({ times: [], series: [{ ...series[0], values: [] }], yMax: 0 });
    const plot = screen.getByRole('img', { name: 'Network: no readings yet' });
    fireEvent.keyDown(plot, { key: 'End' });
    fireEvent.pointerMove(plot, { clientX: 10 });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('draws a single reading at the right edge', () => {
    renderChart({ times: [5], series: [{ ...series[0], values: [7] }] });
    fireEvent.keyDown(screen.getByRole('img'), { key: 'End' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('7 B/s');
  });
});
