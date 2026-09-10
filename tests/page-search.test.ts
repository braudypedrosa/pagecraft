import { expect, test } from 'vitest';
import { matchesPageSearch } from '../app/src/ui/Pages';
test('page search matches displayed paths, names and normalized slashes', () => {
  const contact = {name:'Plan your stay',slug:'contact'};
  for (const query of ['contact','/contact',' CONTACT/ ',' /contact/ ','your stay','/cont']) expect(matchesPageSearch(contact,query,false)).toBe(true);
  for (const query of ['/', '  /// ', 'missing']) expect(matchesPageSearch(contact,query,false)).toBe(false);
  expect(matchesPageSearch({name:'Home',slug:'index'},' / ',true)).toBe(true);
  expect(matchesPageSearch(contact,'   ',false)).toBe(true);
});
