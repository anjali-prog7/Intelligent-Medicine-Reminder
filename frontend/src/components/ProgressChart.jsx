import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import "../styles/Chart.css";

const data = [
  { day: "Mon", score: 70 },
  { day: "Tue", score: 78 },
  { day: "Wed", score: 85 },
  { day: "Thu", score: 82 },
  { day: "Fri", score: 90 },
  { day: "Sat", score: 94 },
  { day: "Sun", score: 96 },
];

function ProgressChart() {
  return (
    <div className="chartCard">

      <h2>Adherence Progress</h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="day" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#00897B"
            strokeWidth={4}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}

export default ProgressChart;