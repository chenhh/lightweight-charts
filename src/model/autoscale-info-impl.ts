import { PriceRangeImpl } from './price-range-impl';
import { AutoscaleInfo } from './series-options';

/**
 * Represents the margin used when updating a price scale.
 */
export interface AutoScaleMargins {
	/** The number of pixels for bottom margin */
	below: number;
	/** The number of pixels for top margin */
	above: number;
}

export class AutoscaleInfoImpl {
	private readonly _priceRange: PriceRangeImpl | null;	// price range的max, min值與相關method, 不含中間的ticks
	private readonly _margins: AutoScaleMargins | null;

	public constructor(priceRange: PriceRangeImpl | null, margins?: AutoScaleMargins | null) {
		this._priceRange = priceRange;
		this._margins = margins || null;
	}

	public priceRange(): PriceRangeImpl | null {
		/* price range getter */
		return this._priceRange;
	}

	public margins(): AutoScaleMargins | null {
		/* margins getter */
		return this._margins;
	}

	public toRaw(): AutoscaleInfo | null {
		/* 將price range中的min, max 和margins的bellow ,above轉成object後傳回 */
		if (this._priceRange === null) {
			return null;
		}
		return {
			priceRange: this._priceRange.toRaw(),
			margins: this._margins || undefined,
		};
	}

	public static fromRaw(raw: AutoscaleInfo | null): AutoscaleInfoImpl | null {
		/*由滿足屬性的object，建立AutoScaleInfoImpl物件 */
		return (raw === null) ? null : new AutoscaleInfoImpl(PriceRangeImpl.fromRaw(raw.priceRange), raw.margins);
	}
}
