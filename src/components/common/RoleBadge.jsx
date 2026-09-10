const badgeConfig = {
  admin: {
    label: "Admin",
    emoji: "👨‍💼",
    classes: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  collector: {
    label: "Collector",
    emoji: "🗑️",
    classes: "bg-teal-100 text-teal-700",
    dot: "bg-teal-500",
  },
  resident: {
    label: "Resident",
    emoji: "🏠",
    classes: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  family: {
    label: "Family Member",
    emoji: "👨‍👩‍👧",
    classes: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
  },
  committee: {
    label: "Committee",
    emoji: "🏛️",
    classes: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
  },
};

const designationConfig = {
  President: { classes: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-600" },
  "Vice President": { classes: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  Secretary: { classes: "bg-purple-100 text-purple-700", dot: "bg-purple-600" },
  "Joint Secretary": { classes: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  Treasurer: { classes: "bg-violet-100 text-violet-700", dot: "bg-violet-600" },
  "Executive Member": { classes: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
};

/**
 * RoleBadge — Displays a professional badge for user roles and committee designations.
 *
 * Props:
 *   role       — "admin" | "collector" | "resident" | "family" | "committee"
 *   designation — "President" | "Secretary" | etc. (optional, for committee members)
 *   size       — "sm" | "md" | "lg" (default: "md")
 *   showDot    — boolean (default: false) — shows a colored dot instead of emoji
 *   className  — additional CSS classes
 */
export default function RoleBadge({
  role,
  designation,
  size = "md",
  showDot = false,
  className = "",
}) {
  // If committee member with designation, show designation badge
  if (role === "committee" && designation && designationConfig[designation]) {
    const config = designationConfig[designation];
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${config.classes} ${sizeClasses[size]} ${className}`}
      >
        {showDot ? (
          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        ) : (
          <span>🏛️</span>
        )}
        {designation}
      </span>
    );
  }

  // Regular role badge
  const config = badgeConfig[role] || badgeConfig.resident;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${config.classes} ${sizeClasses[size]} ${className}`}
    >
      {showDot ? (
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      ) : (
        <span>{config.emoji}</span>
      )}
      {designation || config.label}
    </span>
  );
}

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};
