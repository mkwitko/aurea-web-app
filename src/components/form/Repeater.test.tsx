import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Repeater } from './Repeater';

interface Row {
  name: string;
}

function Harness({ initial = [] as Row[] }: { initial?: Row[] }) {
  const [items, setItems] = useState<Row[]>(initial);
  return (
    <Repeater<Row>
      items={items}
      onChange={setItems}
      newItem={() => ({ name: '' })}
      itemLabel={(i) => `Item ${i + 1}`}
      addLabel="Adicionar"
      removeLabel="Remover"
      emptyLabel="Nada aqui"
      renderItem={(item, update, index) => (
        <input
          aria-label={`nome ${index}`}
          value={item.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      )}
    />
  );
}

describe('Repeater', () => {
  it('shows the empty label when there are no items', () => {
    render(<Harness />);
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
  });

  it('appends an item built by newItem', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByLabelText('nome 0')).toHaveValue('');
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('patches only the edited item', async () => {
    render(<Harness initial={[{ name: 'a' }, { name: 'b' }]} />);
    await userEvent.type(screen.getByLabelText('nome 0'), 'x');
    expect(screen.getByLabelText('nome 0')).toHaveValue('ax');
    expect(screen.getByLabelText('nome 1')).toHaveValue('b');
  });

  it('removes the clicked row, not the first one', async () => {
    render(<Harness initial={[{ name: 'a' }, { name: 'b' }, { name: 'c' }]} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remover' })[1]!);
    expect(screen.getByLabelText('nome 0')).toHaveValue('a');
    expect(screen.getByLabelText('nome 1')).toHaveValue('c');
    expect(screen.queryByLabelText('nome 2')).not.toBeInTheDocument();
  });

  it('keeps stable keys so removing a row does not remount the others', async () => {
    render(<Harness initial={[{ name: 'a' }, { name: 'b' }]} />);
    const first = screen.getByLabelText('nome 0');
    await userEvent.click(screen.getAllByRole('button', { name: 'Remover' })[1]!);
    // Mesmo nó de DOM: a linha sobrevivente não foi remontada.
    expect(screen.getByLabelText('nome 0')).toBe(first);
  });

  it('keeps surviving rows stable when items are replaced from outside (grow then shrink)', async () => {
    function ExternalHarness() {
      const [items, setItems] = useState<Row[]>([{ name: 'a' }, { name: 'b' }]);
      return (
        <div>
          <button
            type="button"
            onClick={() => setItems([{ name: 'a' }, { name: 'b' }, { name: 'c' }])}
          >
            Grow
          </button>
          <button type="button" onClick={() => setItems([{ name: 'a' }])}>
            Shrink
          </button>
          <Repeater<Row>
            items={items}
            onChange={setItems}
            newItem={() => ({ name: '' })}
            itemLabel={(i) => `Item ${i + 1}`}
            addLabel="Adicionar"
            removeLabel="Remover"
            emptyLabel="Nada aqui"
            renderItem={(item, update, index) => (
              <input
                aria-label={`nome ${index}`}
                value={item.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            )}
          />
        </div>
      );
    }

    render(<ExternalHarness />);
    const firstBeforeGrow = screen.getByLabelText('nome 0');

    await userEvent.click(screen.getByRole('button', { name: 'Grow' }));
    expect(screen.getByLabelText('nome 0')).toBe(firstBeforeGrow);
    expect(screen.getByLabelText('nome 2')).toHaveValue('c');

    await userEvent.click(screen.getByRole('button', { name: 'Shrink' }));
    expect(screen.getByLabelText('nome 0')).toBe(firstBeforeGrow);
    expect(screen.queryByLabelText('nome 1')).not.toBeInTheDocument();
  });

  it('treats an undefined items list as empty', () => {
    render(
      <Repeater<Row>
        items={undefined}
        onChange={() => {}}
        newItem={() => ({ name: '' })}
        itemLabel={(i) => `Item ${i + 1}`}
        addLabel="Adicionar"
        removeLabel="Remover"
        emptyLabel="Nada aqui"
        renderItem={() => null}
      />,
    );
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
  });
});
