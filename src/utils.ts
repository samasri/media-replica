const printDate = (date: Date) =>
  `${date.toLocaleDateString("en-uk")}-${date.toLocaleTimeString("en-us")}`;

export const now = () => printDate(new Date());
