/*
 *
 * helper: `extractExtensionFromContentDisposition`.
 *
 */
const extractExtensionFromContentDisposition = (contentDisposition) => {
  // Try UTF-8 filename*= first
  const utf8Match = contentDisposition.match(
    /filename\*\=UTF-8''[^.]+\.(\w+)/i
  );
  if (utf8Match) return utf8Match[1].toLowerCase();

  // Fallback to basic filename
  const fallbackMatch = contentDisposition.match(/filename="?[^.]+\.(\w+)"?/i);
  if (fallbackMatch) return fallbackMatch[1].toLowerCase();

  return "pdf"; // Default fallback
};

export default extractExtensionFromContentDisposition;
