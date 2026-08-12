// Persian (and Arabic, which Persian text commonly borrows punctuation/digits
// from) Unicode blocks: Arabic (U+0600-06FF) and Arabic Supplement
// (U+0750-077F). Used to auto-switch text boxes to RTL + Vazirmatn the moment
// the user types Persian script, without needing a language picker.
const PERSIAN_ARABIC_RANGE = /[؀-ۿݐ-ݿ]/;

export function containsPersian(text: string): boolean {
  return PERSIAN_ARABIC_RANGE.test(text);
}

/** Direction + Vazirmatn class for display text that may include Persian. */
export function persianTextProps(text: string): {
  dir?: 'rtl';
  className?: string;
} {
  if (!containsPersian(text)) return {};
  return { dir: 'rtl', className: 'font-vazirmatn' };
}
