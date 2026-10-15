import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { AiFillPanel } from './AiFillPanel';
import type { FillQuestion } from '@/schemas/fill-proposal';

// Pins the locale the same way every other component test in this repo does
// (see ResearchPanel.test.tsx) — without it, react-i18next never initializes
// in jsdom and every t() call renders its raw key instead of copy.
void i18n.changeLanguage('en');

const q = (over: Partial<FillQuestion>): FillQuestion => ({
  id: 'mrr',
  ask: 'Quanto a empresa faturou no último mês?',
  why: 'É a base de tudo.',
  answerType: 'currency',
  fills: 'currentPerformance.mrr',
  impact: 3,
  ...over,
} as FillQuestion);

describe('AiFillPanel', () => {
  it('shows one question at a time, highest impact first', () => {
    render(
      <AiFillPanel
        questions={[q({ id: 'low', ask: 'Pergunta menor', impact: 1 }), q({ id: 'high', ask: 'Pergunta maior', impact: 3 })]}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByText('Pergunta maior')).toBeInTheDocument();
    expect(screen.queryByText('Pergunta menor')).not.toBeInTheDocument();
  });

  it('sends the answer to the form under the question\'s fills path', async () => {
    const onAnswer = vi.fn();
    render(<AiFillPanel questions={[q({})]} onAnswer={onAnswer} />);

    // `currency` usa o campo com máscara de milhar (type=text), não o
    // spinbutton: o que sai continua sendo número.
    const input = screen.getByLabelText('Answer');
    await userEvent.type(input, '45000');
    expect(input).toHaveValue('45,000');
    await userEvent.click(screen.getByRole('button', { name: /responder|answer|responder/i }));

    expect(onAnswer).toHaveBeenCalledWith('currentPerformance.mrr', 45000);
  });

  it('accepts zero as an answer', async () => {
    // Zero is the honest answer to most of these questions for a pre-revenue
    // founder — MRR, customers, ad spend. Treating it as "no answer given"
    // locks exactly that founder out of the panel.
    const onAnswer = vi.fn();
    // Two questions so the panel is still mounted afterwards — a panel with a
    // single question unmounts the moment it is resolved, taking the progress
    // line with it.
    render(
      <AiFillPanel
        questions={[q({}), q({ id: 'signups', ask: 'Quantos cadastros por mês?', fills: 'currentPerformance.monthlySignups', impact: 1 })]}
        onAnswer={onAnswer}
      />,
    );

    await userEvent.type(screen.getByLabelText('Answer'), '0');
    await userEvent.click(screen.getByRole('button', { name: /responder|answer/i }));

    expect(onAnswer).toHaveBeenCalledWith('currentPerformance.mrr', 0);
    expect(screen.getByText('1 of 2 answered')).toBeInTheDocument();
  });

  it('renders a select when the question offers choices', () => {
    render(
      <AiFillPanel
        questions={[q({ id: 'urgency', answerType: 'choice', choices: ['low', 'high'], fills: 'constraints.urgency' })]}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('advances past a question answered with "I do not know" and never returns to it', async () => {
    const onAnswer = vi.fn();
    render(<AiFillPanel questions={[q({ id: 'a', ask: 'Primeira' }), q({ id: 'b', ask: 'Segunda', impact: 2 })]} onAnswer={onAnswer} />);

    await userEvent.click(screen.getByRole('button', { name: /não sei|don't know|no sé/i }));
    expect(screen.getByText('Segunda')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /não sei|don't know|no sé/i }));
    // Both resolved: the panel is finished, not back at "Primeira".
    expect(screen.queryByText('Primeira')).not.toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('sends a skipped question to the back of the queue', async () => {
    render(<AiFillPanel questions={[q({ id: 'a', ask: 'Primeira' }), q({ id: 'b', ask: 'Segunda', impact: 2 })]} onAnswer={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /pular|skip|saltar/i }));
    expect(screen.getByText('Segunda')).toBeInTheDocument();

    // "Skip" is "not now", unlike "I don't know", which is "never".
    await userEvent.click(screen.getByRole('button', { name: /pular|skip|saltar/i }));
    expect(screen.getByText('Primeira')).toBeInTheDocument();
  });

  it('reports progress as the number of questions answered so far, not a queue position', async () => {
    render(<AiFillPanel questions={[q({ id: 'a' }), q({ id: 'b', impact: 2 })]} onAnswer={vi.fn()} />);
    expect(screen.getByText('0 of 2 answered')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /não sei|don't know|no sé/i }));

    expect(screen.getByText('1 of 2 answered')).toBeInTheDocument();
  });

  it('calls onDone when the last question is resolved', async () => {
    const onDone = vi.fn();
    render(<AiFillPanel questions={[q({})]} onAnswer={vi.fn()} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /não sei|don't know|no sé/i }));
    expect(onDone).toHaveBeenCalled();
  });

  it('renders nothing when there are no questions', () => {
    const { container } = render(<AiFillPanel questions={[]} onAnswer={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
