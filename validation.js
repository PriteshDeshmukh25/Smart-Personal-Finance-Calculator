export const MAX_AMOUNT = 10000000; // ₹1,00,00,000
export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Net banking', 'Other'];

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1900) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Returns { errors: {field: message}, value } — value is only meaningful when errors is empty. */
export function validateExpense(raw, categoryIds, today) {
  const errors = {};
  const title = String(raw.title ?? '').trim();
  if (!title) errors.title = 'Enter an expense title.';
  else if (title.length > 100) errors.title = 'Title must be 100 characters or fewer.';

  const amtStr = String(raw.amount ?? '').trim();
  const amount = Number(amtStr);
  if (!amtStr) errors.amount = 'Enter an amount.';
  else if (!Number.isFinite(amount)) errors.amount = 'Amount must be a valid number.';
  else if (amount <= 0) errors.amount = 'Amount must be greater than zero.';
  else if (amount > MAX_AMOUNT) errors.amount = 'Amount cannot exceed ₹1,00,00,000.';
  else if (!/^\d+(\.\d{1,2})?$/.test(amtStr)) errors.amount = 'Use digits only, with at most two decimal places.';

  if (!categoryIds.includes(raw.category)) errors.category = 'Select a category from the list.';

  const date = String(raw.date ?? '');
  if (!date) errors.date = 'Choose a date.';
  else if (!isValidISODate(date)) errors.date = 'Enter a valid date.';
  else if (date > today) errors.date = 'The date cannot be in the future.';

  const payment = String(raw.payment ?? '');
  if (payment && !PAYMENT_METHODS.includes(payment)) errors.payment = 'Choose a payment method from the list.';

  const notes = String(raw.notes ?? '').trim();
  if (notes.length > 300) errors.notes = 'Notes must be 300 characters or fewer.';

  return {
    errors,
    value: { title, amount: Math.round(amount * 100) / 100, category: raw.category, date, paymentMethod: payment, notes }
  };
}
