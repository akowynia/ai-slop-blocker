import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { ChartData } from '../utils/stats';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StatsChartProps {
  data: ChartData;
}

export default function StatsChart({ data }: StatsChartProps) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a', // slate-900
        titleColor: '#94a3b8', // slate-400
        bodyColor: '#f87171', // red-400
        borderColor: '#1e293b', // slate-800
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            return `Data: ${context[0].label}`;
          },
          label: (context: any) => {
            return `Blokad: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b', // slate-500
          font: {
            size: 9,
            family: 'Outfit, sans-serif',
          },
        },
      },
      y: {
        grid: {
          color: '#1e293b', // slate-800
        },
        ticks: {
          color: '#64748b', // slate-500
          font: {
            size: 9,
            family: 'Outfit, sans-serif',
          },
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="w-full h-[120px]">
      <Bar data={data} options={options} />
    </div>
  );
}
