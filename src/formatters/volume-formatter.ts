import { IPriceFormatter } from './iprice-formatter';

export class VolumeFormatter implements IPriceFormatter {
	/**
	 * 成交量格式化
	 */
	private readonly _precision: number;

	public constructor(precision: number) {
		this._precision = precision;
	}

	public format(vol: number): string {
		/**
		 * 在PriceFormatter中的format函數，負號使用\u2212, 為何此處不使用?
		 */
		let sign = '';
		if (vol < 0) {
			sign = '-';
			vol = -vol;
		}

		if (vol < 995) {
			return sign + this._formatNumber(vol);
		} else if (vol < 999995) {
			return sign + this._formatNumber(vol / 1000) + 'K';
		} else if (vol < 999999995) {
			vol = 1000 * Math.round(vol / 1000);
			return sign + this._formatNumber(vol / 1000000) + 'M';
		} else {
			vol = 1000000 * Math.round(vol / 1000000);
			return sign + this._formatNumber(vol / 1000000000) + 'B';
		}
	}

	private _formatNumber(value: number): string {
		/**
		 * 格式化成交量時，要考慮到priceScale的設定值
		 */
		let res: string;
		const priceScale = Math.pow(10, this._precision);
		value = Math.round(value * priceScale) / priceScale;
		if (value >= 1e-15 && value < 1) {
			res = value.toFixed(this._precision).replace(/\.?0+$/, ''); // regex removes trailing zeroes
		} else {
			res = String(value);
		}
		return res.replace(/(\.[1-9]*)0+$/, (e: string, p1: string): string => p1);
	}
}
