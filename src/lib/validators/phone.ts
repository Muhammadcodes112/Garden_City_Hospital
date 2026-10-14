// Nigerian mobile numbers are exactly 11 digits (e.g. 08012345678).
export const NIGERIAN_PHONE_REGEX = /^\d{11}$/;
export const NIGERIAN_PHONE_MESSAGE = "Phone number must be exactly 11 digits";

export function isValidNigerianPhone(value: string): boolean {
  return NIGERIAN_PHONE_REGEX.test(value);
}
