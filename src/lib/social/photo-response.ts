/** Existing recipe photos are normalized, EXIF-stripped WebP stored as plain base64. */
export function photoResponse(data: string | null) {
  if (!data || data.length > 350000 || !/^[-A-Za-z0-9+/=]+$/.test(data))
    return missing();
  const bytes = Buffer.from(data, "base64");
  if (
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  )
    return missing();
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
function missing() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
