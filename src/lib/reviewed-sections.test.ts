import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markReviewed, reviewedSections } from './reviewed-sections';

beforeEach(() => {
  localStorage.clear();
});

describe('reviewed-sections', () => {
  it('lembra as seções revisadas deste run', () => {
    markReviewed('run-1', 'performance');
    markReviewed('run-1', 'constraints');

    expect(reviewedSections('run-1')).toEqual(['performance', 'constraints']);
  });

  it('não vaza a revisão de um run para outro — proposta nova, revisão nova', () => {
    markReviewed('run-1', 'performance');

    expect(reviewedSections('run-2')).toEqual([]);
  });

  it('substitui o run anterior em vez de acumular runs para sempre', () => {
    markReviewed('run-1', 'performance');
    markReviewed('run-2', 'market');

    expect(reviewedSections('run-1')).toEqual([]);
    expect(reviewedSections('run-2')).toEqual(['market']);
  });

  it('não duplica a mesma seção', () => {
    markReviewed('run-1', 'market');
    markReviewed('run-1', 'market');

    expect(reviewedSections('run-1')).toEqual(['market']);
  });

  it('devolve vazio sem run', () => {
    expect(reviewedSections(null)).toEqual([]);
  });

  it('sobrevive a storage corrompido', () => {
    localStorage.setItem('aurea.fillRun.reviewed', '{not json');

    expect(reviewedSections('run-1')).toEqual([]);
  });

  it('sobrevive a storage indisponível — a marca é conveniência, não pode derrubar a tela', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => markReviewed('run-1', 'market')).not.toThrow();

    setItem.mockRestore();
  });
});
