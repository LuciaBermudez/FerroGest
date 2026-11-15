import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import Paginacion from './Paginacion';

describe('Paginacion', () => {
  test('deshabilita los extremos y navega con los botones', () => {
    const onCambiar = vi.fn();
    render(<Paginacion pagina={1} totalPaginas={3} onCambiar={onCambiar} />);

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onCambiar).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onCambiar).toHaveBeenCalledWith(2);
  });

  test('resume los rangos largos con puntos suspensivos', () => {
    render(<Paginacion pagina={120} totalPaginas={238} onCambiar={() => {}} />);

    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '238' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '120' })).toHaveAttribute('aria-current', 'page');
  });

  test('con una sola página ambos botones quedan deshabilitados', () => {
    render(<Paginacion pagina={1} totalPaginas={1} onCambiar={() => {}} />);

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });
});
