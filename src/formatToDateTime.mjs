/*
 *
 * Helper: `formatToDateTime`.
 *
 */
const formatToDateTime = (validDate) => {
  const now = new Date(validDate);

  const formatted = now.toLocaleString("en-SA", {
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  });

  // Add milliseconds (zero-padded to 3 digits)
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  return `${formatted}.${ms}`;
};

export default formatToDateTime;
