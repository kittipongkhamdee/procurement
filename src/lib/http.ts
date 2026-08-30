/**
 * Content-Disposition header values must be a ByteString (Latin-1) — any Thai character
 * throws "Cannot convert argument to a ByteString" at the Headers layer. Encode the real
 * (Thai) filename per RFC 5987 filename*, with an ASCII-only filename= fallback for
 * clients that don't support it.
 */
export function contentDisposition(disposition: "inline" | "attachment", filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
