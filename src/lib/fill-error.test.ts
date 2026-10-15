import { describe, expect, it } from 'vitest';
import { fillErrorKind } from './fill-error';

describe('fillErrorKind', () => {
  // As mensagens exatas que o runner escreveu nos runs que falharam de verdade.
  it('classifica orçamento esgotado como resposta grande demais', () => {
    expect(fillErrorKind('tool iteration cap reached (3) without a final answer')).toBe('tooLong');
    expect(fillErrorKind('model call budget exhausted (8) without a final answer')).toBe('tooLong');
  });

  it('classifica interrupção por tempo', () => {
    expect(fillErrorKind('This operation was aborted')).toBe('timeout');
    expect(fillErrorKind('Request timed out')).toBe('timeout');
  });

  it('classifica falta de crédito', () => {
    expect(fillErrorKind('run not authorized: insufficient credits: needs 1, has 0')).toBe('credits');
  });

  it('classifica recusa do provider', () => {
    expect(fillErrorKind('The model refused the request')).toBe('refused');
    expect(fillErrorKind('provider call failed')).toBe('refused');
  });

  it('cai em generic para texto desconhecido e para erro ausente', () => {
    // A coluna é texto livre e não tem código: um erro novo tem que virar uma
    // mensagem honesta, nunca uma tela sem explicação.
    expect(fillErrorKind('something nobody predicted')).toBe('generic');
    expect(fillErrorKind(null)).toBe('generic');
    expect(fillErrorKind('')).toBe('generic');
  });
});
