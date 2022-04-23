import { formatDate } from './format-date';

export class DateFormatter {
	private readonly _locale: string;
	private readonly _dateFormat: string;

	public constructor(dateFormat: string = 'yyyy-MM-dd', locale: string = 'default') {
		/**
		 * 日期的格式化，可選本地化,
		 * 只有日期不含時間
		 */
		this._dateFormat = dateFormat;
		this._locale = locale;
	}

	public format(date: Date): string {
		// 將日期格式化為yyyy-MM-dd的格式
		return formatDate(date, this._dateFormat, this._locale);
	}
}
