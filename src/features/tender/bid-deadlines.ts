/** Days left until the closing date; negative once it has passed. */
export const daysToDeadline = (deadline: string) =>
  Math.round(
    (new Date(`${deadline}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
