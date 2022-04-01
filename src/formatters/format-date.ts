import { numberToStringWithLeadingZero as numToStr } from './price-formatter';

// 取得日期的月份(前面沒有補0)，日期(前面沒有補0)，年份(4位數)
const getMonth = (date: Date) => date.getUTCMonth() + 1;
const getDay = (date: Date) => date.getUTCDate();
const getYear = (date: Date) => date.getUTCFullYear();

// 日期，2位數字，前面補0
const dd = (date: Date) => numToStr(getDay(date), 2);
const MMMM = (date: Date, locale: string) => new Date(date.getUTCFullYear(), date.getUTCMonth(), 1)
	.toLocaleString(locale, { month: 'long' });
const MMM = (date: Date, locale: string) => new Date(date.getUTCFullYear(), date.getUTCMonth(), 1)
	.toLocaleString(locale, { month: 'short' });
// 月份，2位數字，前面補0
const MM = (date: Date) => numToStr(getMonth(date), 2);
const yy = (date: Date) => numToStr(getYear(date) % 100, 2);
const yyyy = (date: Date) => numToStr(getYear(date), 4);

export function formatDate(date: Date, format: string, locale: string): string {
	// 用於date-formatter日期正規化的方法
	return format
		.replace(/yyyy/g, yyyy(date))
		.replace(/yy/g, yy(date))
		.replace(/MMMM/g, MMMM(date, locale))
		.replace(/MMM/g, MMM(date, locale))
		.replace(/MM/g, MM(date))
		.replace(/dd/g, dd(date))
	;
}
