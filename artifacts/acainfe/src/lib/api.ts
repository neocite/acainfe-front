export { apiRequest as api, ApiError } from './queryClient';
export const phoneMask = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  const rest = digits.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? '-' + rest.slice(split) : ''}`;
};
