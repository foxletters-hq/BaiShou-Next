export interface ActivityData {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface GridCell {
  date: Date;
  count: number;
}

export function generateHeatmapMatrix(data: ActivityData[], year: number): GridCell[][] {
  const datesMap = new Map<string, number>();
  data.forEach(d => datesMap.set(d.date, d.count));

  const matrix: GridCell[][] = Array.from({ length: 7 }, () => []);
  
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  const currentDate = new Date(startDate);
  // Rewind to Sunday
  currentDate.setDate(currentDate.getDate() - currentDate.getDay());
  
  while (currentDate <= endDate || currentDate.getDay() !== 0) {
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const count = datesMap.get(dateStr) || 0;
    matrix[currentDate.getDay()].push({
       date: new Date(currentDate),
       count
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return matrix;
}
