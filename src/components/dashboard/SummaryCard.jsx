export default function SummaryCard({
  title,
  value,
  subtitle,
  color,
  icon,
}) {
  return (
    <div
      className={`${color} rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 lg:p-6 text-white shadow-md hover:shadow-xl transition-all duration-300 min-w-0`}
    >
      <div className="flex justify-between items-start gap-2">

        <div className="flex-1 min-w-0">

          <p className="text-xs sm:text-sm opacity-90 font-medium truncate">
            {title}
          </p>

          <h2 className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold mt-1.5 sm:mt-3 truncate leading-tight">
            {value}
          </h2>

          {subtitle && (
            <p className="text-[11px] sm:text-xs lg:text-sm mt-1.5 sm:mt-3 opacity-80 truncate">
              {subtitle}
            </p>
          )}

        </div>

        <div className="w-8 h-8 xs:w-10 xs:h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-sm xs:text-base sm:text-2xl lg:text-3xl shadow-sm shrink-0">
          {icon}
        </div>

      </div>
    </div>
  );
}