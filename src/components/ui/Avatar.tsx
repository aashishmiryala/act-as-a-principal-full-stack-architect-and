import { cn, initials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, color = "#22d3ee", size = 36, className }: AvatarProps) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold text-ink-950", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
        boxShadow: `0 0 0 1px ${color}33`,
      }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
