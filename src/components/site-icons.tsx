"use client";

// ============================================================================
// Uploaded site icons — phone / location / comment / message
//   · user දුන්නු PNG images (public/icons) කුඩා කරලා පාවිච්චි කරයි
//   · image එක mask එකක් විදිහට ගන්නා නිසා icon එකේ පාට තියෙන තැනේ
//     text colour එකටම හැරෙයි (අඳුරු තැන්වල සුදු, ලා තැන්වල පාට ඇතිව)
//   · Lucide icon එකක් වගේම size + className දීලා පාවිච්චි කළ හැක
// ============================================================================

import { forwardRef, type CSSProperties } from "react";

export type SiteIconProps = {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Lucide props ගැලපෙන්න තියා ඇත (image icon එකට stroke නෑ) */
  strokeWidth?: number | string;
  color?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

function createSiteIcon(src: string, kind: "phone" | "location" | "comment" | "message", displayName: string) {
  const Icon = forwardRef<HTMLSpanElement, SiteIconProps>(function SiteImageIcon(
    { size = 24, className = "", style, color, "aria-hidden": ariaHidden },
    ref
  ) {
    return (
      <span
        ref={ref}
        aria-hidden={ariaHidden ?? true}
        data-site-icon={kind}
        className={`site-img-icon site-img-icon-${kind} ${className}`}
        style={{
          width: size,
          height: size,
          color,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          ...style,
        }}
      />
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

export const PhoneImageIcon = createSiteIcon("/icons/phone-call.png", "phone", "PhoneImageIcon");
export const LocationImageIcon = createSiteIcon("/icons/location.png", "location", "LocationImageIcon");
export const CommentImageIcon = createSiteIcon("/icons/comment.png", "comment", "CommentImageIcon");
export const MessageImageIcon = createSiteIcon("/icons/message.png", "message", "MessageImageIcon");
