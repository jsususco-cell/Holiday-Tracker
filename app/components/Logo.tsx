/**
 * Byrdson Services logo — inline SVG recreation (red 3D block + wordmark).
 * No external asset needed. To use the exact raster instead, drop the file at
 * public/logo.png and replace the <svg> with <img src="/logo.png" />.
 */
export function Logo({
  height = 40,
  variant = "dark",
}: {
  height?: number;
  variant?: "dark" | "light";
}) {
  const wordColor = variant === "light" ? "#FFFFFF" : "#13284B";
  const subColor = variant === "light" ? "#C7D2E2" : "#1B1B1B";
  // viewBox 0 0 520 150 → keep aspect ratio
  const width = (height * 520) / 150;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 520 150"
      role="img"
      aria-label="Byrdson Services"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* shadow */}
      <polygon points="34,108 150,90 168,104 52,122" fill="#D7DBE1" />
      {/* left (dark red) face */}
      <polygon points="30,40 46,70 46,96 30,66" fill="#A52218" />
      {/* navy front face */}
      <polygon points="46,70 150,52 168,78 64,96" fill="#13284B" />
      {/* red top face */}
      <polygon points="30,40 142,22 168,50 56,68" fill="#E5362B" />
      {/* wordmark */}
      <text
        x="196"
        y="78"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="74"
        letterSpacing="2"
        fill={wordColor}
      >
        BYRDSON
      </text>
      <text
        x="198"
        y="120"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="600"
        fontSize="34"
        letterSpacing="14"
        fill={subColor}
      >
        SERVICES
      </text>
    </svg>
  );
}
