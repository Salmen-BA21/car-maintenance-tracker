// `today()` reads the device clock, never the sync clock (D-56). Tests that
// depend on the current date must inject an explicit LocalDate instead of
// calling this.
import { jsDateToLocalDate, type LocalDate } from './local-date';

export function today(): LocalDate {
  return jsDateToLocalDate(new Date());
}
