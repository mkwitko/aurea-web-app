import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(
      <Field htmlFor="mission" label="Missão">
        <input id="mission" />
      </Field>,
    );
    expect(screen.getByLabelText('Missão')).toBe(screen.getByRole('textbox'));
  });

  it('renders the error message when present', () => {
    render(
      <Field htmlFor="mission" label="Missão" error="Campo obrigatório">
        <input id="mission" />
      </Field>,
    );
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });

  it('does not render an error region when there is no error', () => {
    render(
      <Field htmlFor="mission" label="Missão">
        <input id="mission" />
      </Field>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks the field as optional when asked', () => {
    render(
      <Field htmlFor="mission" label="Missão" optional optionalLabel="opcional">
        <input id="mission" />
      </Field>,
    );
    expect(screen.getByText('opcional')).toBeInTheDocument();
  });

  it('links the error to the control via aria-describedby', () => {
    render(
      <Field htmlFor="mission" label="Missão" error="Campo obrigatório">
        <input id="mission" aria-describedby="mission-error" />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'mission-error');
  });
});
