import { isNumber } from '../helpers/strict-type-checks';

import { PriceRange } from './series-options';

export class PriceRangeImpl {
	/**
	 *  price scale的最大與最小值
	 *  因為在price scale mode改變時會經常縮放，
	 *  所以獨立成class
	 */
	private _minValue: number;
	private _maxValue!: number;

	public constructor(minValue: number, maxValue: number) {
		this._minValue = minValue;
		this._maxValue = maxValue;
	}

	public equals(pr: PriceRangeImpl | null): boolean {
		if (pr === null) {
			return false;
		}
		return this._minValue === pr._minValue && this._maxValue === pr._maxValue;
	}

	public clone(): PriceRangeImpl {
		/* 傳回新的物件，而不是copy */
		return new PriceRangeImpl(this._minValue, this._maxValue);
	}

	public minValue(): number {
		/* min value getter */
		return this._minValue;
	}

	public maxValue(): number {
		/* max value getter */
		return this._maxValue;
	}

	public length(): number {
		/* range的長度 */
		return this._maxValue - this._minValue;
	}

	public isEmpty(): boolean {
		/* 當min === max (長度為0)或min, max不是數字時 */
		return this._maxValue === this._minValue || Number.isNaN(this._maxValue) || Number.isNaN(this._minValue);
	}

	public merge(anotherRange: PriceRangeImpl | null): PriceRangeImpl {
		/* anotherRange是另一組min, max
		* 合併時，新的min取兩者min中較者，而新的max取兩者max中較大者
		* */
		if (anotherRange === null) {
			return this;
		}
		return new PriceRangeImpl(
			Math.min(this.minValue(), anotherRange.minValue()),
			Math.max(this.maxValue(), anotherRange.maxValue())
		);
	}

	public scaleAroundCenter(coeff: number): void {
		if (!isNumber(coeff)) {
			return;
		}

		const delta = this._maxValue - this._minValue;
		if (delta === 0) {
			return;
		}

		const center = (this._maxValue + this._minValue) * 0.5;
		let maxDelta = this._maxValue - center;
		let minDelta = this._minValue - center;
		maxDelta *= coeff;
		minDelta *= coeff;
		this._maxValue = center + maxDelta;
		this._minValue = center + minDelta;
	}

	public shift(delta: number): void {
		/* range(min, max)平移delta單位為(min+delta, max+delta) */
		if (!isNumber(delta)) {
			return;
		}

		this._maxValue += delta;
		this._minValue += delta;
	}

	public toRaw(): PriceRange {
		/* 由PriceRange class轉為單純的object */
		return {
			minValue: this._minValue,
			maxValue: this._maxValue,
		};
	}

	public static fromRaw(raw: PriceRange | null): PriceRangeImpl | null {
		/* 由含有minValue, maxValue的object生成PriceRange */
		return (raw === null) ? null : new PriceRangeImpl(raw.minValue, raw.maxValue);
	}
}
