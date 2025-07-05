/*
 *
 * Helper: `getMimeType`.
 *
 */
const getMimeType = (extension) => {
  switch (extension.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
};

export default getMimeType;
