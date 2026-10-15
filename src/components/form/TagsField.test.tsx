import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagsField } from './TagsField';

function setup(value: string[] = []) {
  const onChange = vi.fn();
  render(
    <TagsField
      htmlFor="values"
      label="Valores"
      value={value}
      onChange={onChange}
      addLabel="Adicionar"
      removeLabel={(t) => `Remover ${t}`}
    />,
  );
  return { onChange, input: screen.getByLabelText('Valores') };
}

describe('TagsField', () => {
  it('renders existing tags', () => {
    setup(['Transparência', 'Foco']);
    expect(screen.getByText('Transparência')).toBeInTheDocument();
    expect(screen.getByText('Foco')).toBeInTheDocument();
  });

  it('adds a tag on Enter and clears the draft', async () => {
    const { onChange, input } = setup([]);
    await userEvent.type(input, 'Transparência{Enter}');
    expect(onChange).toHaveBeenCalledWith(['Transparência']);
    expect(input).toHaveValue('');
  });

  it('adds a tag via the add button', async () => {
    const { onChange, input } = setup(['Foco']);
    await userEvent.type(input, 'Rigor');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onChange).toHaveBeenCalledWith(['Foco', 'Rigor']);
  });

  it('trims whitespace and ignores an empty draft', async () => {
    const { onChange, input } = setup([]);
    await userEvent.type(input, '   {Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.type(input, '  Foco  {Enter}');
    expect(onChange).toHaveBeenCalledWith(['Foco']);
  });

  it('ignores a duplicate tag', async () => {
    const { onChange, input } = setup(['Foco']);
    await userEvent.type(input, 'Foco{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes the clicked tag, not the first one', async () => {
    const { onChange } = setup(['a', 'b', 'c']);
    await userEvent.click(screen.getByRole('button', { name: 'Remover b' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('does not submit the surrounding form when Enter is pressed', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TagsField
          htmlFor="tags"
          label="Tags"
          value={[]}
          onChange={() => {}}
          addLabel="Adicionar"
          removeLabel={(t) => `Remover ${t}`}
        />
      </form>,
    );
    await userEvent.type(screen.getByLabelText('Tags'), 'x{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats an undefined value as an empty list', async () => {
    const onChange = vi.fn();
    render(
      <TagsField
        htmlFor="tags"
        label="Tags"
        value={undefined}
        onChange={onChange}
        addLabel="Adicionar"
        removeLabel={(t) => `Remover ${t}`}
      />,
    );
    await userEvent.type(screen.getByLabelText('Tags'), 'x{Enter}');
    expect(onChange).toHaveBeenCalledWith(['x']);
  });
});
