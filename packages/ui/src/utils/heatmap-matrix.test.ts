import { describe, it, expect } from 'vitest';
import { generateHeatmapMatrix, ActivityData } from './heatmap-matrix';

describe('heatmap-matrix', () => {
  it('should generate 7 rows representing days of the week', () => {
    const matrix = generateHeatmapMatrix([], 2024);
    expect(matrix.length).toBe(7);
  });

  it('should map counts to the correct dates in the matrix', () => {
    const data: ActivityData[] = [
      { date: '2024-01-01', count: 5 }, // 2024-01-01 is Monday
      { date: '2024-12-31', count: 10 } // 2024-12-31 is Tuesday
    ];
    
    const matrix = generateHeatmapMatrix(data, 2024);
    
    // Find Jan 1st in row 1 (Monday)
    const jan1st = matrix[1].find(cell => 
      cell.date.getFullYear() === 2024 &&
      cell.date.getMonth() === 0 &&
      cell.date.getDate() === 1
    );
    expect(jan1st).toBeDefined();
    expect(jan1st?.count).toBe(5);

    // Find Dec 31st in row 2 (Tuesday)
    const dec31st = matrix[2].find(cell => 
      cell.date.getFullYear() === 2024 &&
      cell.date.getMonth() === 11 &&
      cell.date.getDate() === 31
    );
    expect(dec31st).toBeDefined();
    expect(dec31st?.count).toBe(10);
  });

  it('should pad the calendar to always start on Sunday and end on Saturday', () => {
    // 2024 starts on Monday. So Dec 31, 2023 (Sunday) should be the first cell
    const matrix = generateHeatmapMatrix([], 2024);
    const firstCell = matrix[0][0]; // Sunday row, first week
    expect(firstCell.date.getFullYear()).toBe(2023);
    expect(firstCell.date.getMonth()).toBe(11); // December
    expect(firstCell.date.getDate()).toBe(31);
    
    // 2024 ends on Tuesday. So the matrix should pad until Saturday Jan 4, 2025
    const row0Length = matrix[0].length;
    const lastSaturday = matrix[6][row0Length - 1];
    expect(lastSaturday.date.getFullYear()).toBe(2025);
    expect(lastSaturday.date.getMonth()).toBe(0); // January
    expect(lastSaturday.date.getDate()).toBe(4);
  });
});
