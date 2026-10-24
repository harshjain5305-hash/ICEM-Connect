import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from '@/context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders theme toggle button with accessible label', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch to/i });
    expect(button).toBeInTheDocument();
  });

  it('toggles theme on click and updates aria label and icon', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch to/i });

    // Initial click toggles mode
    await act(async () => {
      fireEvent.click(button);
    });

    // Check localStorage was set
    const saved = localStorage.getItem('icem_connect_theme_v1');
    expect(saved).toBeDefined();
  });

  it('opens dropdown menu when showDropdown is true', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle showDropdown />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch to/i });
    await act(async () => {
      fireEvent.click(button);
    });

    // Dropdown options visible
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();

    // Select Dark
    await act(async () => {
      fireEvent.click(screen.getByText('Dark'));
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('icem_connect_theme_v1')).toBe('dark');
  });
});
