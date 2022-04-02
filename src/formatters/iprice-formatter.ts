/** Interface to be implemented by the object in order to be used as a price formatter */
export interface IPriceFormatter {
	/**
	 * Formatting function
	 * 限定IPriceFormatter的介面必須實作format函數
	 *
	 * @param price - Original price to be formatted
	 * @returns Formatted price
	 */
	format(price: number): string;
}
