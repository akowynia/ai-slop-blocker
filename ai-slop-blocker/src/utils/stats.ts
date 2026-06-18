import { getStats } from './storage';

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    tension: number;
  }[];
}

export async function getChartData(days: number): Promise<ChartData> {
  const stats = await getStats();
  const labels: string[] = [];
  const data: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Format etykiety osi X (np. DD-MM)
    const labelStr = `${day}-${month}`;

    labels.push(labelStr);
    data.push(stats[dateStr] || 0);
  }

  return {
    labels,
    datasets: [
      {
        label: 'Zablokowane posty',
        data,
        backgroundColor: 'rgba(239, 68, 68, 0.2)', // Czerwony lekko przeźroczysty
        borderColor: 'rgba(239, 68, 68, 1)', // Tailwind red-500
        borderWidth: 2,
        tension: 0.4
      }
    ]
  };
}
