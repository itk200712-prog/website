"use client";

// ============================================================================
//  Box icons — solid / filled "box" style (bxs-* වගේ) — inline SVG
//  (CDN එකක් ඕන නෑ · offline/preview එකේත් වැඩ · currentColor වලින් theme වෙයි)
// ============================================================================

export type BoxIconName = "phone" | "map" | "envelope" | "clock" | "send";

export function BoxIcon({
  name,
  size = 20,
  className = "",
}: {
  name: BoxIconName;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className,
    "aria-hidden": true as const,
    focusable: "false" as const,
  };

  switch (name) {
    // ☎ solid handset
    case "phone":
      return (
        <svg {...common}>
          <path d="M6.62 2.4 4.2 3.62a2.1 2.1 0 0 0-1.14 2.01c.52 8.72 7.79 15.99 16.51 16.51a2.1 2.1 0 0 0 2.01-1.14l1.22-2.42a2.1 2.1 0 0 0-.94-2.83l-3.16-1.53a2.1 2.1 0 0 0-2.31.42l-1.2 1.14a12.55 12.55 0 0 1-5.03-5.03l1.14-1.2a2.1 2.1 0 0 0 .42-2.31L9.45 3.34a2.1 2.1 0 0 0-2.83-.94Z" />
        </svg>
      );

    // 📍 solid map pin
    case "map":
      return (
        <svg {...common}>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 1.8a7.3 7.3 0 0 0-7.3 7.3c0 5.3 7.3 13.1 7.3 13.1s7.3-7.8 7.3-13.1A7.3 7.3 0 0 0 12 1.8Zm0 9.9a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z"
          />
        </svg>
      );

    // ✉ solid envelope — flap එක cut-out (evenodd) නිසා tile එකේ පාටින් පේනවා
    case "envelope":
      return (
        <svg {...common}>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3.4 4.2h17.2a2.2 2.2 0 0 1 2.2 2.2v11.2a2.2 2.2 0 0 1-2.2 2.2H3.4a2.2 2.2 0 0 1-2.2-2.2V6.4a2.2 2.2 0 0 1 2.2-2.2Zm.5 3.1v10h16.2v-10l-7.5 5a1.6 1.6 0 0 1-1.2 0l-7.5-5Z"
          />
        </svg>
      );

    // 🕐 solid clock — දෙකට තියෙන කටු cut-out (evenodd)
    case "clock":
      return (
        <svg {...common}>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2.1a9.9 9.9 0 1 0 0 19.8 9.9 9.9 0 0 0 0-19.8Zm-1 4.7h2v5.4l3.8 2.2-1 1.7-4.8-2.8V6.8Z"
          />
        </svg>
      );

    // ➤ solid paper plane
    case "send":
      return (
        <svg {...common}>
          <path d="M21.6 2.6a1.1 1.1 0 0 0-1.2-.2L2.9 9.8a1.1 1.1 0 0 0 .04 2.05l6.2 2.2a1 1 0 0 0 1.02-.24l4.4-4.2-3.5 4.9a1 1 0 0 0-.15.9l2.1 6.1a1.1 1.1 0 0 0 2.06-.02l6.8-18.1a1.1 1.1 0 0 0-.27-1.2Z" />
        </svg>
      );
  }
}
