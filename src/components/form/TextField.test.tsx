import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from './TextField';
import { TextAreaField } from './TextAreaField';

describe('TextField', () => {
  it('stays controlled when the value becomes undefined', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <TextField htmlFor="hq" label="Sede" value="São Paulo" onChange={() => {}} />,
    );
    rerender(<TextField htmlFor="hq" label="Sede" value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('Sede')).toHaveValue('');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('calls onChange with the text, not the event', async () => {
    const onChange = vi.fn();
    render(<TextField htmlFor="hq" label="Sede" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Sede'), 'S');
    expect(onChange).toHaveBeenCalledWith('S');
  });

  it('shows the error from Field and links the control to it', () => {
    render(
      <TextField htmlFor="hq" label="Sede" value="" onChange={() => {}} error="Obrigatório" />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Obrigatório');
    const input = screen.getByLabelText('Sede');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('forwards the input type', () => {
    render(
      <TextField htmlFor="start" label="Início" type="date" value="" onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Início')).toHaveAttribute('type', 'date');
  });
});

describe('TextAreaField', () => {
  it('renders a textarea with the given rows', () => {
    render(
      <TextAreaField htmlFor="mission" label="Missão" value="oi" onChange={() => {}} rows={4} />,
    );
    const el = screen.getByLabelText('Missão');
    expect(el.tagName).toBe('TEXTAREA');
    expect(el).toHaveAttribute('rows', '4');
    expect(el).toHaveValue('oi');
  });

  it('calls onChange with the text', async () => {
    const onChange = vi.fn();
    render(<TextAreaField htmlFor="mission" label="Missão" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Missão'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('stays controlled when the value becomes undefined', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <TextAreaField htmlFor="mission" label="Missão" value="Uma missão" onChange={() => {}} />,
    );
    rerender(<TextAreaField htmlFor="mission" label="Missão" value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('Missão')).toHaveValue('');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
