// Edit these lists to add products, client types or pricing models.
export const SAAS_LIST = ["ParkingPlus", "SMMS", "MicroFix"];
export const CLIENT_TYPES = ["Company", "Individual", "Organization"];
export const PRICING_MODELS = ["Monthly", "Yearly", "3 Years"];

// License key types. The code is the first character of every key:
//   M = 1 month, 3 = 3 months, Y = 1 year.
// (An array, not an object, so the display order stays M, 3, Y.)
export const LICENSE_TYPES = [
  { code: "M", label: "1 Month", months: 1 },
  { code: "3", label: "3 Months", months: 3 },
  { code: "Y", label: "1 Year", months: 12 },
];

export function getLicenseType(code) {
  return LICENSE_TYPES.find((t) => t.code === code);
}
