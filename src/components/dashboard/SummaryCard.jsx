export default function SummaryCard({
  title,
  value,
  subtitle,
  color,
  icon,
}) {
  return (
    <div
      className={`${color} rounded-3xl p-6 text-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300`}
    >
      <div className="flex justify-between items-start">

        <div className="flex-1">

          <p className="text-sm opacity-90 font-medium">
            {title}
          </p>

          <h2 className="text-4xl font-bold mt-3">
            {value}
          </h2>

          {subtitle && (
            <p className="text-sm mt-3 opacity-80">
              {subtitle}
            </p>
          )}

        </div>

        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-md">
          {icon}
        </div>

      </div>
    </div>
  );
}