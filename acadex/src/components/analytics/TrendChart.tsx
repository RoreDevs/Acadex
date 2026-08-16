import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { TrendPoint } from '@/types';

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  color?: string;
}

export function TrendChart({ data, height = 280, color = '#1e3a5f' }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500 dark:text-gray-400 text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" unit="%" />
          <Tooltip formatter={(value: any) => [`${value}%`, 'Rate']} />
          <Line type="monotone" dataKey="rate" stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
